/**
 * Unified Radio Protocol Module
 * Supports both UV-K5/K1 (external EEPROM) and TK11 (internal memory)
 */

import * as K5Protocol from './protocol.js';
import * as TK11Protocol from './protocol-tk11.js';
import { getRadioType, getRadioConfig, onRadioTypeChange } from './radio-selector.js';

// Current protocol based on selected radio
let currentProtocol = K5Protocol;

// Update protocol when radio type changes
onRadioTypeChange((type, config) => {
  if (type === 'TK11') {
    currentProtocol = TK11Protocol;
  } else {
    currentProtocol = K5Protocol;
  }
  console.log(`Protocol switched to: ${type}`);
});

// Get current protocol
const getProtocol = () => {
  return getRadioType() === 'TK11' ? TK11Protocol : K5Protocol;
};

// Unified init function
const radioInit = async (port) => {
  const protocol = getProtocol();
  if (getRadioType() === 'TK11') {
    return await protocol.tk11Init(port);
  } else {
    return await protocol.eepromInit(port);
  }
};

// Unified read function
const radioRead = async (port, address, size) => {
  const protocol = getProtocol();
  if (getRadioType() === 'TK11') {
    return await protocol.tk11Read(port, address, size);
  } else {
    return await protocol.eepromRead(port, address, size);
  }
};

// Unified write function
const radioWrite = async (port, address, data, size) => {
  const protocol = getProtocol();
  if (getRadioType() === 'TK11') {
    return await protocol.tk11Write(port, address, data);
  } else {
    return await protocol.eepromWrite(port, address, data, size);
  }
};

// Unified reboot function
const radioReboot = async (port) => {
  const protocol = getProtocol();
  if (getRadioType() === 'TK11') {
    return await protocol.tk11Reboot(port);
  } else {
    return await protocol.eepromReboot(port);
  }
};

// Get block size for current radio
const getBlockSize = () => {
  if (getRadioType() === 'TK11') {
    return TK11Protocol.TK11_MAX_CHUNK_SIZE;
  } else {
    return K5Protocol.EEPROM_BLOCK_SIZE;
  }
};

// Get memory limit for current radio
const getMemoryLimit = () => {
  if (getRadioType() === 'TK11') {
    return TK11Protocol.TK11_MEMORY_LIMIT;
  } else {
    return 0x2000; // K5 default
  }
};

// Read full memory (for backup)
const radioReadFull = async (port, size, onProgress) => {
  const blockSize = getBlockSize();
  const buffer = new Uint8Array(size);
  
  for (let offset = 0; offset < size; offset += blockSize) {
    const readSize = Math.min(blockSize, size - offset);
    const data = await radioRead(port, offset, readSize);
    buffer.set(data.slice(0, readSize), offset);
    
    if (onProgress) {
      onProgress((offset + readSize) / size * 100);
    }
  }
  
  return buffer;
};

// Write full memory (for restore)
const radioWriteFull = async (port, data, onProgress) => {
  const blockSize = getBlockSize();
  
  for (let offset = 0; offset < data.length; offset += blockSize) {
    const chunk = data.slice(offset, offset + blockSize);
    await radioWrite(port, offset, chunk, chunk.length);
    
    if (onProgress) {
      onProgress((offset + chunk.length) / data.length * 100);
    }
  }
  
  return true;
};

export {
  getProtocol,
  radioInit,
  radioRead,
  radioWrite,
  radioReboot,
  getBlockSize,
  getMemoryLimit,
  radioReadFull,
  radioWriteFull,
  // Re-export K5 specific functions for flash
  K5Protocol,
  TK11Protocol
};
