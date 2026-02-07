// flash-k1.js
// Flash protocol for K1 radio (different from K5 EEPROM protocol)
// K1 uses a bootloader protocol
// FIXED VERSION - With critical security & integrity checks

'use strict';

// ========== CONSTANTS ==========
const BAUDRATE_K1 = 38400;

// Message types for K1 bootloader
const MSG_NOTIFY_DEV_INFO = 0x0518;
const MSG_NOTIFY_BL_VER = 0x0530;
const MSG_PROG_FW = 0x0519;
const MSG_PROG_FW_RESP = 0x051A;

// K1 XOR obfuscation table (same as K5 protocol packets)
const OBFUS_TBL = new Uint8Array([
  0x16, 0x6c, 0x14, 0xe6, 0x2e, 0x91, 0x0d, 0x40,
  0x21, 0x35, 0xd5, 0x40, 0x13, 0x03, 0xe9, 0x80
]);

// ========== MODEL DETECTION ==========
const MODEL_UNKNOWN = 0;
const MODEL_UV_K5_V1 = 1;
const MODEL_UV_K5_V2 = 2;
const MODEL_UV_K1 = 3;

// ========== BOOTLOADER BLOCKLIST ==========
// CRITICALLY DANGEROUS versions - ALWAYS BLOCK
const BLOCKED_BOOTLOADERS = [
    "5.00.01",  // UV-K5 V2 - GUARANTEED BRICK with K1 firmware
    "2.00.06",  // UV-K5 V1 - GUARANTEED BRICK with K1 firmware
];

// MINIMUM SAFE version for UV-K1
const MIN_K1_BOOTLOADER = "7.03.01";

// Known bootloader to model mapping
const BOOTLOADER_TO_MODEL = {
    "5.00.01": "UV-K5 V2",
    "2.00.06": "UV-K5 V1", 
    "7.03.01": "UV-K1",
    "7.03.02": "UV-K1",
    "7.03.03": "UV-K1",
    // Add more as discovered
};

// ========== CLASS ==========
export class K1Flash {
  constructor(port) {
    this.port = port;
    this.reader = null;
    this.writer = null;
    this.readBuffer = [];
    this.isReading = false;
    this.logFn = (msg, type) => console.log(`[K1] ${msg}`);
  }

  setLogger(fn) {
    this.logFn = fn;
  }

  log(message, type = 'info') {
    this.logFn(message, type);
  }

  // ========== BOOTLOADER VALIDATION ==========
  validateBootloader(blVersion) {
    // ===== FIX #1: VALIDATE NULL/UNDEFINED INPUT =====
    // Check if blVersion is valid before processing
    if (!blVersion || typeof blVersion !== 'string' || blVersion.length === 0) {
      return {
        valid: false,
        critical: true,
        message: `❌ Invalid bootloader version received\\n\\n` +
                 `Version is null, undefined, or empty.\\n` +
                 `Cannot safely validate bootloader.`,
        allowed: false
      };
    }

    // Normalize version
    const version = blVersion.trim();
    
    // ===== 1. ABSOLUTE BLOCK CHECK =====
    if (BLOCKED_BOOTLOADERS.includes(version)) {
      const model = BOOTLOADER_TO_MODEL[version] || "unknown model";
      return {
        valid: false,
        critical: true,
        message: `🚨🚨🚨 BOOTLOADER BLOCKED 🚨🚨🚨\\n\\n` +
                 `Detected version: ${version}\\n` +
                 `This bootloader belongs to: ${model}\\n\\n` +
                 `❌ NOT COMPATIBLE with UV-K1 firmware!\\n` +
                 `❌ Flashing will BRICK the radio!\\n\\n` +
                 `Operation BLOCKED for safety.`,
        allowed: false
      };
    }
    
    // ===== 2. MINIMUM VERSION CHECK =====
    // Convert versions to comparable numbers (e.g., 7.03.01 -> 70301)
    function versionToNumber(ver) {
      const parts = ver.split('.').map(Number);
      if (parts.length < 3) return 0;
      return parts[0] * 10000 + parts[1] * 100 + parts[2];
    }
    
    const currentVersionNum = versionToNumber(version);
    const minVersionNum = versionToNumber(MIN_K1_BOOTLOADER);
    
    if (currentVersionNum < minVersionNum) {
      return {
        valid: false,
        critical: true,
        message: `⚠️ INSUFFICIENT BOOTLOADER VERSION ⚠️\\n\\n` +
                 `Detected version: ${version}\\n` +
                 `Minimum required: ${MIN_K1_BOOTLOADER}\\n\\n` +
                 `This version is too old or belongs to another model.\\n` +
                 `Update bootloader before flashing UV-K1 firmware.`,
        allowed: false
      };
    }
    
    // ===== 3. BOOTLOADER APPROVED =====
    const model = BOOTLOADER_TO_MODEL[version] || "UV-K1 (assumed)";
    return {
      valid: true,
      critical: false,
      message: `✅ Compatible bootloader detected!\\n\\n` +
               `Version: ${version}\\n` +
               `Model: ${model}\\n` +
               `Status: Approved for flash`,
      allowed: true
    };
  }

  // ========== SERIAL ==========
  async open() {
    try {
      await this.port.open({ baudRate: BAUDRATE_K1 });
    } catch (e) {
      if (!e.message.includes('already open')) {
        throw e;
      }
    }
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
    this.startReading();
    await this.sleep(500);
  }

  async close() {
    this.isReading = false;
    if (this.reader) {
      try { await this.reader.cancel(); } catch {}
      try { this.reader.releaseLock(); } catch {}
      this.reader = null;
    }
    if (this.writer) {
      try { await this.writer.close(); } catch {}
      this.writer = null;
    }
    if (this.port) {
      try { await this.port.close(); } catch {}
    }
  }

  startReading() {
    if (!this.reader || this.isReading) return;
    this.isReading = true;
    this.readLoop().catch(e => {
      if (this.isReading) this.log(`Read loop error: ${e?.message}`, 'error');
    });
  }

  async readLoop() {
    while (this.isReading && this.reader) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value?.length) {
          this.readBuffer.push(...value);
        }
      } catch (e) {
        if (this.isReading) break;
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== PROTOCOL HELPERS ==========
  createMessage(msgType, dataLen) {
    const msg = new Uint8Array(4 + dataLen);
    const view = new DataView(msg.buffer);
    view.setUint16(0, msgType, true);
    view.setUint16(2, dataLen, true);
    return msg;
  }

  obfuscate(buf, off, size) {
    for (let i = 0; i < size; i++) {
      buf[off + i] ^= OBFUS_TBL[i % OBFUS_TBL.length];
    }
  }

  calcCRC(buf, off, size) {
    let CRC = 0;
    for (let i = 0; i < size; i++) {
      const b = buf[off + i] & 0xff;
      CRC ^= b << 8;
      for (let j = 0; j < 8; j++) {
        if (CRC & 0x8000) CRC = ((CRC << 1) ^ 0x1021) & 0xffff;
        else CRC = (CRC << 1) & 0xffff;
      }
    }
    return CRC;
  }

  makePacket(msg) {
    let msgLen = msg.length;
    if (msgLen % 2 !== 0) msgLen++;
    const buf = new Uint8Array(8 + msgLen);
    const view = new DataView(buf.buffer);

    view.setUint16(0, 0xCDAB, true);
    view.setUint16(2, msgLen, true);
    view.setUint16(6 + msgLen, 0xBADC, true);

    for (let i = 0; i < msg.length; i++) buf[4 + i] = msg[i];

    const crc = this.calcCRC(buf, 4, msgLen);
    view.setUint16(4 + msgLen, crc, true);

    this.obfuscate(buf, 4, 2 + msgLen);
    return buf;
  }

  fetchMessage() {
    const buf = this.readBuffer;
    if (buf.length < 8) return null;

    let packBegin = -1;
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i] === 0xab && buf[i + 1] === 0xcd) {
        packBegin = i;
        break;
      }
    }
    if (packBegin === -1) {
      if (buf.length > 0 && buf[buf.length - 1] === 0xab) buf.splice(0, buf.length - 1);
      else buf.length = 0;
      return null;
    }
    if (buf.length - packBegin < 8) return null;

    const msgLen = (buf[packBegin + 3] << 8) | buf[packBegin + 2];
    const packEnd = packBegin + 6 + msgLen;
    if (buf.length < packEnd + 2) return null;

    if (buf[packEnd] !== 0xdc || buf[packEnd + 1] !== 0xba) {
      buf.splice(0, packBegin + 2);
      return null;
    }

    // ===== FIX #2: VALIDATE CRC BEFORE ACCEPTING MESSAGE =====
    // Extract data and CRC separately
    const dataBuf = new Uint8Array(msgLen);
    const crcBuf = new Uint8Array(2);
    
    for (let i = 0; i < msgLen; i++) {
      dataBuf[i] = buf[packBegin + 4 + i];
    }
    for (let i = 0; i < 2; i++) {
      crcBuf[i] = buf[packBegin + 4 + msgLen + i];
    }
    
    // Deobfuscate separately to preserve integrity check
    this.obfuscate(dataBuf, 0, msgLen);
    this.obfuscate(crcBuf, 0, 2);
    
    // Extract received CRC
    const crcView = new DataView(crcBuf.buffer);
    const receivedCRC = crcView.getUint16(0, true);
    
    // Calculate CRC over the message data
    let calculatedCRC = 0;
    for (let i = 0; i < msgLen; i++) {
      const b = dataBuf[i] & 0xff;
      calculatedCRC ^= b << 8;
      for (let j = 0; j < 8; j++) {
        if (calculatedCRC & 0x8000) calculatedCRC = ((calculatedCRC << 1) ^ 0x1021) & 0xffff;
        else calculatedCRC = (calculatedCRC << 1) & 0xffff;
      }
    }
    
    // Validate CRC
    if (receivedCRC !== calculatedCRC) {
      this.log(`CRC mismatch: expected 0x${calculatedCRC.toString(16)}, got 0x${receivedCRC.toString(16)}`, 'error');
      buf.splice(0, packEnd + 2);
      return null; // Discard corrupted packet
    }

    // Extract message type from deobfuscated data
    const dataView = new DataView(dataBuf.buffer);
    const msgType = dataView.getUint16(0, true);
    const msgData = dataBuf.slice(4);

    buf.splice(0, packEnd + 2);
    return { msgType, data: msgData, rawData: dataBuf };
  }

  async sendMessage(msg) {
    const packet = this.makePacket(msg);
    await this.writer.write(packet);
  }

  // ========== FLASH FIRMWARE ==========
  async flashFirmware(firmwareData, onProgress) {
    this.readBuffer = [];
    await this.open();
    await this.sleep(1000);

    this.log('Waiting for K1 bootloader...');
    const devInfo = await this.waitForDeviceInfo();
    const blVersion = devInfo.blVersion;
    
    this.log(`Bootloader version: ${blVersion}`);

    // ===== CRITICAL BOOTLOADER VALIDATION =====
    const bootloaderCheck = this.validateBootloader(blVersion);
    
    if (!bootloaderCheck.allowed) {
      await this.close();
      
      // Log to console
      this.log(bootloaderCheck.message, 'error');
      
      // For critical errors, throw to be caught by UI
      if (bootloaderCheck.critical) {
        throw new Error(`BOOTLOADER_BLOCKED: ${bootloaderCheck.message}`);
      }
      
      return;
    }
    
    this.log(bootloaderCheck.message, 'success');

    this.log('Performing handshake...');
    await this.performHandshake(devInfo.blVersion);
    this.log('Handshake complete.');

    await this.programFirmware(firmwareData, onProgress);
    this.log('Firmware programmed successfully!', 'success');
  }

  async waitForDeviceInfo() {
    let lastTimestamp = 0, acc = 0, timeout = 0;
    let isFirstMessage = true; // ===== FIX #3: FLAG FOR FIRST MESSAGE =====

    while (timeout < 500) {
      await this.sleep(10);
      timeout++;

      const msg = this.fetchMessage();
      if (!msg) continue;

      if (msg.msgType === MSG_NOTIFY_DEV_INFO) {
        const now = Date.now();
        const dt = now - lastTimestamp;
        lastTimestamp = now;

        // ===== FIX #3: IMPROVED TIMESTAMP LOGIC =====
        // First message should not require timing validation
        if (isFirstMessage) {
          isFirstMessage = false;
          acc = 1; // Start accumulation
        } else if (dt >= 5 && dt <= 1000) {
          // Subsequent messages must have reasonable timing
          acc++;
        } else {
          // Timing out of range, reset counter
          acc = 0;
        }
        
        if (acc >= 5) {
          const uid = msg.data.slice(0, 16);
          let blVersionEnd = -1;
          for (let i = 16; i < 32; i++) {
            if (msg.data[i] === 0) {
              blVersionEnd = i;
              break;
            }
          }
          if (blVersionEnd === -1) blVersionEnd = 32;
          const blVersion = new TextDecoder().decode(msg.data.slice(16, blVersionEnd));
          return { uid, blVersion };
        }
      }
    }
    throw new Error('Timeout waiting for K1 device. Put radio in boot mode.');
  }

  async performHandshake(blVersion) {
    let acc = 0;

    while (acc < 3) {
      await this.sleep(50);
      const msg = this.fetchMessage();
      if (msg && msg.msgType === MSG_NOTIFY_DEV_INFO) {
        const blMsg = this.createMessage(MSG_NOTIFY_BL_VER, 4);
        const blBytes = new TextEncoder().encode(blVersion.substring(0, 4));
        for (let i = 0; i < Math.min(blBytes.length, 4); i++) blMsg[4 + i] = blBytes[i];
        await this.sendMessage(blMsg);
        acc++;
        await this.sleep(50);
      }
    }

    await this.sleep(200);
    while (this.readBuffer.length > 0) {
      const msg = this.fetchMessage();
      if (!msg) break;
    }
  }

  async programFirmware(firmwareData, onProgress) {
    const pageCount = Math.ceil(firmwareData.length / 256);
    const timestamp = Date.now() & 0xffffffff;
    this.log(`Programming ${pageCount} pages...`);

    let pageIndex = 0, retryCount = 0;
    const MAX_RETRIES = 3;

    while (pageIndex < pageCount) {
      if (onProgress) onProgress((pageIndex / pageCount) * 100);

      const msg = this.createMessage(MSG_PROG_FW, 268);
      const view = new DataView(msg.buffer);
      view.setUint32(4, timestamp, true);
      view.setUint16(8, pageIndex, true);
      view.setUint16(10, pageCount, true);

      const offset = pageIndex * 256;
      const len = Math.min(256, firmwareData.length - offset);
      for (let i = 0; i < len; i++) msg[16 + i] = firmwareData[offset + i];

      await this.sendMessage(msg);

      let gotResponse = false;
      for (let i = 0; i < 300 && !gotResponse; i++) {
        await this.sleep(10);
        const resp = this.fetchMessage();
        if (!resp) continue;
        if (resp.msgType === MSG_NOTIFY_DEV_INFO) continue;

        if (resp.msgType === MSG_PROG_FW_RESP) {
          const dv = new DataView(resp.data.buffer);
          const respPageIndex = dv.getUint16(4, true);
          const err = dv.getUint16(6, true);

          if (respPageIndex !== pageIndex) continue;
          if (err !== 0) {
            this.log(`Page ${pageIndex + 1}/${pageCount} error: ${err}`, 'error');
            retryCount++;
            if (retryCount > MAX_RETRIES) throw new Error(`Too many errors at page ${pageIndex}`);
            break;
          }

          gotResponse = true;
          retryCount = 0;
          if ((pageIndex + 1) % 10 === 0 || pageIndex === pageCount - 1)
            this.log(`Page ${pageIndex + 1}/${pageCount} OK`);
        }
      }

      if (gotResponse) {
        pageIndex++;
      } else {
        this.log(`Page ${pageIndex + 1}/${pageCount} timeout`, 'error');
        retryCount++;
        if (retryCount > MAX_RETRIES) throw new Error(`Too many timeouts at page ${pageIndex}`);
      }
    }

    if (onProgress) onProgress(100);
  }
}

export { BAUDRATE_K1 };
