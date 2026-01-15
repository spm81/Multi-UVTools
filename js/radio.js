// radio.js
// Radio FM Frequencies Manager for UV-K5/K1
// Works independently - auto connects to radio
// EEPROM: 0x0E40 - 0x0E68 (40 bytes for 20 FM frequencies)

import { eepromRead, eepromWrite, EEPROM_BLOCK_SIZE } from './protocol.js';
import { connect, claim, release } from './serial-manager.js';

// ========== CONSTANTS ==========
const FM_EEPROM = {
  start: 0x0E40,
  end: 0x0E68,
  length: 40  // 20 frequencies x 2 bytes each
};

// FM frequency range (76.0 - 108.0 MHz)
const FM_MIN = 760;
const FM_MAX = 1080;
const FM_COUNT = 20;

// ========== STATE ==========
let fmFrequencies = [];

// ========== UI ELEMENTS ==========
let radioTableBody;
let radioReadBtn;
let radioWriteBtn;
let radioClearAllBtn;

// ========== PROGRESS BAR ==========
const setStatus = (message) => {
  const statusEl = document.getElementById('settingsStatus');
  if (statusEl) statusEl.textContent = message;
};

const setProgress = (percent) => {
  const fillEl = document.getElementById('settingsFill');
  const pctEl = document.getElementById('settingsPct');
  if (fillEl) fillEl.style.width = percent + '%';
  if (pctEl) pctEl.textContent = Math.round(percent) + '%';
};

const showProgress = () => {
  const container = document.querySelector('.status-card .progress');
  if (container) container.style.display = 'block';
};

const hideProgress = () => {
  const container = document.querySelector('.status-card .progress');
  if (container) container.style.display = 'none';
};

// ========== FM TABLE ==========
function initFMTable() {
  radioTableBody = document.getElementById('radioTableBody');
  radioReadBtn = document.getElementById('radioReadBtn');
  radioWriteBtn = document.getElementById('radioWriteBtn');
  radioClearAllBtn = document.getElementById('radioClearAllBtn');
  
  // Initialize empty frequencies
  fmFrequencies = [];
  for (let i = 0; i < FM_COUNT; i++) {
    fmFrequencies.push({
      index: i,
      frequency: null
    });
  }
  
  renderFMTable();
}

function renderFMTable() {
  if (!radioTableBody) return;
  
  radioTableBody.innerHTML = '';
  
  fmFrequencies.forEach((fm, i) => {
    const row = document.createElement('tr');
    const freqDisplay = fm.frequency ? (fm.frequency / 10).toFixed(1) : '';
    row.innerHTML = `
      <td class="index-col">${i + 1}</td>
      <td>
        <input type="number" 
               id="fmFreq${i}" 
               value="${freqDisplay}" 
               min="76.0" 
               max="108.0" 
               step="0.1"
               placeholder="MHz"
               data-index="${i}">
      </td>
      <td>
        <button class="clear-btn" data-index="${i}" title="Clear this frequency">✕</button>
      </td>
    `;
    radioTableBody.appendChild(row);
  });
  
  // Add event listeners
  radioTableBody.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', handleFreqChange);
  });
  
  radioTableBody.querySelectorAll('.clear-btn').forEach(btn => {
    btn.addEventListener('click', handleClearFreq);
  });
}

function handleFreqChange(e) {
  const index = parseInt(e.target.dataset.index);
  const value = parseFloat(e.target.value);
  
  if (isNaN(value) || value < 76.0 || value > 108.0) {
    fmFrequencies[index].frequency = null;
    e.target.value = '';
    return;
  }
  
  // Store as integer (MHz * 10)
  fmFrequencies[index].frequency = Math.round(value * 10);
  e.target.value = (fmFrequencies[index].frequency / 10).toFixed(1);
}

function handleClearFreq(e) {
  const index = parseInt(e.target.dataset.index);
  fmFrequencies[index].frequency = null;
  document.getElementById(`fmFreq${index}`).value = '';
}

// ========== EEPROM READ/WRITE ==========
async function readFMFromDevice() {
  try {
    const port = await connect({ baudRate: 38400 });
    
    claim('radio');
    radioReadBtn.disabled = true;
    radioWriteBtn.disabled = true;
    
    showProgress();
    setStatus('Reading FM from 0x0E40...');
    setProgress(0);
    
    // Read 64 bytes (one block) starting at 0x0E40
    // We only need bytes 0-39 for the 20 FM frequencies
    const data = await eepromRead(port, FM_EEPROM.start, EEPROM_BLOCK_SIZE);
    setProgress(50);
    
    // Parse FM frequencies (little-endian uint16, first 40 bytes)
    for (let i = 0; i < FM_COUNT; i++) {
      const offset = i * 2;
      const value = data[offset] | (data[offset + 1] << 8);
      
      // 0xFFFF means empty/unused
      if (value === 0xFFFF || value < FM_MIN || value > FM_MAX) {
        fmFrequencies[i].frequency = null;
      } else {
        fmFrequencies[i].frequency = value;
      }
    }
    
    setProgress(100);
    renderFMTable();
    setStatus('FM frequencies read successfully!');
    console.log('FM frequencies read from 0x0E40-0x0E68');
    
    setTimeout(() => {
      hideProgress();
      setStatus('');
      setProgress(0);
    }, 2000);
    
  } catch (err) {
    console.error('Error reading FM:', err);
    setStatus('Error: ' + err.message);
    setTimeout(() => {
      hideProgress();
      setStatus('');
    }, 3000);
  } finally {
    release('radio');
    radioReadBtn.disabled = false;
    radioWriteBtn.disabled = false;
    radioReadBtn.innerHTML = `
      <span class="btn-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </span>
      Read Radio FM
    `;
  }
}

async function writeFMToDevice() {
  try {
    const port = await connect({ baudRate: 38400 });
    
    claim('radio');
    radioWriteBtn.disabled = true;
    radioReadBtn.disabled = true;
    
    showProgress();
    setStatus('Reading current EEPROM block...');
    setProgress(0);
    
    // First read the full 64-byte block to preserve bytes 40-63
    const existingData = await eepromRead(port, FM_EEPROM.start, EEPROM_BLOCK_SIZE);
    setProgress(25);
    
    // Create buffer with existing data
    const buffer = new Uint8Array(existingData);
    
    // Update only the first 40 bytes with FM frequencies
    setStatus('Writing FM to 0x0E40...');
    for (let i = 0; i < FM_COUNT; i++) {
      const offset = i * 2;
      const freq = fmFrequencies[i].frequency;
      
      if (freq === null || freq < FM_MIN || freq > FM_MAX) {
        // Empty frequency = 0xFFFF
        buffer[offset] = 0xFF;
        buffer[offset + 1] = 0xFF;
      } else {
        // Little-endian uint16
        buffer[offset] = freq & 0xFF;
        buffer[offset + 1] = (freq >> 8) & 0xFF;
      }
    }
    
    setProgress(50);
    
    // Write the full 64-byte block
    await eepromWrite(port, FM_EEPROM.start, buffer, EEPROM_BLOCK_SIZE);
    
    setProgress(100);
    setStatus('FM frequencies written successfully!');
    console.log('FM frequencies written to 0x0E40-0x0E68');
    
    setTimeout(() => {
      hideProgress();
      setStatus('');
      setProgress(0);
    }, 2000);
    
  } catch (err) {
    console.error('Error writing FM:', err);
    setStatus('Error: ' + err.message);
    setTimeout(() => {
      hideProgress();
      setStatus('');
    }, 3000);
  } finally {
    release('radio');
    radioWriteBtn.disabled = false;
    radioReadBtn.disabled = false;
    radioWriteBtn.innerHTML = `
      <span class="btn-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </span>
      Write Radio FM
    `;
  }
}

function clearAllFM() {
  if (!confirm('Clear all FM frequencies?')) return;
  
  fmFrequencies.forEach(fm => {
    fm.frequency = null;
  });
  
  renderFMTable();
}

// ========== INITIALIZATION ==========
function init() {
  initFMTable();
  
  if (radioReadBtn) {
    radioReadBtn.addEventListener('click', readFMFromDevice);
  }
  if (radioWriteBtn) {
    radioWriteBtn.addEventListener('click', writeFMToDevice);
  }
  if (radioClearAllBtn) {
    radioClearAllBtn.addEventListener('click', clearAllFM);
  }
  
  console.log('Radio FM module initialized (EEPROM: 0x0E40-0x0E68)');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { readFMFromDevice, writeFMToDevice, fmFrequencies };
