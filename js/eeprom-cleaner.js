/**
 * EEPROM/Flash Memory Cleaner
 * Fills entire memory with 0xFF except calibration areas
 */

import { getPort, isConnected, claim, release } from './serial-manager.js';
import { eepromInit, eepromRead, eepromWrite } from './protocol.js';
import { getRadioType } from './radio-selector.js';

let isOperating = false;

// Calibration areas (DO NOT ERASE)
const CALIBRATION_AREAS = {
  K5: [
    { start: 0x1E00, end: 0x2000 }  // 512 bytes
  ],
  TK11: [
    { start: 0x010000, end: 0x015010 },  // Area 1: 20 KB
    { start: 0x020000, end: 0x021000 }   // Area 2: 4 KB
  ]
};

const TEST_SIZES_KB = [8, 64, 128, 256, 512, 1024, 2048];

/**
 * Check if address is in calibration area (should be protected)
 */
function isCalibrationArea(address, radioType) {
  const areas = CALIBRATION_AREAS[radioType] || [];
  return areas.some(area => address >= area.start && address < area.end);
}

/**
 * Detect EEPROM/Flash size using wrap-around test
 */
async function detectMemorySize(updateProgressCallback) {
  const port = getPort();
  const radioType = getRadioType();
  const blockSize = 64;
  
  console.log(`[EEPROM Cleaner] Starting memory size detection for ${radioType}...`);
  
  // Initialize radio
  await eepromInit(port);
  
  try {
    // Backup first block
    updateProgressCallback('Backing up data...', 0);
    const originalData = await eepromRead(port, 0, blockSize);
    
    for (let i = 0; i < TEST_SIZES_KB.length; i++) {
      const testSizeKB = TEST_SIZES_KB[i];
      const testSize = testSizeKB * 1024;
      const testAddress = testSize;
      const progress = ((i + 1) / TEST_SIZES_KB.length) * 50; // 0-50%
      
      updateProgressCallback(`Testing ${testSizeKB} KB...`, progress);
      
      // Skip if test address is in calibration area
      if (isCalibrationArea(testAddress, radioType)) {
        console.log(`[EEPROM Cleaner] Skipping ${testSizeKB} KB (in calibration area)`);
        continue;
      }
      
      // Read test address and offset 0
      const testData = await eepromRead(port, testAddress, blockSize);
      const zeroData = await eepromRead(port, 0, blockSize);
      
      // Write test pattern at test address
      const testPattern = new Uint8Array(blockSize);
      for (let j = 0; j < blockSize; j++) {
        testPattern[j] = 0xAA;
      }
      await eepromWrite(port, testAddress, testPattern);
      
      // Read offset 0 again
      const zeroDataAfter = await eepromRead(port, 0, blockSize);
      
      // Restore test address
      await eepromWrite(port, testAddress, testData);
      
      // Check if wrap-around occurred
      let wrapped = false;
      for (let j = 0; j < blockSize; j++) {
        if (zeroData[j] !== zeroDataAfter[j]) {
          wrapped = true;
          break;
        }
      }
      
      if (wrapped) {
        // Restore original data
        await eepromWrite(port, 0, originalData);
        console.log(`[EEPROM Cleaner] Detected size: ${testSizeKB} KB (wrap-around)`);
        return testSize;
      }
    }
    
    // Restore original data
    await eepromWrite(port, 0, originalData);
    
    // No wrap-around detected = max size
    const maxSize = TEST_SIZES_KB[TEST_SIZES_KB.length - 1] * 1024;
    console.log(`[EEPROM Cleaner] Detected size: ${maxSize / 1024} KB (no wrap-around)`);
    return maxSize;
    
  } catch (error) {
    console.error('[EEPROM Cleaner] Detection failed:', error);
    throw error;
  }
}

/**
 * Clean memory (fill with 0xFF except calibration)
 */
async function cleanMemory(memorySize, updateProgressCallback) {
  const port = getPort();
  const radioType = getRadioType();
  const blockSize = 64;
  const totalBlocks = Math.floor(memorySize / blockSize);
  const ffBlock = new Uint8Array(blockSize);
  ffBlock.fill(0xFF);
  
  console.log(`[EEPROM Cleaner] 🧹 Cleaning ${memorySize / 1024} KB (${totalBlocks} blocks)...`);
  console.log(`[EEPROM Cleaner] Memory size: 0x${memorySize.toString(16).toUpperCase()} (${memorySize} bytes)`);
  console.log(`[EEPROM Cleaner] Total blocks: ${totalBlocks} (0x0000 - 0x${(memorySize - 1).toString(16).toUpperCase()})`);
  console.log(`[EEPROM Cleaner] Protecting:`, CALIBRATION_AREAS[radioType]);
  
  let blocksWritten = 0;
  let blocksSkipped = 0;
  let loggedResume = false; // Flag to prevent re-logging
  
  for (let block = 0; block < totalBlocks; block++) {
    const address = block * blockSize;
    
    // Skip calibration areas
    if (isCalibrationArea(address, radioType)) {
      if (blocksSkipped === 0) {
        console.log(`[EEPROM Cleaner] 🛡️ Entering calibration at 0x${address.toString(16).toUpperCase()}`);
      }
      blocksSkipped++;
      continue;
    }
    
    // Log when resuming after calibration (only once)
    if (blocksSkipped > 0 && address > 0x1E00 && !loggedResume) {
      console.log(`[EEPROM Cleaner] ✅ Continuing after calibration at 0x${address.toString(16).toUpperCase()}`);
      loggedResume = true; // Prevent re-logging
    }
    
    // Write 0xFF block
    await eepromWrite(port, address, ffBlock);
    blocksWritten++;
    
    // Update progress (50-100%)
    const progress = 50 + (block / totalBlocks) * 50;
    const addressKB = (address / 1024).toFixed(2);
    const totalKB = (memorySize / 1024).toFixed(2);
    updateProgressCallback(`Writing: ${addressKB} KB / ${totalKB} KB`, progress);
  }
  
  console.log(`[EEPROM Cleaner] ✅ Completed! Written: ${blocksWritten} blocks, Skipped: ${blocksSkipped} blocks`);
  return { blocksWritten, blocksSkipped };
}

/**
 * Main clean operation
 */
async function performClean(updateButtonCallback) {
  if (isOperating) {
    console.log('[EEPROM Cleaner] Already operating, please wait...');
    return;
  }
  
  const radioType = getRadioType();
  const memoryType = radioType === 'TK11' ? 'Flash' : 'EEPROM';
  
  // Confirm with user
  const confirmed = confirm(
    `⚠️ WARNING: This will ERASE all ${memoryType} data except calibration!\n\n` +
    `This operation:\n` +
    `✓ Fills entire ${memoryType} with 0xFF\n` +
    `✓ Protects calibration areas (will NOT erase)\n` +
    `✗ Erases ALL channels, settings, and data\n\n` +
    `Continue?`
  );
  
  if (!confirmed) {
    console.log('[EEPROM Cleaner] Cancelled by user');
    window.log("Operation cancelled by user", "error");
    return;
  }
  
  isOperating = true;
  updateButtonCallback(true);
  
  const statusEl = document.getElementById('cleanerStatus');
  const progressBar = document.getElementById('cleanerProgressBar');
  const progressFill = document.getElementById('cleanerProgressFill');
  
  const updateProgress = (message, percent) => {
    statusEl.textContent = message;
    statusEl.className = 'status-text status-warning';
    progressBar.style.display = 'block';
    progressFill.style.width = `${percent}%`;
  };
  
  try {
    // Claim serial port
    await claim('eeprom-cleaner');
    console.log('[EEPROM Cleaner] 🧹 Starting clean operation...');
    window.log("🧹 Starting memory cleaning...", "info");
    
    // Step 1: Detect size
    updateProgress('Detecting memory size...', 0);
    const memorySize = await detectMemorySize(updateProgress);
    const sizeKB = memorySize / 1024;
    
    console.log(`[EEPROM Cleaner] Detected ${sizeKB} KB ${memoryType}`);
    window.log(`Detected ${sizeKB} KB ${memoryType}`, "info");
    
    // Step 2: Clean memory
    const result = await cleanMemory(memorySize, updateProgress);
    
    // Success
    statusEl.textContent = `✅ ${memoryType} cleaned! (${sizeKB} KB, ${result.blocksWritten} blocks written, ${result.blocksSkipped} blocks protected)`;
    statusEl.className = 'status-text status-success';
    window.log(`✅ ${memoryType} cleaned! ${result.blocksWritten} blocks written`, "success");
    progressFill.style.width = '100%';
    
    setTimeout(() => {
      progressBar.style.display = 'none';
    }, 3000);
    
  } catch (error) {
    console.error('[EEPROM Cleaner] Failed:', error);
    window.log(`❌ Cleaning failed: ${error.message}`, "error");
    statusEl.textContent = `❌ Error: ${error.message}`;
    statusEl.className = 'status-text status-error';
    progressBar.style.display = 'none';
  } finally {
    release();
    isOperating = false;
    updateButtonCallback(false);
  }
}

/**
 * Initialize EEPROM Cleaner module
 */
export function init() {
  const cleanBtn = document.getElementById('cleanEepromBtn');
  
  if (!cleanBtn) {
    console.warn('[EEPROM Cleaner] Button not found');
    return;
  }
  
  cleanBtn.addEventListener('click', () => {
    performClean(updateUI);
  });
  
  console.log('[EEPROM Cleaner] Module initialized');
}

/**
 * Update UI based on connection state
 */
export function updateUI(isConnected, isBusy = false) {
  const cleanBtn = document.getElementById('cleanEepromBtn');
  const statusEl = document.getElementById('cleanerStatus');
  
  if (cleanBtn) {
    cleanBtn.disabled = !isConnected || isBusy || isOperating;
  }
  
  if (statusEl && !isConnected) {
    statusEl.textContent = '';
    statusEl.className = 'status-text';
  }
}
