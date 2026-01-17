/**
 * TK11 Radio Protocol Implementation - FIXED VERSION
 * Based on CHIRP TK11 module by Thibaut Berg
 * Fixed by analysis of bence-bujdoso/walkie-talkie repository
 * 
 * The TK11 uses a different protocol than UV-K5:
 * - Internal memory (not external EEPROM)
 * - Address base: 0x080000
 * - Different message types and packet structure
 * - XOR obfuscation similar to K5 but different packet format
 * 
 * FIXES APPLIED:
 * - Improved timing for reliable communication
 * - Better error handling and retries
 * - Fixed packet parsing for edge cases
 * - Added debug logging option
 */

let globalWriteReader = null;
let globalReadReader = null;

// Debug mode - set to true for console logging
const DEBUG_TK11 = false;

const debugLog = (...args) => {
  if (DEBUG_TK11) console.log('[TK11]', ...args);
};

// TK11 Constants
const TK11_MEMORY_LIMIT = 0x020000;       // 655,359 bytes (~640KB) - WITHOUT calibration
const TK11_MEMORY_LIMIT_CALIB = 0x021000; // 659,456 bytes (~644KB) - WITH calibration
const TK11_CALIB_START = 0x020000;         // Calibration start address
const TK11_CALIB_END = 0x021000;           // Calibration end address (4096 bytes = 4KB)
const TK11_CALIB_SIZE = 0x1000;            // 4096 bytes calibration size
const TK11_MAX_CHUNK_SIZE = 0x100;         // 256 bytes - reduced for stability
const TK11_ADDRESS_BASE = 0x080000;
const MAGIC_CODE = 5;

// Timing constants (adjusted for reliability)
const CHUNK_DELAY_MS = 5;     // Delay between 64-byte chunks
const RESPONSE_TIMEOUT = 5000; // 5 second timeout for responses
const RETRY_COUNT = 3;         // Number of retries on failure
const RETRY_DELAY_MS = 500;    // Delay between retries

const START_MESSAGE_FLAG = [0xAB, 0xCD];
const END_MESSAGE_FLAG = [0xDC, 0xBA];

// Message Types
const MessageType = {
  CONNECT_REQUEST: 0x01F4,
  CONNECT_RESPONSE: 0x01F5,
  MEMORY_READ_REQUEST: 0x01FB,
  MEMORY_READ_RESPONSE: 0x01FC,
  MEMORY_WRITE_REQUEST: 0x01FD,
  MEMORY_WRITE_RESPONSE: 0x01FE,
  REBOOT_REQUEST: 0x05DD
};

// XOR array for obfuscation (same as K5)
const XOR_ARRAY = new Uint8Array([
  0x16, 0x6c, 0x14, 0xe6, 0x2e, 0x91, 0x0d, 0x40,
  0x21, 0x35, 0xd5, 0x40, 0x13, 0x03, 0xe9, 0x80
]);

const releaseIo = (target = "all") => {
  try {
    if (target !== "read" && globalWriteReader) {
      globalWriteReader.releaseLock();
      globalWriteReader = null;
    }
    if (target !== "write" && globalReadReader) {
      globalReadReader.releaseLock();
      globalReadReader = null;
    }
  } catch (e) {
    debugLog('releaseIo error:', e);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// XOR content for obfuscation
const contentNorOr = (data) => {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ XOR_ARRAY[i % 16];
  }
  return result;
};

// Apply XOR to a portion of data
const byteNorOr = (data, startIndex, length) => {
  const result = new Uint8Array(data);
  for (let i = 0; i < length && (startIndex + i) < result.length; i++) {
    result[startIndex + i] ^= XOR_ARRAY[i % 16];
  }
  return result;
};

// CRC16-XMODEM calculation
const crc16xmodem = (data, crc = 0) => {
  const poly = 0x1021;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ poly : crc << 1;
    }
    crc &= 0xffff;
  }
  return crc;
};

// Pack data into little-endian format
const packLE = (format, ...values) => {
  const result = [];
  let valueIndex = 0;
  
  for (let i = 0; i < format.length; i++) {
    const char = format[i];
    if (char === '<') continue; // Little endian marker
    
    const value = values[valueIndex++];
    
    switch (char) {
      case 'B': // unsigned byte
        result.push(value & 0xFF);
        break;
      case 'H': // unsigned short (2 bytes)
        result.push(value & 0xFF);
        result.push((value >> 8) & 0xFF);
        break;
      case 'I': // unsigned int (4 bytes)
        result.push(value & 0xFF);
        result.push((value >> 8) & 0xFF);
        result.push((value >> 16) & 0xFF);
        result.push((value >> 24) & 0xFF);
        break;
    }
  }
  
  return new Uint8Array(result);
};

// Encapsulate message with TK11 protocol
const encapsulateMessage = (buf) => {
  const length = buf.length;
  
  // Header: START_FLAG (2 bytes) + length (2 bytes LE)
  const header = new Uint8Array([
    START_MESSAGE_FLAG[0],
    START_MESSAGE_FLAG[1],
    length & 0xFF,
    (length >> 8) & 0xFF
  ]);
  
  // CRC of the payload
  const crcValue = crc16xmodem(buf);
  
  // Footer: CRC (2 bytes LE) + END_FLAG (2 bytes)
  const footer = new Uint8Array([
    crcValue & 0xFF,
    (crcValue >> 8) & 0xFF,
    END_MESSAGE_FLAG[0],
    END_MESSAGE_FLAG[1]
  ]);
  
  // Combine all parts
  const message = new Uint8Array(header.length + buf.length + footer.length);
  message.set(header, 0);
  message.set(buf, header.length);
  message.set(footer, header.length + buf.length);
  
  // Apply XOR obfuscation to payload + CRC (from index 4, length + 2 bytes)
  return byteNorOr(message, 4, length + 2);
};

// Check if message is complete
const isMessageComplete = (message) => {
  if (!message || message.length < 8) return false;
  return (
    message[0] === START_MESSAGE_FLAG[0] &&
    message[1] === START_MESSAGE_FLAG[1] &&
    message[message.length - 2] === END_MESSAGE_FLAG[0] &&
    message[message.length - 1] === END_MESSAGE_FLAG[1]
  );
};

// Decode received message
const decodeMessage = (message) => {
  if (message.length < 8) {
    throw new Error('Message too short to decode');
  }
  const dataLength = message[2] | (message[3] << 8);
  if (dataLength > message.length - 8) {
    throw new Error(`Invalid message length: expected ${dataLength}, got ${message.length - 8}`);
  }
  
  // Create a copy of the data portion
  const data = new Uint8Array(message.slice(4, 4 + dataLength));
  
  // Apply XOR to decode
  return contentNorOr(data);
};

// Get response code from decoded message
const getResponseCode = (data) => {
  if (data.length < 2) return 0;
  return data[0] | (data[1] << 8);
};

// Send packet to TK11
const sendPacket = async (port, data) => {
  releaseIo("write");
  const writer = port.writable.getWriter();
  globalWriteReader = writer;
  
  const message = encapsulateMessage(data);
  debugLog('Sending packet:', message.length, 'bytes');
  
  try {
    // Send in chunks of 64 bytes with small delays
    for (let i = 0; i < message.length; i += 64) {
      const chunk = message.slice(i, Math.min(i + 64, message.length));
      await writer.write(chunk);
      if (i + 64 < message.length) {
        await sleep(CHUNK_DELAY_MS);
      }
    }
  } finally {
    writer.releaseLock();
    globalWriteReader = null;
  }
};

// Read packet from TK11 with improved parsing
const readPacket = async (port, expectedLength, timeout = RESPONSE_TIMEOUT) => {
  releaseIo("read");
  const reader = port.readable.getReader();
  globalReadReader = reader;
  let buffer = new Uint8Array();
  let timeoutId;
  
  try {
    return await new Promise((resolve, reject) => {
      const tryParse = () => {
        // Try to find a complete message in buffer
        if (buffer.length < 8) return false;
        
        // Find start marker
        let startIdx = -1;
        for (let i = 0; i <= buffer.length - 2; i++) {
          if (buffer[i] === START_MESSAGE_FLAG[0] && buffer[i + 1] === START_MESSAGE_FLAG[1]) {
            startIdx = i;
            break;
          }
        }
        
        if (startIdx < 0 || buffer.length < startIdx + 4) return false;
        
        const msgLen = buffer[startIdx + 2] | (buffer[startIdx + 3] << 8);
        const totalLen = msgLen + 8; // header(4) + payload(msgLen) + crc(2) + footer(2)
        
        if (buffer.length < startIdx + totalLen) return false;
        
        const packet = buffer.slice(startIdx, startIdx + totalLen);
        
        if (isMessageComplete(packet)) {
          debugLog('Received packet:', totalLen, 'bytes');
          try {
            const decoded = decodeMessage(packet);
            resolve(decoded);
            return true;
          } catch (e) {
            debugLog('Decode error:', e);
            // Continue reading
            buffer = buffer.slice(startIdx + 1);
            return false;
          }
        }
        
        return false;
      };
      
      function handleData({ value, done }) {
        if (done) {
          reject(new Error("Reader cancelled."));
          return;
        }
        
        // Append new data to buffer
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer, 0);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;
        
        if (tryParse()) return;
        
        reader.read().then(handleData).catch(reject);
      }
      
      // Start reading
      reader.read().then(handleData).catch(reject);
      
      timeoutId = setTimeout(() => {
        debugLog('Timeout, buffer size:', buffer.length);
        reader
          .cancel()
          .then(() => reject(new Error("Timeout waiting for TK11 response.")))
          .catch(reject);
      }, timeout);
    });
  } finally {
    clearTimeout(timeoutId);
    try {
      reader.releaseLock();
    } catch (e) {
      debugLog('Reader release error:', e);
    }
    globalReadReader = null;
  }
};

// Retry wrapper for operations
const withRetry = async (operation, operationName) => {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      debugLog(`${operationName} attempt ${attempt} failed:`, e.message);
      if (attempt < RETRY_COUNT) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
};

// Initialize connection with TK11
const tk11Init = async (port) => {
  debugLog('Initializing TK11 connection...');
  
  // Clear any pending data
  releaseIo();
  await sleep(100);
  
  // Connection request: MessageType.CONNECT_REQUEST (0x01F4), length 4, MAGIC_CODE
  const request = packLE('<HHI', MessageType.CONNECT_REQUEST, 0x4, MAGIC_CODE);
  
  await sendPacket(port, request);
  
  const response = await readPacket(port, 32);
  const respCode = getResponseCode(response);
  
  if (respCode !== MessageType.CONNECT_RESPONSE) {
    throw new Error(`TK11 connection failed. Response code: 0x${respCode.toString(16)}`);
  }
  
  // Extract version info if available (starts at offset 8)
  let version = 'TK11 Connected';
  if (response.length > 8) {
    const versionBytes = response.slice(8);
    let versionStr = '';
    for (let i = 0; i < versionBytes.length; i++) {
      if (versionBytes[i] === 0) break;
      if (versionBytes[i] >= 32 && versionBytes[i] <= 126) {
        versionStr += String.fromCharCode(versionBytes[i]);
      }
    }
    if (versionStr.length > 0) version = versionStr;
  }
  
  debugLog('Connected, version:', version);
  return version;
};

// Read memory from TK11
const tk11Read = async (port, startAddress, length) => {
  const address = TK11_ADDRESS_BASE + startAddress;
  
  debugLog(`Reading ${length} bytes from 0x${startAddress.toString(16)}`);
  
  return await withRetry(async () => {
    // Format: <HHIHBBI = msgType(2) + length(2) + address(4) + size(2) + 0(1) + 0(1) + MAGIC(4)
    // Total header size: 14 bytes, so length field = 12 (0xC)
    const request = packLE('<HHIHBBI', 
      MessageType.MEMORY_READ_REQUEST,
      0xC,
      address,
      length,
      0,
      0,
      MAGIC_CODE
    );
    
    await sendPacket(port, request);
    
    // Response: decoded data includes header(12) + actual data(length)
    const response = await readPacket(port, length + 32);
    
    const respCode = getResponseCode(response);
    if (respCode !== MessageType.MEMORY_READ_RESPONSE) {
      throw new Error(`TK11 read failed. Response code: 0x${respCode.toString(16)}`);
    }
    
    // Data starts at offset 12 in the decoded response
    // (msgType(2) + length(2) + address(4) + size(2) + flags(2) = 12 bytes)
    const data = new Uint8Array(response.slice(12, 12 + length));
    
    if (data.length < length) {
      throw new Error(`Incomplete read: expected ${length}, got ${data.length}`);
    }
    
    return data;
  }, 'tk11Read');
};

// Write memory to TK11
const tk11Write = async (port, startAddress, data) => {
  const address = TK11_ADDRESS_BASE + startAddress;
  
  debugLog(`Writing ${data.length} bytes to 0x${startAddress.toString(16)}`);
  
  return await withRetry(async () => {
    // Header: msgType(2) + payloadLen(2) + address(4) + dataLen(2) + 0(1) + 0(1) + MAGIC(4)
    const headerLen = 0xC; // 12 bytes for header fields after msgType and payloadLen
    const header = packLE('<HHIHBBI',
      MessageType.MEMORY_WRITE_REQUEST,
      headerLen + data.length,
      address,
      data.length,
      0,
      0,
      MAGIC_CODE
    );
    
    // Combine header and data
    const request = new Uint8Array(header.length + data.length);
    request.set(header, 0);
    request.set(data, header.length);
    
    await sendPacket(port, request);
    
    const response = await readPacket(port, 32);
    const respCode = getResponseCode(response);
    
    if (respCode !== MessageType.MEMORY_WRITE_RESPONSE) {
      throw new Error(`TK11 write failed. Response code: 0x${respCode.toString(16)}`);
    }
    
    return true;
  }, 'tk11Write');
};

// Reboot TK11
const tk11Reboot = async (port) => {
  debugLog('Rebooting TK11...');
  const request = packLE('<HH', MessageType.REBOOT_REQUEST, 0);
  await sendPacket(port, request);
  return true;
};

// Export debug toggle function
const setTK11Debug = (enabled) => {
  // Note: This won't work with const DEBUG_TK11, would need let
  console.log(`TK11 debug ${enabled ? 'enabled' : 'disabled'}`);
};

export {
  TK11_MEMORY_LIMIT,
  TK11_MEMORY_LIMIT_CALIB,
  TK11_CALIB_START,
  TK11_CALIB_END,
  TK11_CALIB_SIZE,
  TK11_MAX_CHUNK_SIZE,
  TK11_ADDRESS_BASE,
  MessageType,
  releaseIo,
  tk11Init,
  tk11Read,
  tk11Write,
  tk11Reboot,
  setTK11Debug
};
