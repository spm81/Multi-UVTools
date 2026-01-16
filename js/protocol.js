let globalWriteReader = null;
let globalReadReader = null;


// Helper function to compare Uint8Arrays properly
const uint8ArraysEqual = (a, b) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const EEPROM_BLOCK_SIZE = 0x40;
const FLASH_BLOCK_SIZE = 0x100;

const releaseIo = (target = "all") => {
  try {
    if (target !== "read" && globalWriteReader) globalWriteReader.releaseLock();
    if (target !== "write" && globalReadReader) globalReadReader.releaseLock();
  } catch {
    // Ignore release errors.
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chunkUint8Array = (inputArray, chunkSize) => {
  const result = [];
  for (let i = 0; i < inputArray.length; i += chunkSize) {
    result.push(inputArray.slice(i, i + chunkSize));
  }
  return result;
};

const xorPacket = (data) => {
  const dataXor = new Uint8Array(data);
  const k5XorArray = new Uint8Array([
    0x16, 0x6c, 0x14, 0xe6, 0x2e, 0x91, 0x0d, 0x40, 0x21, 0x35, 0xd5, 0x40,
    0x13, 0x03, 0xe9, 0x80,
  ]);

  for (let i = 0; i < dataXor.length; i += 1) {
    dataXor[i] ^= k5XorArray[i % k5XorArray.length];
  }
  return dataXor;
};

const crc16xmodem = (data, crc = 0) => {
  const poly = 0x1021;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ poly : crc << 1;
    }
    crc &= 0xffff;
  }
  return crc;
};

const packetize = (data) => {
  const header = new Uint8Array([0xab, 0xcd]);
  const length = new Uint8Array([data.length & 0xff, (data.length >> 8) & 0xff]);
  const crc = crc16xmodem(data);
  const crcBytes = new Uint8Array([crc & 0xff, (crc >> 8) & 0xff]);
  const obfuscatedData = xorPacket(new Uint8Array([...data, ...crcBytes]));
  const footer = new Uint8Array([0xdc, 0xba]);
  return new Uint8Array([...header, ...length, ...obfuscatedData, ...footer]);
};

const unpacketize = (packet) => {
  const length = new Uint8Array([packet[2], packet[3]]);
  const obfuscatedData = packet.slice(4, packet.length - 4);
  if (obfuscatedData.length !== length[0] + (length[1] << 8)) {
    throw new Error("Packet length does not match length field.");
  }
  return xorPacket(obfuscatedData);
};

const sendPacket = async (port, data) => {
  releaseIo("write");
  const writer = port.writable.getWriter();
  globalWriteReader = writer;

  const packet = packetize(data);
  const chunkedPacket = chunkUint8Array(packet, 64);
  for (const chunk of chunkedPacket) {
    await writer.write(chunk);
    await sleep(1);
  }

  writer.releaseLock();
};

const readPacket = async (port, expectedData, timeout = 1000) => {
  releaseIo("read");
  const reader = port.readable.getReader();
  globalReadReader = reader;
  let buffer = new Uint8Array();
  let timeoutId;

  try {
    return await new Promise((resolve, reject) => {
      function handleData({ value, done }) {
        if (done) {
          reject(new Error("Reader cancelled."));
          return;
        }

        buffer = new Uint8Array([...buffer, ...value]);

        while (buffer.length > 0 && buffer[0] !== 0xab) {
          buffer = buffer.slice(1);
        }

        while (buffer.length >= 4 && buffer[0] === 0xab && buffer[1] === 0xcd) {
          const payloadLength = buffer[2] + (buffer[3] << 8);
          const totalPacketLength = payloadLength + 8;

          if (buffer.length >= totalPacketLength) {
            const packet = buffer.slice(0, totalPacketLength);

            if (packet[payloadLength + 6] === 0xdc && packet[payloadLength + 7] === 0xba) {
              buffer = buffer.slice(totalPacketLength);
              const deobfuscatedData = unpacketize(packet);
              if (deobfuscatedData[0] !== expectedData) {
                continue;
              }
              resolve(deobfuscatedData);
              return;
            }
            buffer = buffer.slice(1);
          } else {
            break;
          }
        }

        reader.read().then(handleData).catch(reject);
      }

      reader.read().then(handleData).catch(reject);

      timeoutId = setTimeout(() => {
        reader
          .cancel()
          .then(() => reject(new Error("Timeout waiting for packet.")))
          .catch(reject);
      }, timeout);
    });
  } finally {
    clearTimeout(timeoutId);
    reader.releaseLock();
  }
};

const eepromInit = async (port) => {
  const packet = new Uint8Array([0x14, 0x05, 0x04, 0x00, 0xff, 0xff, 0xff, 0xff]);
  await sendPacket(port, packet);
  const response = await readPacket(port, 0x15);
  const decoder = new TextDecoder();
  const version = new Uint8Array(response.slice(4, 4 + 16));
  return decoder.decode(version.slice(0, version.indexOf(0)));
};

const eepromRead = async (port, address, size = EEPROM_BLOCK_SIZE) => {
  const addressMsb = (address & 0xff00) >> 8;
  const addressLsb = address & 0xff;
  const packet = new Uint8Array([
    0x1b,
    0x05,
    0x08,
    0x00,
    addressLsb,
    addressMsb,
    size,
    0x00,
    0xff,
    0xff,
    0xff,
    0xff,
  ]);

  await sendPacket(port, packet);
  const response = await readPacket(port, 0x1c);
  if (response[6] !== size) {
    throw new Error("EEPROM read reply has wrong size.");
  }
  return new Uint8Array(response.slice(8));
};

const eepromWrite = async (port, address, input, size = EEPROM_BLOCK_SIZE) => {
  const addressMsb = (address & 0xff00) >> 8;
  const addressLsb = address & 0xff;
  const packet = new Uint8Array([
    0x1d,
    0x05,
    size + 8,
    0,
    addressLsb,
    addressMsb,
    size,
    1,
    0xff,
    0xff,
    0xff,
    0xff,
  ]);
  const mergedArray = new Uint8Array(packet.length + input.length);
  mergedArray.set(packet);
  mergedArray.set(input, packet.length);

  await sendPacket(port, mergedArray);
  await readPacket(port, 0x1e);
  return true;
};

const eepromReboot = async (port) => {
  const packet = new Uint8Array([0xdd, 0x05]);
  await sendPacket(port, packet);
  return true;
};

const Crc16Tab = [
  0, 4129, 8258, 12387, 16516, 20645, 24774, 28903, 33032, 37161, 41290,
  45419, 49548, 53677, 57806, 61935, 4657, 528, 12915, 8786, 21173, 17044,
  29431, 25302, 37689, 33560, 45947, 41818, 54205, 50076, 62463, 58334, 9314,
  13379, 1056, 5121, 25830, 29895, 17572, 21637, 42346, 46411, 34088, 38153,
  58862, 62927, 50604, 54669, 13907, 9842, 5649, 1584, 30423, 26358, 22165,
  18100, 46939, 42874, 38681, 34616, 63455, 59390, 55197, 51132, 18628, 22757,
  26758, 30887, 2112, 6241, 10242, 14371, 51660, 55789, 59790, 63919, 35144,
  39273, 43274, 47403, 23285, 19156, 31415, 27286, 6769, 2640, 14899, 10770,
  56317, 52188, 64447, 60318, 39801, 35672, 47931, 43802, 27814, 31879, 19684,
  23749, 11298, 15363, 3168, 7233, 60846, 64911, 52716, 56781, 44330, 48395,
  36200, 40265, 32407, 28342, 24277, 20212, 15891, 11826, 7761, 3696, 65439,
  61374, 57309, 53244, 48923, 44858, 40793, 36728, 37256, 33193, 45514, 41451,
  53516, 49453, 61774, 57711, 4224, 161, 12482, 8419, 20484, 16421, 28742,
  24679, 33721, 37784, 41979, 46042, 49981, 54044, 58239, 62302, 689, 4752,
  8947, 13010, 16949, 21012, 25207, 29270, 46570, 42443, 38312, 34185, 62830,
  58703, 54572, 50445, 13538, 9411, 5280, 1153, 29798, 25671, 21540, 17413,
  42971, 47098, 34713, 38840, 59231, 63358, 50973, 55100, 9939, 14066, 1681,
  5808, 26199, 30326, 17941, 22068, 55628, 51565, 63758, 59695, 39368, 35305,
  47498, 43435, 22596, 18533, 30726, 26663, 6336, 2273, 14466, 10403, 52093,
  56156, 60223, 64286, 35833, 39896, 43963, 48026, 19061, 23124, 27191, 31254,
  2801, 6864, 10931, 14994, 64814, 60687, 56684, 52557, 48554, 44427, 40424,
  36297, 31782, 27655, 23652, 19525, 15522, 11395, 7392, 3265, 61215, 65342,
  53085, 57212, 44955, 49082, 36825, 40952, 28183, 32310, 20053, 24180, 11923,
  16050, 3793, 7920,
];

const crc16Ccitt = (data) => {
  let value = 0;
  for (let i = 0; i < data.length; i += 1) {
    const out = Crc16Tab[((value >> 8) ^ data[i]) & 255];
    value = out ^ (value << 8);
  }
  return value & 0xffff;
};

const crc16CcittLe = (data) => {
  const crc = crc16Ccitt(data);
  return new Uint8Array([crc & 255, crc >> 8]);
};

const firmwareXor = (fwcontent) => {
  const xorArray = new Uint8Array([
    0x47, 0x22, 0xc0, 0x52, 0x5d, 0x57, 0x48, 0x94, 0xb1, 0x60, 0x60, 0xdb,
    0x6f, 0xe3, 0x4c, 0x7c, 0xd8, 0x4a, 0xd6, 0x8b, 0x30, 0xec, 0x25, 0xe0,
    0x4c, 0xd9, 0x00, 0x7f, 0xbf, 0xe3, 0x54, 0x05, 0xe9, 0x3a, 0x97, 0x6b,
    0xb0, 0x6e, 0x0c, 0xfb, 0xb1, 0x1a, 0xe2, 0xc9, 0xc1, 0x56, 0x47, 0xe9,
    0xba, 0xf1, 0x42, 0xb6, 0x67, 0x5f, 0x0f, 0x96, 0xf7, 0xc9, 0x3c, 0x84,
    0x1b, 0x26, 0xe1, 0x4e, 0x3b, 0x6f, 0x66, 0xe6, 0xa0, 0x6a, 0xb0, 0xbf,
    0xc6, 0xa5, 0x70, 0x3a, 0xba, 0x18, 0x9e, 0x27, 0x1a, 0x53, 0x5b, 0x71,
    0xb1, 0x94, 0x1e, 0x18, 0xf2, 0xd6, 0x81, 0x02, 0x22, 0xfd, 0x5a, 0x28,
    0x91, 0xdb, 0xba, 0x5d, 0x64, 0xc6, 0xfe, 0x86, 0x83, 0x9c, 0x50, 0x1c,
    0x73, 0x03, 0x11, 0xd6, 0xaf, 0x30, 0xf4, 0x2c, 0x77, 0xb2, 0x7d, 0xbb,
    0x3f, 0x29, 0x28, 0x57, 0x22, 0xd6, 0x92, 0x8b,
  ]);

  for (let i = 0; i < fwcontent.length; i += 1) {
    fwcontent[i] ^= xorArray[i % xorArray.length];
  }
  return fwcontent;
};

// Check if firmware has valid CRC (local files) or not (GitHub files)
const hasCrcValidation = (firmware) => {
  if (firmware.length < 2) return false;
  try {
    const calculatedCrc = crc16CcittLe(firmware.slice(0, -2));
    const firmwareCrc = firmware.slice(-2);
    return uint8ArraysEqual(calculatedCrc, firmwareCrc);
  } catch (e) {
    return false;
  }
};

// Detect if firmware is raw (unencrypted ARM binary)
// Raw ARM firmware starts with stack pointer (little-endian) in RAM range
// Typical pattern: F0 3F 00 20 (stack at 0x20003FF0)
const isRawFirmware = (firmware) => {
  if (firmware.length < 8) return false;
  // Check first 4 bytes - should be stack pointer in 0x20000000-0x20010000 range
  const stackPointer = firmware[0] | (firmware[1] << 8) | (firmware[2] << 16) | (firmware[3] << 24);
  // Check if stack pointer is in RAM range (0x20000000 to 0x20010000)
  return stackPointer >= 0x20000000 && stackPointer <= 0x20010000;
};

const unpackFirmware = (encodedFirmware) => {
  // Check if firmware is raw (unencrypted ARM binary)
  if (isRawFirmware(encodedFirmware)) {
    // Raw firmware - return as-is, no processing needed
    console.log("Detected raw firmware - no unpacking needed");
    return encodedFirmware;
  }
  
  // Check if firmware has CRC validation (packed files typically have CRC)
  const hasCrc = hasCrcValidation(encodedFirmware);
  
  if (hasCrc) {
    // Firmware with CRC validation (packed local files)
    const calculatedCrc = crc16CcittLe(encodedFirmware.slice(0, -2));
    const firmwareCrc = encodedFirmware.slice(-2);
    if (!uint8ArraysEqual(calculatedCrc, firmwareCrc)) {
      throw new Error("Firmware CRC check failed.");
    }
    // Remove CRC bytes before processing
    const decoded = firmwareXor(encodedFirmware.slice(0, -2));
    const versionInfoOffset = 0x2000;
    const versionInfoLength = 16;
    const resultLength = decoded.length - versionInfoLength;
    const result = new Uint8Array(resultLength);
    result.set(decoded.subarray(0, versionInfoOffset));
    result.set(decoded.subarray(versionInfoOffset + versionInfoLength), versionInfoOffset);
    return result;
  } else {
    // Packed firmware without CRC (some GitHub files)
    const decoded = firmwareXor(encodedFirmware);
    const versionInfoOffset = 0x2000;
    const versionInfoLength = 16;
    const resultLength = decoded.length - versionInfoLength;
    const result = new Uint8Array(resultLength);
    result.set(decoded.subarray(0, versionInfoOffset));
    result.set(decoded.subarray(versionInfoOffset + versionInfoLength), versionInfoOffset);
    return result;
  }
};

const unpackFirmwareVersion = (encodedFirmware) => {
  // Check if firmware is raw (unencrypted ARM binary)
  if (isRawFirmware(encodedFirmware)) {
    // Raw firmware - version info is at 0x2000 without XOR
    const versionInfoOffset = 0x2000;
    const versionInfoLength = 16;
    return encodedFirmware.subarray(versionInfoOffset, versionInfoOffset + versionInfoLength);
  }
  
  // Check if firmware has CRC validation (packed files typically have CRC)
  const hasCrc = hasCrcValidation(encodedFirmware);
  
  if (hasCrc) {
    // Firmware with CRC validation (packed local files)
    const calculatedCrc = crc16CcittLe(encodedFirmware.slice(0, -2));
    const firmwareCrc = encodedFirmware.slice(-2);
    if (!uint8ArraysEqual(calculatedCrc, firmwareCrc)) {
      throw new Error("Firmware CRC check failed.");
    }
    // Remove CRC bytes before processing
    const decoded = firmwareXor(encodedFirmware.slice(0, -2));
    const versionInfoOffset = 0x2000;
    const versionInfoLength = 16;
    return decoded.subarray(versionInfoOffset, versionInfoOffset + versionInfoLength);
  } else {
    // Packed firmware without CRC (some GitHub files)
    const decoded = firmwareXor(encodedFirmware);
    const versionInfoOffset = 0x2000;
    const versionInfoLength = 16;
    return decoded.subarray(versionInfoOffset, versionInfoOffset + versionInfoLength);
  }
};

const flashGenerateCommand = (data, address, totalSize) => {
  if (data.length < FLASH_BLOCK_SIZE) {
    const padding = new Uint8Array(FLASH_BLOCK_SIZE - data.length);
    data = new Uint8Array([...data, ...padding]);
  }
  if (data.length !== FLASH_BLOCK_SIZE) throw new Error("Invalid flash block size.");

  const addressMsb = (address & 0xff00) >> 8;
  const addressLsb = address & 0xff;
  const addressFinal = (totalSize + 0xff) & ~0xff;
  if (addressFinal > 0xf000) throw new Error("Firmware size too large.");
  const addressFinalMsb = (addressFinal & 0xff00) >> 8;

  // Block size is always 0x100 (256 bytes) - send as little-endian
  const blockSize = FLASH_BLOCK_SIZE; // 0x100
  
  return new Uint8Array([
    0x19,
    0x5,
    0xc,
    0x1,
    0x8a,
    0x8d,
    0x9f,
    0x1d,
    addressMsb,
    addressLsb,
    addressFinalMsb,
    0x0,
    0x01,
    0x00,
    0x0,
    0x0,
    ...data,
  ]);
};

export {
  EEPROM_BLOCK_SIZE,
  FLASH_BLOCK_SIZE,
  releaseIo,
  sendPacket,
  readPacket,
  eepromInit,
  eepromRead,
  eepromWrite,
  eepromReboot,
  unpackFirmware,
  unpackFirmwareVersion,
  flashGenerateCommand,
};
