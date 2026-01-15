// hexview.js
// HEX View for EEPROM memory inspection
// Supports reading from radio and loading .bin files
// Updated to support both UV-K5/K1 and TK11 radios

import { eepromRead, EEPROM_BLOCK_SIZE } from './protocol.js';
import { tk11Read, TK11_MAX_CHUNK_SIZE } from './protocol-tk11.js';
import { connect, claim, release, getPort } from './serial-manager.js';
import { getRadioType, getRadioConfig, onRadioTypeChange } from './radio-selector.js';

// ========== UI ELEMENTS ==========
let hexStartAddr;
let hexLength;
let hexReadBtn;
let hexOutput;
let hexStatus;
let hexFill;
let hexPct;
let hexFileInput;
let hexFileOffset;
let hexFileLength;

// Store loaded file data
let loadedFileData = null;
let loadedFileName = '';

// ========== PROGRESS BAR ==========
const setStatus = (message) => {
  if (hexStatus) hexStatus.textContent = message;
};

const setProgress = (percent) => {
  if (hexFill) hexFill.style.width = percent + '%';
  if (hexPct) hexPct.textContent = Math.round(percent) + '%';
};

// ========== HEX FORMATTING ==========
function formatHexView(data, startAddress) {
  let output = '';
  const bytesPerLine = 16;
  
  // Header
  output += 'Address   00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F   ASCII\n';
  output += '─'.repeat(78) + '\n';
  
  for (let i = 0; i < data.length; i += bytesPerLine) {
    // Address
    const addr = (startAddress + i).toString(16).toUpperCase().padStart(8, '0');
    output += addr + '  ';
    
    // Hex bytes (with gap in middle)
    let ascii = '';
    for (let j = 0; j < bytesPerLine; j++) {
      if (i + j < data.length) {
        const byte = data[i + j];
        output += byte.toString(16).toUpperCase().padStart(2, '0') + ' ';
        // ASCII representation (printable chars only)
        ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
      } else {
        output += '   ';
        ascii += ' ';
      }
      // Add extra space in middle
      if (j === 7) output += ' ';
    }
    
    output += '  ' + ascii + '\n';
  }
  
  return output;
}

function parseAddress(str) {
  str = str.trim();
  if (str.startsWith('0x') || str.startsWith('0X')) {
    return parseInt(str, 16);
  }
  return parseInt(str, 10);
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  } else if (bytes >= 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  }
  return bytes + ' bytes';
}

// ========== READ FROM RADIO ==========
async function readHexFromRadio() {
  try {
    const startAddr = parseAddress(hexStartAddr.value);
    const length = parseInt(hexLength.value);
    const radioType = getRadioType();
    const radioConfig = getRadioConfig();
    
    // Validate address based on radio type
    const maxAddr = radioConfig.memorySize;
    if (isNaN(startAddr) || startAddr < 0 || startAddr > maxAddr) {
      setStatus(`Invalid address. ${radioType} max: 0x${maxAddr.toString(16).toUpperCase()}`);
      return;
    }
    
    const baudRate = radioConfig.defaultBaud;
    const port = await connect({ baudRate });
    
    claim('hexview');
    hexReadBtn.disabled = true;
    
    setStatus(`[${radioType}] Reading ${formatSize(length)} from 0x${startAddr.toString(16).toUpperCase()}...`);
    setProgress(0);
    
    // Choose chunk size based on radio type
    const chunkSize = radioType === 'TK11' ? TK11_MAX_CHUNK_SIZE : EEPROM_BLOCK_SIZE;
    const data = new Uint8Array(length);
    let bytesRead = 0;
    
    for (let offset = 0; offset < length; offset += chunkSize) {
      const readSize = Math.min(chunkSize, length - offset);
      let chunk;
      
      if (radioType === 'TK11') {
        chunk = await tk11Read(port, startAddr + offset, readSize);
      } else {
        chunk = await eepromRead(port, startAddr + offset, readSize);
      }
      
      data.set(chunk.slice(0, readSize), offset);
      bytesRead += readSize;
      setProgress((bytesRead / length) * 100);
    }
    
    // Format and display
    const hexText = formatHexView(data, startAddr);
    hexOutput.textContent = hexText;
    hexOutput.style.display = 'block';
    
    setStatus(`[${radioType}] Read ${formatSize(length)} at 0x${startAddr.toString(16).toUpperCase()}`);
    console.log(`HEX View [${radioType}]: Read ${length} bytes from 0x${startAddr.toString(16).toUpperCase()}`);
    
  } catch (err) {
    console.error('Error reading HEX:', err);
    setStatus('Error: ' + err.message);
  } finally {
    release('hexview');
    hexReadBtn.disabled = false;
  }
}

// ========== LOAD FROM FILE ==========
function loadFile(file) {
  const reader = new FileReader();
  
  setStatus(`Loading ${file.name}...`);
  setProgress(0);
  
  reader.onprogress = (e) => {
    if (e.lengthComputable) {
      setProgress((e.loaded / e.total) * 100);
    }
  };
  
  reader.onload = (e) => {
    loadedFileData = new Uint8Array(e.target.result);
    loadedFileName = file.name;
    
    setProgress(100);
    setStatus(`Loaded ${file.name} (${formatSize(loadedFileData.length)})`);
    
    // Auto-display the file
    displayFileHex();
  };
  
  reader.onerror = () => {
    setStatus('Error loading file');
    setProgress(0);
  };
  
  reader.readAsArrayBuffer(file);
}

function displayFileHex() {
  if (!loadedFileData) {
    setStatus('No file loaded');
    return;
  }
  
  const offset = parseAddress(hexFileOffset.value) || 0;
  let length = parseInt(hexFileLength.value) || 0;
  
  // If length is 0, show entire file (or remaining from offset)
  if (length === 0) {
    length = loadedFileData.length - offset;
  }
  
  // Validate offset
  if (offset < 0 || offset >= loadedFileData.length) {
    setStatus(`Invalid offset. File size: ${formatSize(loadedFileData.length)}`);
    return;
  }
  
  // Clamp length to available data
  const availableLength = Math.min(length, loadedFileData.length - offset);
  
  // Get the slice of data to display
  const viewData = loadedFileData.slice(offset, offset + availableLength);
  
  // Format and display
  const hexText = formatHexView(viewData, offset);
  hexOutput.textContent = hexText;
  hexOutput.style.display = 'block';
  
  setStatus(`${loadedFileName}: Showing ${formatSize(availableLength)} at offset 0x${offset.toString(16).toUpperCase()}`);
}

// ========== INITIALIZATION ==========
function init() {
  // Radio read elements
  hexStartAddr = document.getElementById('hexStartAddr');
  hexLength = document.getElementById('hexLength');
  hexReadBtn = document.getElementById('hexReadBtn');
  hexOutput = document.getElementById('hexOutput');
  hexStatus = document.getElementById('hexStatus');
  hexFill = document.getElementById('hexFill');
  hexPct = document.getElementById('hexPct');
  
  // File load elements
  hexFileInput = document.getElementById('hexFileInput');
  hexFileOffset = document.getElementById('hexFileOffset');
  hexFileLength = document.getElementById('hexFileLength');
  
  // Event listeners
  if (hexReadBtn) {
    hexReadBtn.addEventListener('click', readHexFromRadio);
  }
  
  if (hexFileInput) {
    hexFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        loadFile(file);
      }
    });
  }
  
  // Update display when offset or length changes (for loaded files)
  if (hexFileOffset) {
    hexFileOffset.addEventListener('change', () => {
      if (loadedFileData) displayFileHex();
    });
  }
  
  if (hexFileLength) {
    hexFileLength.addEventListener('change', () => {
      if (loadedFileData) displayFileHex();
    });
  }
  
  console.log('HEX View module initialized');
}

// Update size options based on radio type
function updateSizeOptions() {
  const radioType = getRadioType();
  const radioConfig = getRadioConfig();
  
  if (hexLength) {
    // Clear existing options
    hexLength.innerHTML = '';
    
    if (radioType === 'TK11') {
      // TK11 memory sizes
      hexLength.innerHTML = `
        <option value="143360" selected>140 KB (0x23000) - Full TK11</option>
        <option value="2097152">2 MB (0x200000) - Full Flash</option>
      `;
    } else {
      // K5 memory sizes
      hexLength.innerHTML = `
        <option value="8192" selected>8 KB (64Kbit) (0x2000)</option>
        <option value="65536">64 KB (512Kbit) (0x10000)</option>
        <option value="131072">128 KB (1Mbit) (0x20000)</option>
        <option value="262144">256 KB (2Mbit) (0x40000)</option>
        <option value="524288">512 KB (4Mbit) (0x80000)</option>
      `;
    }
  }
}

// Listen for radio type changes
onRadioTypeChange(() => {
  updateSizeOptions();
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    updateSizeOptions();
  });
} else {
  init();
  updateSizeOptions();
}

export { readHexFromRadio, loadFile, displayFileHex };
