/**
 * Calibration Module for K5 Radio
 * Integrates with the existing serial-manager and protocol modules
 */

import {
  EEPROM_BLOCK_SIZE,
  eepromInit,
  eepromRead,
  eepromWrite,
  eepromReboot,
} from "./protocol.js";

import { 
  getPort, 
  isConnected, 
  claim, 
  release, 
  setFirmwareVersion 
} from "./serial-manager.js";

// Calibration memory addresses
const CAL_START = 0x1E00;
const CAL_END = 0x2000;
const CAL_SIZE = CAL_END - CAL_START; // 512 bytes

// Log function (uses the global log if available)
function log(msg, type = 'info') {
  if (window.log) {
    window.log(msg, type);
  } else {
    console.log(`[Calibration] ${msg}`);
  }
}

// Read calibration from radio
export async function readCalibration() {
  const progress = document.getElementById('calibProgress');
  const fill = document.getElementById('calibFill');
  const pct = document.getElementById('calibPct');
  const status = document.getElementById('calibStatus');
  
  if (!isConnected()) {
    log("Not connected to radio.", "error");
    if (status) status.textContent = 'Error: Not connected to radio';
    return null;
  }
  
  if (!claim("calibRead")) {
    log("Serial port is busy.", "error");
    if (status) status.textContent = 'Error: Serial port is busy';
    return null;
  }
  
  if (progress) progress.style.display = 'block';
  if (status) status.textContent = 'Reading calibration...';
  
  try {
    const port = getPort();
    const firmwareVersion = await eepromInit(port);
    console.log("[Calibration] eepromInit returned:", firmwareVersion);
    setFirmwareVersion(firmwareVersion);
    
    const calibData = new Uint8Array(CAL_SIZE);
    
    for (let offset = 0; offset < CAL_SIZE; offset += EEPROM_BLOCK_SIZE) {
      const chunkSize = Math.min(EEPROM_BLOCK_SIZE, CAL_SIZE - offset);
      const data = await eepromRead(port, CAL_START + offset, chunkSize);
      calibData.set(data.slice(0, chunkSize), offset);
      
      const percent = Math.round(((offset + chunkSize) / CAL_SIZE) * 100);
      if (fill) fill.style.width = percent + '%';
      if (pct) pct.textContent = percent + '%';
    }
    
    log("Calibration read complete.", "success");
    if (status) status.textContent = 'Calibration loaded successfully!';
    
    // Enable write buttons
    const writeBtn = document.getElementById('calibWriteBtn');
    const writeFileBtn = document.getElementById('calibWriteFileBtn');
    if (writeBtn) writeBtn.disabled = false;
    if (writeFileBtn) writeFileBtn.disabled = false;
    
    // Store in window for access by inline script
    window.calibData = calibData;
    
    // Trigger UI update
    if (typeof window.updateAllCalibrationFields === 'function') {
      window.updateAllCalibrationFields();
    }
    
    return calibData;
    
  } catch (e) {
    log(`Read calibration failed: ${e.message}`, "error");
    if (status) status.textContent = 'Error: ' + e.message;
    return null;
  } finally {
    release("calibRead");
  }
}

// Write calibration to radio
export async function writeCalibration() {
  const progress = document.getElementById('calibProgress');
  const fill = document.getElementById('calibFill');
  const pct = document.getElementById('calibPct');
  const status = document.getElementById('calibStatus');
  
  // Get calibData from window (set by inline script)
  const calibData = window.calibData;
  
  if (!calibData) {
    log("No calibration data loaded.", "error");
    if (status) status.textContent = 'Error: No calibration data loaded';
    alert('No calibration data loaded! Please read from radio or load from file first.');
    return false;
  }
  
  if (!isConnected()) {
    log("Not connected to radio.", "error");
    if (status) status.textContent = 'Error: Not connected to radio';
    return false;
  }
  
  // Confirm before writing
  if (!confirm('⚠️ WARNING: Writing calibration data can damage your radio!\n\nThis will overwrite the calibration area (0x1E00 - 0x2000).\n\nAre you sure you want to continue?')) {
    return false;
  }
  
  if (!claim("calibWrite")) {
    log("Serial port is busy.", "error");
    if (status) status.textContent = 'Error: Serial port is busy';
    return false;
  }
  
  if (progress) progress.style.display = 'block';
  if (status) status.textContent = 'Writing calibration...';
  
  try {
    const port = getPort();
    const firmwareVersion = await eepromInit(port);
    console.log("[Calibration] eepromInit returned:", firmwareVersion);
    setFirmwareVersion(firmwareVersion);
    
    // Update calibData from UI fields
    if (typeof window.updateDataFromAllFields === 'function') {
      window.updateDataFromAllFields();
    }
    
    const writeChunkSize = 0x40; // 64 bytes per write
    
    for (let offset = 0; offset < calibData.length; offset += writeChunkSize) {
      const chunk = calibData.slice(offset, offset + writeChunkSize);
      await eepromWrite(port, CAL_START + offset, chunk, chunk.length);
      
      const percent = Math.round(((offset + chunk.length) / calibData.length) * 100);
      if (fill) fill.style.width = percent + '%';
      if (pct) pct.textContent = percent + '%';
    }
    
    // Reboot the radio
    await eepromReboot(port);
    
    log("Calibration write complete. Radio will reboot.", "success");
    if (status) status.textContent = 'Calibration written successfully! Radio rebooting...';
    
    return true;
    
  } catch (e) {
    log(`Write calibration failed: ${e.message}`, "error");
    if (status) status.textContent = 'Error: ' + e.message;
    return false;
  } finally {
    release("calibWrite");
  }
}

// Initialize module and bind to buttons
export function initCalibrationModule() {
  const readBtn = document.getElementById('calibReadBtn');
  const writeBtn = document.getElementById('calibWriteBtn');
  
  if (readBtn) {
    readBtn.addEventListener('click', async () => {
      const data = await readCalibration();
      if (data) {
        window.calibData = data;
        // Update UI
        if (typeof window.updateAllCalibrationFields === 'function') {
          window.updateAllCalibrationFields();
        }
      }
    });
  }
  
  if (writeBtn) {
    writeBtn.addEventListener('click', async () => {
      await writeCalibration();
    });
  }
  
  console.log('[Calibration] Module initialized');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCalibrationModule);
} else {
  initCalibrationModule();
}
