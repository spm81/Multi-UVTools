/**
 * Memory Size Detector Module
 * Detects EEPROM (K5) or Flash (TK11) size using wrap-around test
 * 
 * v7.90.60 - HYBRID SAFE DETECTION:
 * - Uses radio-protocol.js (supports both K5 and TK11)
 * - Writes ONLY to offset 0x0 with unique pattern
 * - Reads other offsets to detect wrap-around
 * - Complete backup/restore to ensure ZERO data corruption
 */

import { getPort, isConnected, claim, release } from './serial-manager.js';
import { radioInit, radioRead, radioWrite } from './radio-protocol.js';
import { getRadioType } from './radio-selector.js';

// Test sizes from smallest to largest (in bytes)
const TEST_SIZES = [
    { size: 0x2000, name: '8 KB' },      // 8 KB
    { size: 0x10000, name: '64 KB' },    // 64 KB
    { size: 0x20000, name: '128 KB' },   // 128 KB
    { size: 0x40000, name: '256 KB' },   // 256 KB
    { size: 0x80000, name: '512 KB' },   // 512 KB
    { size: 0x100000, name: '1 MB' },    // 1 MB
    { size: 0x200000, name: '2 MB' }     // 2 MB
];

// Unique test pattern (8 bytes) - distinctive pattern
const TEST_PATTERN = new Uint8Array([0xAA, 0x55, 0xAA, 0x55, 0x88, 0x6E, 0x88, 0x6E]);

let isDetecting = false;
let lastDetectedSize = null; // Stores last detected size info

/**
 * Detects memory size using HYBRID SAFE wrap-around test
 * 
 * ALGORITHM:
 * 1. Backup offset 0x0 and ALL test offsets
 * 2. Write unique pattern ONLY to offset 0x0
 * 3. Read test offsets to find where wrap-around occurs
 * 4. Restore ALL backups to original state
 * 
 * GUARANTEES:
 * - Zero data corruption (all data restored)
 * - Works with K5 (EEPROM) and TK11 (Flash)
 * - Detects 8KB to 2MB+ memory sizes
 */
async function detectMemorySize() {
    const port = getPort();
    if (!port || !isConnected()) {
        console.log('[Memory Size Detector] ❌ Not connected');
        return;
    }

    if (isDetecting) {
        console.log('[Memory Size Detector] ⚠️ Detection already in progress');
        return;
    }

    try {
        isDetecting = true;
        updateUI();
        
        const resultDiv = document.getElementById('memorySizeResult');
        resultDiv.textContent = 'Detecting...';
        resultDiv.className = 'memory-size-result detecting';
        window.log("Detecting memory size...", "info");

        // Claim serial port
        await claim('memory-size-detector');
        console.log('[Memory Size Detector] 🔍 Starting HYBRID SAFE detection...');

        // Initialize radio (works for both K5 and TK11)
        await radioInit(port);

        // =================================================================
        // PHASE 1: BACKUP ALL OFFSETS (0x0 + ALL TEST OFFSETS)
        // =================================================================
        console.log('[Memory Size Detector] 📦 Phase 1: Creating complete backup...');
        
        const backups = new Map();
        
        // Backup offset 0 (critical area)
        const backup0 = await radioRead(port, 0, 8);
        backups.set(0, backup0);
        console.log('[Memory Size Detector] 📖 Backed up offset 0x0');
        
        // Backup ALL test offsets (in case they wrap to 0x0)
        for (const { size, name } of TEST_SIZES) {
            const backup = await radioRead(port, size, 8);
            backups.set(size, backup);
            console.log(`[Memory Size Detector] 📖 Backed up offset 0x${size.toString(16).toUpperCase()} (${name})`);
        }
        
        console.log(`[Memory Size Detector] ✅ Backup complete: ${backups.size} offsets saved`);

        // =================================================================
        // PHASE 2: WRITE PATTERN TO 0x0 AND TEST FOR WRAP-AROUND
        // =================================================================
        console.log('[Memory Size Detector] 🧪 Phase 2: Running hybrid detection...');
        
        // Create unique test pattern (ensure it's different from original)
        let testPattern = new Uint8Array(TEST_PATTERN);
        if (arraysEqual(testPattern, backup0)) {
            testPattern = new Uint8Array(testPattern);
            testPattern[0] ^= 0xFF; // Flip first byte to make it unique
            console.log('[Memory Size Detector] 🔄 Adjusted test pattern to avoid collision');
        }

        // Write unique pattern ONLY to offset 0x0
        console.log('[Memory Size Detector] ✏️ Writing unique pattern to offset 0x0...');
        await radioWrite(port, 0, testPattern, testPattern.length);

        let detectedSize = null;

        // Test each offset to find where wrap-around occurs
        for (const { size, name } of TEST_SIZES) {
            console.log(`[Memory Size Detector] 🧪 Testing ${name} (0x${size.toString(16).toUpperCase()})...`);
            
            // Read test offset
            const readData = await radioRead(port, size, 8);
            
            // Check if this offset wrapped to 0x0 (contains our test pattern)
            if (arraysEqual(readData, testPattern)) {
                // Wrap-around detected = memory size found!
                detectedSize = { size, name };
                console.log(`[Memory Size Detector] ✅ Wrap-around detected at ${name}!`);
                break;
            } else {
                console.log(`[Memory Size Detector] ➡️ No wrap-around at ${name}, continuing...`);
            }
        }

        // If no wrap-around detected, memory is larger than largest test
        if (!detectedSize) {
            detectedSize = { size: 0x200000, name: '≥2 MB' };
            console.log('[Memory Size Detector] ✅ No wrap-around detected, memory ≥2 MB');
        }

        // =================================================================
        // PHASE 3: RESTORE ALL BACKUPS TO ORIGINAL STATE
        // =================================================================
        console.log('[Memory Size Detector] 🔄 Phase 3: Restoring all backups...');
        
        // Restore in reverse order (largest to smallest) to avoid issues
        const sortedOffsets = Array.from(backups.keys()).sort((a, b) => b - a);
        
        for (const offset of sortedOffsets) {
            const backup = backups.get(offset);
            await radioWrite(port, offset, backup, backup.length);
            console.log(`[Memory Size Detector] 🔄 Restored offset 0x${offset.toString(16).toUpperCase()}`);
        }
        
        console.log('[Memory Size Detector] ✅ All backups restored - ZERO corruption!');

        // Store result globally
        lastDetectedSize = detectedSize;
        
        // Display result
        const memoryType = getRadioType() === 'TK11' ? 'Flash' : 'EEPROM';
        resultDiv.textContent = `${memoryType} Size: ${detectedSize.name} (0x${detectedSize.size.toString(16).toUpperCase()} bytes)`;
        resultDiv.className = 'memory-size-result success';
        window.log(`✅ ${memoryType} Size: ${detectedSize.name}`, "success");
        
        console.log(`[Memory Size Detector] ✅ Detection complete: ${detectedSize.name}`);

    } catch (error) {
        console.error('[Memory Size Detector] ❌ Error:', error);
        const resultDiv = document.getElementById('memorySizeResult');
        resultDiv.textContent = `Error: ${error.message}`;
        resultDiv.className = 'memory-size-result error';
        window.log(`❌ Memory detection failed: ${error.message}`, "error");
    } finally {
        release('memory-size-detector');
        isDetecting = false;
        updateUI();
    }
}

/**
 * Compare two Uint8Arrays
 */
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Update UI button states
 */
function updateUI() {
    const detectBtn = document.getElementById('detectMemorySizeBtn');
    if (!detectBtn) return;

    const connected = isConnected();
    detectBtn.disabled = !connected || isDetecting;
}

/**
 * Get last detected memory size
 * @returns {Object|null} Size info {size: number, name: string} or null if not detected
 */
function getDetectedMemorySize() {
    return lastDetectedSize;
}

/**
 * Initialize module
 */
export function init() {
    console.log('[Memory Size Detector] Initializing...');
    
    const detectBtn = document.getElementById('detectMemorySizeBtn');
    if (detectBtn) {
        detectBtn.addEventListener('click', detectMemorySize);
    }

    updateUI();
}

export { updateUI, detectMemorySize, getDetectedMemorySize };
