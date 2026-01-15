// flash-rt890.js
// Flash protocol for RT-890/TK11 radio
// Based on DualTachyon radtel-rt-890-flasher-cli (Apache 2.0)
// https://github.com/DualTachyon/radtel-rt-890-flasher-cli

'use strict';

// ========== CONSTANTS ==========
const BAUDRATE_RT890 = 115200;
const BLOCK_SIZE = 128;
const READ_TIMEOUT = 2000;

// Commands
const CMD_ERASE_FLASH = 0x39;
const CMD_WRITE_FLASH = 0x57;
const CMD_READ_FLASH = 0x52;

// Response
const ACK = 0x06;
const BOOTLOADER_MODE = 0xFF;

// ========== STATE ==========
let rt890Port = null;
let rt890Reader = null;
let rt890Writer = null;
let rt890FirmwareData = null;
let rt890FirmwareName = '';
let isRt890Flashing = false;
let rt890ReadBuffer = [];
let isRt890Reading = false;

// ========== LOGGING ==========
let rt890LogFn = (msg, type) => console.log(`[RT890] ${msg}`);

function setRt890Logger(fn) {
  rt890LogFn = fn;
}

function logRt890(message, type = 'info') {
  rt890LogFn(message, type);
}

// ========== HELPERS ==========
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Simple checksum: sum of all bytes except last, mod 256
function calcChecksum(data, length) {
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum = (sum + data[i]) & 0xFF;
  }
  return sum;
}

function verifyChecksum(data) {
  const sum = calcChecksum(data, data.length - 1);
  return data[data.length - 1] === sum;
}

// ========== SERIAL ==========
async function connectRt890() {
  try {
    logRt890('Requesting serial port...');
    rt890Port = await navigator.serial.requestPort();
    logRt890(`Opening port at ${BAUDRATE_RT890} baud...`);
    await rt890Port.open({ 
      baudRate: BAUDRATE_RT890,
      dataBits: 8,
      parity: 'none',
      stopBits: 1
    });
    
    rt890Reader = rt890Port.readable.getReader();
    rt890Writer = rt890Port.writable.getWriter();
    
    startRt890Reading();
    await sleep(500);
    
    logRt890('Connected!', 'success');
  } catch (e) {
    logRt890(`Connection error: ${e?.message ?? String(e)}`, 'error');
    throw e;
  }
}

async function disconnectRt890() {
  isRt890Reading = false;
  if (rt890Reader) {
    try { await rt890Reader.cancel(); } catch {}
    try { rt890Reader.releaseLock(); } catch {}
    rt890Reader = null;
  }
  if (rt890Writer) {
    try { await rt890Writer.close(); } catch {}
    rt890Writer = null;
  }
  if (rt890Port) {
    try { await rt890Port.close(); } catch {}
    rt890Port = null;
  }
  logRt890('Disconnected');
}

function startRt890Reading() {
  if (!rt890Reader || isRt890Reading) return;
  isRt890Reading = true;
  rt890ReadLoop().catch(e => {
    if (isRt890Reading) logRt890(`Read error: ${e?.message}`, 'error');
  });
}

async function rt890ReadLoop() {
  try {
    while (isRt890Reading && rt890Reader) {
      const { value, done } = await rt890Reader.read();
      if (done) break;
      if (value?.length) {
        rt890ReadBuffer.push(...value);
      }
    }
  } catch (e) {
    if (isRt890Reading) logRt890(`Read error: ${e?.message}`, 'error');
  }
}

// ========== PROTOCOL COMMANDS ==========

// Wait for specific number of bytes with timeout
async function waitForBytes(count, timeoutMs = READ_TIMEOUT) {
  const startTime = Date.now();
  while (rt890ReadBuffer.length < count) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for ${count} bytes (got ${rt890ReadBuffer.length})`);
    }
    await sleep(10);
  }
  return rt890ReadBuffer.splice(0, count);
}

// Wait for single ACK byte
async function waitForAck(timeoutMs = READ_TIMEOUT) {
  const startTime = Date.now();
  while (rt890ReadBuffer.length < 1) {
    if (Date.now() - startTime > timeoutMs) {
      return false;
    }
    await sleep(10);
  }
  const response = rt890ReadBuffer.shift();
  return response === ACK;
}

// Check if radio is in bootloader mode
async function isBootloaderMode() {
  rt890ReadBuffer = [];
  
  // Try to read flash at address 0
  // If in bootloader mode, we get 0xFF response
  // If in normal mode, we get actual data
  const command = new Uint8Array(4);
  command[0] = CMD_READ_FLASH;
  command[1] = 0x00; // Offset high
  command[2] = 0x00; // Offset low
  command[3] = calcChecksum(command, 3);
  
  await rt890Writer.write(command);
  
  try {
    const response = await waitForBytes(1, 1000);
    
    if (response[0] === BOOTLOADER_MODE) {
      // Clear any remaining bytes
      await sleep(100);
      rt890ReadBuffer = [];
      return true;
    }
    
    // Got data, wait for rest of block and verify
    const remainingBytes = await waitForBytes(BLOCK_SIZE + 3, 1000);
    return false; // Not in bootloader mode
    
  } catch (e) {
    // Timeout might also indicate bootloader mode
    return true;
  }
}

// Erase flash command
async function eraseFlash() {
  logRt890('Erasing flash...');
  
  const command = new Uint8Array(5);
  command[0] = CMD_ERASE_FLASH;
  command[1] = 0x00;
  command[2] = 0x00;
  command[3] = 0x55; // Magic byte
  command[4] = calcChecksum(command, 4);
  
  rt890ReadBuffer = [];
  await rt890Writer.write(command);
  
  // Wait for ACK (erase can take a while)
  const ack = await waitForAck(5000);
  if (!ack) {
    throw new Error('Flash erase failed - no ACK received');
  }
  
  logRt890('Flash erased!', 'success');
  return true;
}

// Write flash command (128 bytes at a time)
async function writeFlash(offset, data) {
  const command = new Uint8Array(BLOCK_SIZE + 4);
  command[0] = CMD_WRITE_FLASH;
  command[1] = (offset >> 8) & 0xFF; // Offset high (Big Endian!)
  command[2] = offset & 0xFF;        // Offset low
  
  // Copy data (max 128 bytes)
  const len = Math.min(BLOCK_SIZE, data.length);
  for (let i = 0; i < len; i++) {
    command[3 + i] = data[i];
  }
  // Pad with 0xFF if less than 128 bytes
  for (let i = len; i < BLOCK_SIZE; i++) {
    command[3 + i] = 0xFF;
  }
  
  command[BLOCK_SIZE + 3] = calcChecksum(command, BLOCK_SIZE + 3);
  
  rt890ReadBuffer = [];
  await rt890Writer.write(command);
  
  const ack = await waitForAck(2000);
  return ack;
}

// Read flash command (128 bytes at a time)
async function readFlash(offset) {
  const command = new Uint8Array(4);
  command[0] = CMD_READ_FLASH;
  command[1] = (offset >> 8) & 0xFF; // Offset high (Big Endian!)
  command[2] = offset & 0xFF;        // Offset low
  command[3] = calcChecksum(command, 3);
  
  rt890ReadBuffer = [];
  await rt890Writer.write(command);
  
  // Response: CMD + offset_hi + offset_lo + 128 bytes + checksum
  const response = await waitForBytes(BLOCK_SIZE + 4, 2000);
  
  if (response[0] === BOOTLOADER_MODE) {
    return null; // In bootloader mode
  }
  
  // Verify checksum
  if (!verifyChecksum(new Uint8Array(response))) {
    throw new Error('Read checksum error');
  }
  
  // Extract data (skip first 3 bytes: cmd + offset)
  return new Uint8Array(response.slice(3, 3 + BLOCK_SIZE));
}

// ========== FLASH FIRMWARE ==========
async function flashRt890Firmware(onProgress) {
  if (!rt890FirmwareData) {
    throw new Error('No firmware loaded');
  }
  
  isRt890Flashing = true;
  rt890ReadBuffer = [];
  
  try {
    // Connect
    await connectRt890();
    await sleep(500);
    
    // Check bootloader mode
    logRt890('Checking bootloader mode...');
    const bootloader = await isBootloaderMode();
    
    if (!bootloader) {
      throw new Error('Radio is NOT in bootloader mode! Turn off, hold PTT, then turn on.');
    }
    
    logRt890('Bootloader mode detected!', 'success');
    
    // Erase flash
    await eraseFlash();
    
    // Calculate total blocks
    const totalBlocks = Math.ceil(rt890FirmwareData.length / BLOCK_SIZE);
    logRt890(`Programming ${totalBlocks} blocks (${rt890FirmwareData.length} bytes)...`);
    
    // Write firmware in 128-byte blocks
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    for (let block = 0; block < totalBlocks; block++) {
      const offset = block * BLOCK_SIZE;
      const blockData = rt890FirmwareData.slice(offset, offset + BLOCK_SIZE);
      
      // Update progress
      const progress = ((block + 1) / totalBlocks) * 100;
      if (onProgress) onProgress(progress);
      
      // Try to write block
      const success = await writeFlash(offset, blockData);
      
      if (!success) {
        retryCount++;
        logRt890(`Block ${block + 1}/${totalBlocks} failed, retry ${retryCount}/${MAX_RETRIES}`, 'error');
        
        if (retryCount > MAX_RETRIES) {
          throw new Error(`Too many errors at block ${block} (offset 0x${offset.toString(16).toUpperCase()})`);
        }
        
        block--; // Retry same block
        await sleep(100);
        continue;
      }
      
      retryCount = 0;
      
      // Log progress every 10 blocks
      if ((block + 1) % 10 === 0 || block === totalBlocks - 1) {
        logRt890(`Block ${block + 1}/${totalBlocks} (0x${offset.toString(16).toUpperCase()}) OK`);
      }
    }
    
    if (onProgress) onProgress(100);
    logRt890('Flash complete! Turn off the radio and turn it back on.', 'success');
    
  } finally {
    isRt890Flashing = false;
    await disconnectRt890();
  }
}

// ========== FIRMWARE LOADING ==========
function setRt890FirmwareBuffer(buf, name = 'firmware.bin') {
  rt890FirmwareData = new Uint8Array(buf);
  rt890FirmwareName = name;
  logRt890(`Firmware loaded: ${name} (${rt890FirmwareData.length} bytes)`, 'success');
}

async function loadRt890FirmwareFromUrl(url, name) {
  try {
    logRt890(`Loading firmware from: ${name}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    setRt890FirmwareBuffer(buffer, name);
    return true;
  } catch (error) {
    logRt890(`Error loading firmware: ${error.message}`, 'error');
    rt890FirmwareData = null;
    rt890FirmwareName = '';
    return false;
  }
}

// ========== EXPORTS ==========
export {
  BAUDRATE_RT890,
  BLOCK_SIZE,
  connectRt890,
  disconnectRt890,
  isBootloaderMode,
  eraseFlash,
  writeFlash,
  readFlash,
  flashRt890Firmware,
  setRt890FirmwareBuffer,
  loadRt890FirmwareFromUrl,
  setRt890Logger,
  logRt890,
  rt890FirmwareData,
  rt890FirmwareName,
  isRt890Flashing
};
