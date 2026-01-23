/**
 * Lock Password Manager (K5 & TK11)
 * K5: Manages 6-digit Power-On Password at 0x0E98-0x0E9B (INT32 Little Endian) in EEPROM
 * TK11: Manages 6-digit Power-On Password at 0x017000 (INT32 Little Endian) in Flash Memory
 */

import { getPort, isConnected, claim, release } from './serial-manager.js';
import { eepromInit, eepromRead, eepromWrite } from './protocol.js';
import { getRadioType } from './radio-selector.js';
import { tk11Init, tk11Read, tk11Write } from './protocol-tk11.js';

// Password Memory Addresses
const K5_PASSWORD_ADDRESS = 0x0E98;   // K5: EEPROM address
const K5_PASSWORD_BLOCK = 0x0E80;     // K5: 64-byte block base
const TK11_PASSWORD_ADDRESS = 0x017000; // TK11: Flash memory address

// UI Elements
let passwordLCD;
let passwordInput;
let readPasswordBtn;
let writePasswordBtn;

// Busy state tracking
let isBusy = false;

/**
 * Get password address based on radio type
 */
function getPasswordAddress() {
  return getRadioType() === 'TK11' ? TK11_PASSWORD_ADDRESS : K5_PASSWORD_ADDRESS;
}

/**
 * Initialize Lock Password module
 */
export function init(updateUICallback) {
  passwordLCD = document.getElementById("passwordLCD");
  passwordInput = document.getElementById("passwordInput");
  readPasswordBtn = document.getElementById("readPasswordBtn");
  writePasswordBtn = document.getElementById("writePasswordBtn");

  // Real-time preview as user types
  if (passwordInput && passwordLCD) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      passwordLCD.textContent = val.padEnd(6, '_').substring(0, 6);
    });
  }

  // Read Password button
  if (readPasswordBtn) {
    readPasswordBtn.addEventListener("click", async () => {
      if (isBusy || !isConnected()) return;
      
      if (!claim("readPassword")) {
        console.log("Serial port is busy.");
        return;
      }
      isBusy = true;
      updateButtonStates(isConnected(), true); // Disable buttons during operation
      
      console.log("[Lock Password] Reading password from radio...");
      window.log("Reading password from radio...", "info");
      try {
        const port = getPort();
        const radioType = getRadioType();
        const passwordAddr = getPasswordAddress();
        
        let buf;
        if (radioType === 'TK11') {
          // TK11: Read from Flash Memory
          console.log(`[Lock Password] Reading from TK11 Flash at 0x${passwordAddr.toString(16).toUpperCase()}`);
          await tk11Init(port);
          buf = await tk11Read(port, passwordAddr, 7);
        } else {
          // K5: Read from EEPROM
          await eepromInit(port);
          console.log(`[Lock Password] Reading from K5 EEPROM at 0x${passwordAddr.toString(16).toUpperCase()}`);
          buf = await eepromRead(port, passwordAddr, 7);
        }
        
        // Check if FF FF FF FF FF FF FF (no password)
        const allFF = buf.every(b => b === 0xFF);
        
        if (allFF) {
          if (passwordLCD) passwordLCD.textContent = '______';
          if (passwordInput) passwordInput.value = '';
          console.log('[Lock Password] ✅ No password (FF FF FF FF FF FF FF)');
          window.log("✅ No password set", "success");
        } else {
          // Convert INT32 Little Endian to number
          const passwordNum = buf[0] | (buf[1] << 8) | (buf[2] << 16) | (buf[3] << 24);
          const passwordStr = passwordNum.toString().padStart(6, '0');
          if (passwordLCD) passwordLCD.textContent = passwordStr;
          if (passwordInput) passwordInput.value = passwordStr;
          console.log(`[Lock Password] ✅ Password: ${passwordStr}`);
          window.log(`✅ Password read: ${passwordStr}`, "success");
        }
      } catch (e) {
        console.log(`[Lock Password] ❌ Read failed: ${e.message}`);
        window.log(`❌ Read failed: ${e.message}`, "error");
      } finally {
        release("readPassword");
        isBusy = false;
        updateButtonStates(isConnected(), false); // Re-enable buttons after operation
      }
    });
  }

  // Write Password button
  if (writePasswordBtn) {
    writePasswordBtn.addEventListener("click", async () => {
      if (isBusy || !isConnected()) return;
      
      // Validate password input
      const password = passwordInput ? passwordInput.value.trim() : '';
      
      // Allow empty (disable password) or exactly 6 digits
      if (password !== '' && (!/^\d{6}$/.test(password))) {
        console.log("[Lock Password] ❌ Password must be exactly 6 digits or empty to disable");
        window.log("❌ Password must be exactly 6 digits or empty to disable", "error");
        return;
      }
      
      if (!claim("writePassword")) {
        console.log("Serial port is busy.");
        return;
      }
      isBusy = true;
      updateButtonStates(isConnected(), true); // Disable buttons during operation
      
      console.log("[Lock Password] Writing password to radio...");
      window.log("Writing password to radio...", "info");
      try {
        const port = getPort();
        const radioType = getRadioType();
        const passwordAddr = getPasswordAddress();
        
        // Prepare password data (7 bytes)
        const passwordBuf = new Uint8Array(7);
        
        if (password === '') {
          // No password: FF FF FF FF FF FF FF
          passwordBuf.fill(0xFF);
        } else {
          // Convert password to INT32 Little Endian
          const passNum = parseInt(password, 10);
          passwordBuf[0] = passNum & 0xFF;
          passwordBuf[1] = (passNum >> 8) & 0xFF;
          passwordBuf[2] = (passNum >> 16) & 0xFF;
          passwordBuf[3] = (passNum >> 24) & 0xFF;
          passwordBuf[4] = 0xFF;
          passwordBuf[5] = 0xFF;
          passwordBuf[6] = 0xFF;
        }
        
        if (radioType === 'TK11') {
          // TK11: Write directly to Flash Memory
          console.log(`[Lock Password] Writing to TK11 Flash at 0x${passwordAddr.toString(16).toUpperCase()}`);
          await tk11Write(port, passwordAddr, passwordBuf);
        } else {
          // K5: READ-MODIFY-WRITE entire 64-byte block (0x0E80-0x0EBF)
          await eepromInit(port);
          console.log(`[Lock Password] Writing to K5 EEPROM block at 0x${K5_PASSWORD_BLOCK.toString(16).toUpperCase()}`);
          const blockBuf = await eepromRead(port, K5_PASSWORD_BLOCK, 64);
          
          // Modify password bytes (offset 24 = 0x0E98 - 0x0E80)
          for (let i = 0; i < 7; i++) {
            blockBuf[24 + i] = passwordBuf[i];
          }
          
          // Write complete 64-byte block
          await eepromWrite(port, K5_PASSWORD_BLOCK, blockBuf, 64);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const msg = password ? `Password ${password} written!` : 'Password disabled!';
        console.log(`[Lock Password] ✅ ${msg}`);
        console.log(`[Lock Password] Please restart your radio to test.`);
        window.log(`✅ ${msg}`, "success");
        window.log("Please restart your radio to test.", "info");
        
      } catch (e) {
        console.log(`[Lock Password] ❌ Write failed: ${e.message}`);
        window.log(`❌ Write failed: ${e.message}`, "error");
      } finally {
        release("writePassword");
        isBusy = false;
        updateButtonStates(isConnected(), false); // Re-enable buttons after operation
      }
    });
  }

  console.log("[Lock Password] Module initialized");
}

/**
 * Update button states based on connection status
 */
export function updateButtonStates(connected, busy) {
  if (readPasswordBtn) readPasswordBtn.disabled = !connected || busy;
  if (writePasswordBtn) writePasswordBtn.disabled = !connected || busy;
}
