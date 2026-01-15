// dtmf.js
// DTMF Contacts Manager for UV-K5/K1
// Works independently - auto connects to radio
// EEPROM: 0x1C00 - 0x1D00 (256 bytes)

import { eepromRead, eepromWrite } from './protocol.js';
import { connect, claim, release } from './serial-manager.js';

// ========== CONSTANTS ==========
const DTMF_EEPROM = {
  start: 0x1C00,
  end: 0x1D00,
  contactSize: 16,  // 8 bytes name + 8 bytes DTMF ID
  count: 16
};

// Valid DTMF characters
const DTMF_CHARS = '0123456789ABCD*#';

// ========== STATE ==========
let dtmfContacts = [];

// ========== UI ELEMENTS ==========
let dtmfTableBody;
let dtmfReadBtn;
let dtmfWriteBtn;
let dtmfClearAllBtn;

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

// ========== DTMF TABLE ==========
function initDTMFTable() {
  dtmfTableBody = document.getElementById('dtmfTableBody');
  dtmfReadBtn = document.getElementById('dtmfReadBtn');
  dtmfWriteBtn = document.getElementById('dtmfWriteBtn');
  dtmfClearAllBtn = document.getElementById('dtmfClearAllBtn');
  
  // Initialize empty contacts
  dtmfContacts = [];
  for (let i = 0; i < DTMF_EEPROM.count; i++) {
    dtmfContacts.push({
      index: i,
      name: '',
      dtmfId: ''
    });
  }
  
  renderDTMFTable();
}

function renderDTMFTable() {
  if (!dtmfTableBody) return;
  
  dtmfTableBody.innerHTML = '';
  
  dtmfContacts.forEach((contact, i) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="index-col">${i}</td>
      <td>
        <input type="text" 
               id="dtmfName${i}" 
               value="${escapeHtml(contact.name)}" 
               maxlength="8" 
               placeholder="Name"
               data-index="${i}"
               data-field="name">
      </td>
      <td>
        <input type="text" 
               id="dtmfId${i}" 
               value="${escapeHtml(contact.dtmfId)}" 
               maxlength="8" 
               placeholder="DTMF ID"
               data-index="${i}"
               data-field="dtmfId"
               style="text-transform: uppercase;">
      </td>
      <td>
        <button class="clear-btn" data-index="${i}" title="Clear this row">✕</button>
      </td>
    `;
    dtmfTableBody.appendChild(row);
  });
  
  // Add event listeners for inputs
  dtmfTableBody.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', handleInputChange);
    input.addEventListener('blur', handleInputBlur);
  });
  
  // Add event listeners for clear buttons
  dtmfTableBody.querySelectorAll('.clear-btn').forEach(btn => {
    btn.addEventListener('click', handleClearRow);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function handleInputChange(e) {
  const index = parseInt(e.target.dataset.index);
  const field = e.target.dataset.field;
  let value = e.target.value;
  
  // For DTMF ID, validate characters
  if (field === 'dtmfId') {
    value = value.toUpperCase().split('').filter(c => DTMF_CHARS.includes(c)).join('');
    e.target.value = value;
  }
  
  dtmfContacts[index][field] = value;
}

function handleInputBlur(e) {
  // Trim whitespace on blur
  const index = parseInt(e.target.dataset.index);
  const field = e.target.dataset.field;
  dtmfContacts[index][field] = e.target.value.trim();
  e.target.value = dtmfContacts[index][field];
}

function handleClearRow(e) {
  const index = parseInt(e.target.dataset.index);
  dtmfContacts[index].name = '';
  dtmfContacts[index].dtmfId = '';
  
  // Update inputs
  document.getElementById(`dtmfName${index}`).value = '';
  document.getElementById(`dtmfId${index}`).value = '';
}

// ========== EEPROM READ/WRITE ==========
async function readDTMFFromDevice() {
  try {
    // Auto connect
    const port = await connect({ baudRate: 38400 });
    
    claim('dtmf');
    dtmfReadBtn.disabled = true;
    dtmfWriteBtn.disabled = true;
    
    showProgress();
    setStatus('Reading DTMF from 0x1C00-0x1D00...');
    setProgress(0);
    
    // Read 256 bytes (16 contacts x 16 bytes each) in 2 chunks of 128 bytes
    const data = new Uint8Array(256);
    for (let offset = 0; offset < 256; offset += 128) {
      const chunk = await eepromRead(port, DTMF_EEPROM.start + offset, 128);
      data.set(chunk, offset);
      setProgress(((offset + 128) / 256) * 100);
    }
    
    for (let i = 0; i < DTMF_EEPROM.count; i++) {
      const offset = i * 16;
      
      // Check if entry is empty (first byte = 0xFF)
      if (data[offset] === 0xFF) {
        dtmfContacts[i].name = '';
        dtmfContacts[i].dtmfId = '';
        continue;
      }
      
      // Parse name (bytes 0-7)
      let name = '';
      for (let j = 0; j < 8; j++) {
        if (data[offset + j] !== 0x00 && data[offset + j] !== 0xFF) {
          name += String.fromCharCode(data[offset + j]);
        }
      }
      
      // Parse DTMF ID (bytes 8-15)
      let dtmfId = '';
      for (let j = 8; j < 16; j++) {
        if (data[offset + j] !== 0xFF && data[offset + j] < DTMF_CHARS.length) {
          dtmfId += DTMF_CHARS[data[offset + j]];
        }
      }
      
      dtmfContacts[i].name = name.trim();
      dtmfContacts[i].dtmfId = dtmfId;
    }
    
    renderDTMFTable();
    setStatus('DTMF contacts read successfully!');
    console.log('DTMF contacts read from 0x1C00-0x1D00');
    
    setTimeout(() => {
      hideProgress();
      setStatus('');
      setProgress(0);
    }, 2000);
    
  } catch (err) {
    console.error('Error reading DTMF:', err);
    setStatus('Error: ' + err.message);
    setTimeout(() => {
      hideProgress();
      setStatus('');
    }, 3000);
  } finally {
    release('dtmf');
    dtmfReadBtn.disabled = false;
    dtmfWriteBtn.disabled = false;
    dtmfReadBtn.innerHTML = `
      <span class="btn-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </span>
      Read DTMF
    `;
  }
}

async function writeDTMFToDevice() {
  try {
    // Auto connect
    const port = await connect({ baudRate: 38400 });
    
    claim('dtmf');
    dtmfWriteBtn.disabled = true;
    dtmfReadBtn.disabled = true;
    
    showProgress();
    setStatus('Writing DTMF to 0x1C00-0x1D00...');
    setProgress(0);
    
    const buffer = new Uint8Array(256);
    buffer.fill(0xFF);  // Initialize with empty
    
    for (let i = 0; i < DTMF_EEPROM.count; i++) {
      const contact = dtmfContacts[i];
      const offset = i * 16;
      
      if (!contact.name && !contact.dtmfId) {
        continue;  // Leave as 0xFF (empty)
      }
      
      // Write name (bytes 0-7)
      for (let j = 0; j < 8; j++) {
        buffer[offset + j] = j < contact.name.length ? contact.name.charCodeAt(j) : 0x00;
      }
      
      // Write DTMF ID (bytes 8-15)
      for (let j = 0; j < 8; j++) {
        if (j < contact.dtmfId.length) {
          const charIndex = DTMF_CHARS.indexOf(contact.dtmfId[j].toUpperCase());
          buffer[offset + 8 + j] = charIndex >= 0 ? charIndex : 0xFF;
        }
      }
    }
    
    // Write in chunks of 128 bytes
    for (let offset = 0; offset < 256; offset += 128) {
      const chunk = buffer.slice(offset, offset + 128);
      await eepromWrite(port, DTMF_EEPROM.start + offset, chunk, 128);
      setProgress(((offset + 128) / 256) * 100);
    }
    
    setStatus('DTMF contacts written successfully!');
    console.log('DTMF contacts written to 0x1C00-0x1D00');
    
    setTimeout(() => {
      hideProgress();
      setStatus('');
      setProgress(0);
    }, 2000);
    
  } catch (err) {
    console.error('Error writing DTMF:', err);
    setStatus('Error: ' + err.message);
    setTimeout(() => {
      hideProgress();
      setStatus('');
    }, 3000);
  } finally {
    release('dtmf');
    dtmfWriteBtn.disabled = false;
    dtmfReadBtn.disabled = false;
    dtmfWriteBtn.innerHTML = `
      <span class="btn-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </span>
      Write DTMF
    `;
  }
}

function clearAllDTMF() {
  if (!confirm('Clear all DTMF contacts?')) return;
  
  dtmfContacts.forEach(contact => {
    contact.name = '';
    contact.dtmfId = '';
  });
  
  renderDTMFTable();
}

// ========== INITIALIZATION ==========
function init() {
  initDTMFTable();
  
  // Button event listeners
  if (dtmfReadBtn) {
    dtmfReadBtn.addEventListener('click', readDTMFFromDevice);
  }
  if (dtmfWriteBtn) {
    dtmfWriteBtn.addEventListener('click', writeDTMFToDevice);
  }
  if (dtmfClearAllBtn) {
    dtmfClearAllBtn.addEventListener('click', clearAllDTMF);
  }
  
  console.log('DTMF module initialized (EEPROM: 0x1C00-0x1D00)');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { readDTMFFromDevice, writeDTMFToDevice, dtmfContacts };
