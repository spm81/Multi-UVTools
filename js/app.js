
// Helper function to convert GitHub URLs to jsDelivr (avoids CORS issues)
function convertGitHubUrl(url) {
  // Convert github.com URLs to raw.githubusercontent.com to avoid CORS issues
  // and ensure we can access both /blob/ and /tree/ paths
  
  // Handle /blob/branch/path or /tree/branch/path or /raw/branch/path
  let match = url.match(/https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(blob|tree|raw)\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, type, branch, path] = match;
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
  }
  
  // Handle /raw/refs/heads/branch/path
  match = url.match(/https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/refs\/heads\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, branch, path] = match;
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
  }
  
  return url;
}
import {
  EEPROM_BLOCK_SIZE,
  FLASH_BLOCK_SIZE,
  sendPacket,
  readPacket,
  eepromInit,
  eepromRead,
  eepromWrite,
  eepromReboot,
  unpackFirmware,
  unpackFirmwareVersion,
  flashGenerateCommand,
} from "./protocol.js";
import {
  tk11Init,
  tk11Read,
  tk11Write,
  tk11Reboot,
  TK11_MAX_CHUNK_SIZE,
  TK11_MEMORY_LIMIT,
  TK11_MEMORY_LIMIT_CALIB,
  TK11_CALIB_START,
  TK11_CALIB_END,
  TK11_CALIB_SIZE,
} from "./protocol-tk11.js";
import { connect, disconnect, getPort, subscribe, isConnected, claim, release, getDeviceInfo, setFirmwareVersion } from "./serial-manager.js";
import { getRadioType, getRadioConfig, onRadioTypeChange } from "./radio-selector.js";
import * as LockPassword from "./lock-password.js";
import * as MemorySizeDetector from "./memory-size-detector.js";
import * as EepromCleaner from "./eeprom-cleaner.js";
import { initK5FirmwareDropdown, initK1FirmwareDropdown, initRT890FirmwareDropdown } from "./firmware-loader.js";

// DEV mode state (global for access in onRadioTypeChange)
let devModeEnabled = false;

const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const backupBtn = document.getElementById("backupBtn");
const restoreBtn = document.getElementById("restoreBtn");
const flashBtn = document.getElementById("flashBtn");
const readEepromBtn = document.getElementById("readEepromBtn");
const writeEepromBtn = document.getElementById("writeEepromBtn");
const dumpCalibK5Btn = document.getElementById("dumpCalibK5Btn");
const restoreCalibK5Btn = document.getElementById("restoreCalibK5Btn");
const restoreCalibTK11Btn = document.getElementById("restoreCalibTK11Btn");
const restoreDefaultCalibBtn = document.getElementById("restoreDefaultCalibBtn");

// K5 Lock Password - now handled by lock-password.js module

// TK11 Dev buttons
const dumpCalibTK11Btn = document.getElementById("dumpCalibTK11Btn");
const dumpCalibTK11Fill = document.getElementById("dumpCalibTK11Fill");
const dumpCalibTK11Pct = document.getElementById("dumpCalibTK11Pct");
const devBackupBtnTK11 = document.getElementById("devBackupBtnTK11");
const devRestoreBtnTK11 = document.getElementById("devRestoreBtnTK11");

// K5 Dev buttons
const devBackupBtnK5 = document.getElementById("devBackupBtnK5");
const devRestoreBtnK5 = document.getElementById("devRestoreBtnK5");

// Hex View Dev buttons
const hexDevCompareBtnK5 = document.getElementById("hexDevCompareBtnK5");
const hexDevClearBtnK5 = document.getElementById("hexDevClearBtnK5");
const hexDevCompareBtnTK11 = document.getElementById("hexDevCompareBtnTK11");
const hexDevClearBtnTK11 = document.getElementById("hexDevClearBtnTK11");
const restoreFile = document.getElementById("restoreFile");
const firmwareFile = document.getElementById("firmwareFile");
const readEepromSizeK5 = document.getElementById("readEepromSizeK5");
const readEepromSizeTK11 = document.getElementById("readEepromSizeTK11");
const writeEepromFile = document.getElementById("writeEepromFile");
const restoreCalibK5File = document.getElementById("restoreCalibK5File");
const homeStatusDot = document.getElementById("homeStatusDot");
const connectionLabel = document.getElementById("connectionLabel");
const deviceInfo = document.getElementById("deviceInfo");
const firmwareInfo = document.getElementById("firmwareInfo");
const baudSelect = document.getElementById("baudSelect");
const footerCopyright = document.getElementById("footerCopyright");
const backupFill = document.getElementById("backupFill");
const backupPct = document.getElementById("backupPct");
const restoreFill = document.getElementById("restoreFill");
const restorePct = document.getElementById("restorePct");
const flashFill = document.getElementById("flashFill");
const flashPct = document.getElementById("flashPct");
const readEepromFill = document.getElementById("readEepromFill");
const readEepromPct = document.getElementById("readEepromPct");
const writeEepromFill = document.getElementById("writeEepromFill");
const writeEepromPct = document.getElementById("writeEepromPct");
const dumpCalibK5Fill = document.getElementById("dumpCalibK5Fill");
const dumpCalibK5Pct = document.getElementById("dumpCalibK5Pct");
const restoreCalibK5Fill = document.getElementById("restoreCalibK5Fill");
const restoreCalibK5Pct = document.getElementById("restoreCalibK5Pct");
const logArea = document.getElementById("log");

// Firmware selection elements
const k5FirmwareSelect = document.getElementById("k5FirmwareSelect");
const k1FirmwareSelect = document.getElementById("k1FirmwareSelect");
const k5FirmwareStatus = document.getElementById("k5FirmwareStatus");
const k1FirmwareStatus = document.getElementById("k1FirmwareStatus");
const k1FirmwareFile = document.getElementById("k1FirmwareFile");

// Store selected firmware data
let k5SelectedFirmware = null;

// Update K5 Flash button state based on firmware selection
function updateK5FlashButton() {
  if (flashBtn) {
    const hasFirmware = k5SelectedFirmware !== null;
    flashBtn.disabled = !hasFirmware;
    if (hasFirmware) {
      flashBtn.classList.add("ready");
    } else {
      flashBtn.classList.remove("ready");
    }
  }
}
let k1SelectedFirmware = null;

let isBusy = false;

const log = (msg, tone = "info") => {
  if (!logArea) return;
  const entry = document.createElement("div");
  entry.className = `log-entry log-${tone}`;
  entry.textContent = msg;
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
};

// Make log function globally accessible for all modules
window.log = log;

const setProgress = (fill, pct, value) => {
  const v = Math.max(0, Math.min(100, value));
  if (fill) fill.style.width = `${v}%`;
  if (pct) pct.textContent = `${v.toFixed(1)}%`;
};

// Update Hex Dev Compare buttons based on mode and file selection
function updateHexDevCompareButtons() {
  // K5
  const compareModeK5 = document.getElementById('hexDevCompareModeK5');
  const file1InputK5 = document.getElementById('hexDevFile1K5');
  const file2InputK5 = document.getElementById('hexDevFile2K5');
  const compareBtnK5 = document.getElementById('hexDevCompareBtnK5');
  
  if (compareBtnK5 && compareModeK5 && file1InputK5 && file2InputK5) {
    const mode = compareModeK5.value;
    const hasFile1 = file1InputK5.files && file1InputK5.files.length > 0;
    const hasFile2 = file2InputK5.files && file2InputK5.files.length > 0;
    
    if (mode === 'files') {
      // Compare Files: needs both files + not busy
      compareBtnK5.disabled = !hasFile1 || !hasFile2 || isBusy;
    } else {
      // Compare with Radio: needs file1 + connected + not busy
      compareBtnK5.disabled = !hasFile1 || !isConnected() || isBusy;
    }
  }
  
  // TK11
  const compareModeTK11 = document.getElementById('hexDevCompareModeTK11');
  const file1InputTK11 = document.getElementById('hexDevFile1TK11');
  const file2InputTK11 = document.getElementById('hexDevFile2TK11');
  const compareBtnTK11 = document.getElementById('hexDevCompareBtnTK11');
  
  if (compareBtnTK11 && compareModeTK11 && file1InputTK11 && file2InputTK11) {
    const mode = compareModeTK11.value;
    const hasFile1 = file1InputTK11.files && file1InputTK11.files.length > 0;
    const hasFile2 = file2InputTK11.files && file2InputTK11.files.length > 0;
    
    if (mode === 'files') {
      // Compare Files: needs both files + not busy
      compareBtnTK11.disabled = !hasFile1 || !hasFile2 || isBusy;
    } else {
      // Compare with Radio: needs file1 + connected + not busy
      compareBtnTK11.disabled = !hasFile1 || !isConnected() || isBusy;
    }
  }
}

const updateUI = (connected, firmware = "-") => {
  if (homeStatusDot) homeStatusDot.dataset.status = connected ? "connected" : "disconnected";
  if (connectionLabel) connectionLabel.textContent = connected ? "Connected" : "Disconnected";
  if (connectBtn) connectBtn.disabled = connected || isBusy;
  if (disconnectBtn) disconnectBtn.disabled = !connected || isBusy;
  if (backupBtn) backupBtn.disabled = !connected || isBusy;
  if (restoreBtn) restoreBtn.disabled = !connected || isBusy;
  if (flashBtn) flashBtn.disabled = isBusy;
  if (readEepromBtn) readEepromBtn.disabled = !connected || isBusy;
  if (writeEepromBtn) writeEepromBtn.disabled = !connected || isBusy;
  if (dumpCalibK5Btn) dumpCalibK5Btn.disabled = !connected || isBusy;
  if (restoreCalibK5Btn) restoreCalibK5Btn.disabled = !connected || isBusy;
  if (restoreCalibTK11Btn) restoreCalibTK11Btn.disabled = !connected || isBusy;
  if (restoreDefaultCalibBtn) restoreDefaultCalibBtn.disabled = !connected || isBusy;
  if (dumpCalibTK11Btn) dumpCalibTK11Btn.disabled = !connected || isBusy;
  if (devBackupBtnK5) devBackupBtnK5.disabled = !connected || isBusy;
  if (devRestoreBtnK5) devRestoreBtnK5.disabled = !connected || isBusy;
  if (devBackupBtnTK11) devBackupBtnTK11.disabled = !connected || isBusy;
  if (devRestoreBtnTK11) devRestoreBtnTK11.disabled = !connected || isBusy;
  if (hexDevClearBtnK5) hexDevClearBtnK5.disabled = !connected || isBusy;
  if (hexDevClearBtnTK11) hexDevClearBtnTK11.disabled = !connected || isBusy;
  
  // Update Lock Password buttons (K5 only)
  LockPassword.updateButtonStates(connected, isBusy);
  
  // Update Memory Size Detector button (K5 & TK11)
  MemorySizeDetector.updateUI();
  
  // Update EEPROM Cleaner button (K5 & TK11)
  EepromCleaner.updateUI(connected, isBusy);
  
  // Update Hex Dev Compare buttons with proper logic
  updateHexDevCompareButtons();
};

subscribe((state) => {
  updateUI(state.connected, state.firmwareVersion);
  if (deviceInfo) {
    if (state.connected) {
      const devInfo = getDeviceInfo();
      let displayText = devInfo && devInfo.formatted ? devInfo.formatted : "Port open";
      // Show firmware version in Home card (K5 & TK11)
      if (state.firmwareVersion) {
        displayText += ` - ${state.firmwareVersion}`;
      }
      deviceInfo.textContent = displayText;
      // Show firmware in separate field
      if (firmwareInfo) firmwareInfo.textContent = state.firmwareVersion || "-";
    } else {
      deviceInfo.textContent = "No port";
      if (firmwareInfo) firmwareInfo.textContent = "-";
    }
  }
});

const getConnectedPort = async () => {
  if (!isConnected()) {
    const radioConfig = getRadioConfig();
    const baud = parseInt(baudSelect?.value || radioConfig.defaultBaud.toString(), 10);
    await connect(baud);
  }
  return getPort();
};

const doDisconnect = async () => {
  await disconnect();
};

// Helper to get block size based on radio type
const getBlockSize = () => {
  return getRadioType() === 'TK11' ? TK11_MAX_CHUNK_SIZE : EEPROM_BLOCK_SIZE;
};

// Helper to initialize radio connection
const initRadio = async (port) => {
  if (getRadioType() === 'TK11') {
    return await tk11Init(port);
  } else {
    return await eepromInit(port);
  }
};

// Helper to read from radio
const readRadio = async (port, address, size) => {
  if (getRadioType() === 'TK11') {
    return await tk11Read(port, address, size);
  } else {
    return await eepromRead(port, address, size);
  }
};

// Helper to write to radio
const writeRadio = async (port, address, data, size) => {
  if (getRadioType() === 'TK11') {
    return await tk11Write(port, address, data);
  } else {
    return await eepromWrite(port, address, data, size);
  }
};

// Helper to reboot radio
const rebootRadio = async (port) => {
  if (getRadioType() === 'TK11') {
    return await tk11Reboot(port);
  } else {
    return await eepromReboot(port);
  }
};

if (connectBtn) {
  connectBtn.addEventListener("click", async () => {
    if (isBusy) return;
    isBusy = true;
    updateUI(false);
    log("Connecting...");
    try {
      await getConnectedPort();
      log("Connected.", "success");
      
      // Auto-detect baud rate and read firmware (K5 only)
      const port = getPort();
      if (getRadioType() === "K5") {
        try {
          console.log("[app.js] 🔧 Connect: Auto-detecting baud rate...");
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Import detectBaudRate from serial-manager
          const { detectBaudRate } = await import('./serial-manager.js');
          const result = await detectBaudRate([38400, 115200]);
          
          console.log(`[app.js] ✅ Connect: Success at ${result.baudRate} baud`);
          log(`✅ Connected at ${result.baudRate} baud`, "success");
        } catch (e) {
          console.warn("[app.js] ⚠️ Connect: Auto-detection FAILED:", e.message);
          log("⚠️ Could not detect baud rate", "error");
          setFirmwareVersion("-");
        }
      }
    } catch (e) {
      log(`Connect failed: ${e.message}`, "error");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

if (disconnectBtn) {
  disconnectBtn.addEventListener("click", async () => {
    if (isBusy) return;
    isBusy = true;
    updateUI(true);
    try {
      await doDisconnect();
      log("Disconnected.");
    } catch (e) {
      log(`Disconnect failed: ${e.message}`, "error");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

const backupRange = async (start, length) => {
  if (!claim("backup")) {
    throw new Error("Serial port is busy.");
  }
  try {
    const port = await getConnectedPort();
    const radioType = getRadioType();
    const blockSize = getBlockSize();
    
    log(`[${radioType}] Initializing...`);
    const firmwareVersion = await initRadio(port);
    console.log("[app.js] 🔍 firmwareVersion =", firmwareVersion, "| radioType =", getRadioType());
    if (getRadioType() === "K5") {
      console.log("[app.js] ➡️ Calling setFirmwareVersion...");
      setFirmwareVersion(firmwareVersion);
    }
    
    const buffer = new Uint8Array(length);
    for (let offset = 0; offset < length; offset += blockSize) {
      const size = Math.min(blockSize, length - offset);
      const data = await readRadio(port, start + offset, size);
      buffer.set(data.slice(0, size), offset);
      setProgress(backupFill, backupPct, ((offset + size) / length) * 100);
    }
    return buffer;
  } finally {
    release("backup");
  }
};

const restoreRange = async (start, data) => {
  if (!claim("restore")) {
    throw new Error("Serial port is busy.");
  }
  try {
    const port = await getConnectedPort();
    const radioType = getRadioType();
    const blockSize = getBlockSize();
    
    log(`[${radioType}] Initializing...`);
    const firmwareVersion = await initRadio(port);
    console.log("[app.js] 🔍 firmwareVersion =", firmwareVersion, "| radioType =", getRadioType());
    if (getRadioType() === "K5") {
      console.log("[app.js] ➡️ Calling setFirmwareVersion...");
      setFirmwareVersion(firmwareVersion);
    }
    
    for (let offset = 0; offset < data.length; offset += blockSize) {
      const chunk = data.slice(offset, offset + blockSize);
      await writeRadio(port, start + offset, chunk, chunk.length);
      setProgress(restoreFill, restorePct, ((offset + chunk.length) / data.length) * 100);
    }
    
    log(`[${radioType}] Rebooting...`);
    await rebootRadio(port);
  } finally {
    release("restore");
  }
};

if (backupBtn) {
  backupBtn.addEventListener("click", async () => {
    if (isBusy || !isConnected()) return;
    isBusy = true;
    updateUI(true);
    setProgress(backupFill, backupPct, 0);
    
    const radioType = getRadioType();
    const radioConfig = getRadioConfig();
    log(`[${radioType}] Starting memory backup...`);
    
    try {
      let length;
      if (radioType === 'TK11') {
        // TK11: Always backup without calibration (0x09FFFF)
        length = TK11_MEMORY_LIMIT;
        log(`[TK11] Backup mode: WITHOUT calibration (0x09FFFF)`);
      } else {
        // K5: Auto-detect memory size and backup everything
        log(`[K5] 🔍 Auto-detecting memory size...`, "info");
        await MemorySizeDetector.detectMemorySize();
        const detectedSize = MemorySizeDetector.getDetectedMemorySize();
        
        if (!detectedSize) {
          throw new Error('Failed to detect memory size');
        }
        
        length = detectedSize.size;
        log(`[K5] ✅ Detected ${detectedSize.name} (0x${length.toString(16).toUpperCase()})`, "success");
      }
      
      const buffer = await backupRange(0, length);
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${radioType.toLowerCase()}_backup_${Date.now()}.bin`;
      a.click();
      URL.revokeObjectURL(url);
      
      // Show size in KB or MB
      const sizeKB = (length / 1024).toFixed(2);
      const sizeMB = (length / (1024 * 1024)).toFixed(2);
      const sizeStr = length >= 1048576 ? `${sizeMB} MB` : `${sizeKB} KB`;
      log(`[${radioType}] ✅ Backup complete! Size: ${sizeStr} (${length} bytes)`, "success");
    } catch (e) {
      log(`Backup failed: ${e.message}`, "error");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

if (restoreBtn) {
  restoreBtn.addEventListener("click", async () => {
    if (isBusy || !isConnected()) return;
    const file = restoreFile?.files[0];
    if (!file) {
      log("No file selected.", "error");
      return;
    }
    isBusy = true;
    updateUI(true);
    setProgress(restoreFill, restorePct, 0);
    
    const radioType = getRadioType();
    log(`[${radioType}] Starting memory restore...`);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      let length;
      
      if (radioType === 'TK11') {
        // TK11: Always restore without calibration (0x09FFFF)
        length = Math.min(data.length, TK11_MEMORY_LIMIT);
        log(`[TK11] Restore mode: WITHOUT calibration (0x09FFFF)`);
      } else {
        // K5: Write entire file
        length = data.length;
        log(`[K5] Writing complete file (${(length / 1024).toFixed(2)} KB)`);
      }
      
      await restoreRange(0, data.slice(0, length));
      log(`[${radioType}] Restore complete.`, "success");
    } catch (e) {
      log(`Restore failed: ${e.message}`, "error");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

// Official version packet for K5 bootloader
const OFFICIAL_VERSION_PACKET = new Uint8Array([
  48, 5, 16, 0, 42, 79, 69, 70, 87, 45, 76, 79, 83, 69, 72, 85, 0, 0, 0, 0,
]);

if (flashBtn) {
  flashBtn.addEventListener("click", async () => {
    // Check for pre-selected firmware or file upload
    let firmwareEncoded = k5SelectedFirmware;
    if (!firmwareEncoded) {
      log("No firmware selected. Choose from the list or upload a file.", "error");
      return;
    }
    if (isBusy) return;
    isBusy = true;
    updateUI(isConnected());
    setProgress(flashFill, flashPct, 0);
    
    if (!claim("flash")) {
      log("Serial port is busy.", "error");
      isBusy = false;
      updateUI(isConnected());
      return;
    }
    
    let port = null;
    try {
      // K5 flash MUST use 38400 baud - this is hardcoded in the bootloader
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 38400 });
      
      setProgress(flashFill, flashPct, 0);
      log("Waiting for bootloader... (PTT + Power On)");
      
      // Wait for bootloader message (0x18)
      await readPacket(port, 0x18, 10000);
      log("Bootloader detected!");
      
      // Extract and show firmware version
      const rawVersion = unpackFirmwareVersion(firmwareEncoded);
      const versionText = new TextDecoder().decode(rawVersion).replace(/\0.*$/, "");
      log(`Firmware version: ${versionText || "unknown"}`);
      
      // Send official version packet
      await sendPacket(port, OFFICIAL_VERSION_PACKET);
      await readPacket(port, 0x18, 3000);
      
      // Unpack firmware (decode XOR and remove version info)
      const firmware = unpackFirmware(firmwareEncoded);
      if (firmware.length > 0xf000) {
        throw new Error("Firmware size too large for official flashing.");
      }
      
      log(`Writing ${firmware.length} bytes...`);
      const totalBlocks = Math.ceil(firmware.length / FLASH_BLOCK_SIZE);
      
      for (let i = 0; i < firmware.length; i += FLASH_BLOCK_SIZE) {
        const data = firmware.slice(i, i + FLASH_BLOCK_SIZE);
        const command = flashGenerateCommand(data, i, firmware.length);
        await sendPacket(port, command);
        await readPacket(port, 0x1a, 3000);
        
        const pct = ((i + FLASH_BLOCK_SIZE) / firmware.length) * 100;
        setProgress(flashFill, flashPct, Math.min(pct, 100));
        
        const blockNum = Math.floor(i / FLASH_BLOCK_SIZE) + 1;
        if (blockNum % 20 === 0 || i + FLASH_BLOCK_SIZE >= firmware.length) {
          log(`Block ${blockNum}/${totalBlocks}`);
        }
      }
      
      setProgress(flashFill, flashPct, 100);
      log("Firmware programmed successfully! Radio will reboot.", "success");
      
    } catch (e) {
      log(`Flash failed: ${e.message}`, "error");
      console.error('Flash error:', e);
    } finally {
      if (port) {
        try { await port.close(); } catch {}
      }
      release("flash");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

// Read EEPROM (full) - Works with K5/K1 and TK11
if (readEepromBtn) {
  readEepromBtn.addEventListener("click", async () => {
    if (isBusy || !isConnected()) return;
    if (!claim("readEeprom")) {
      log("Serial port is busy.", "error");
      return;
    }
    isBusy = true;
    updateUI(true);
    setProgress(readEepromFill, readEepromPct, 0);
    
    const radioType = getRadioType();
    const readEepromSize = radioType === 'TK11' ? readEepromSizeTK11 : readEepromSizeK5;
    const size = parseInt(readEepromSize?.value || "8192", 10);
    const blockSize = getBlockSize();  // Uses TK11_MAX_CHUNK_SIZE for TK11
    
    log(`Reading ${size / 1024} KB from ${radioType}...`);
    try {
      const port = getPort();
      const firmwareVersion = await initRadio(port);  // Uses tk11Init for TK11
      console.log("[app.js] 🔍 firmwareVersion =", firmwareVersion, "| radioType =", getRadioType());
      if (getRadioType() === "K5") {
        console.log("[app.js] ➡️ Calling setFirmwareVersion...");
        setFirmwareVersion(firmwareVersion);
      }
      const buffer = new Uint8Array(size);
      
      for (let offset = 0; offset < size; offset += blockSize) {
        const chunkSize = Math.min(blockSize, size - offset);
        const data = await readRadio(port, offset, chunkSize);  // Uses tk11Read for TK11
        buffer.set(data.slice(0, chunkSize), offset);
        setProgress(readEepromFill, readEepromPct, ((offset + chunkSize) / size) * 100);
      }
      
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${radioType}_memory_${size / 1024}KB_${Date.now()}.bin`;
      a.click();
      URL.revokeObjectURL(url);
      log(`Read ${radioType} memory complete.`, "success");
    } catch (e) {
      log(`Read failed: ${e.message}`, "error");
    } finally {
      release("readEeprom");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

// Write EEPROM (full) - Works with K5/K1 and TK11
if (writeEepromBtn) {
  writeEepromBtn.addEventListener("click", async () => {
    if (isBusy || !isConnected()) return;
    const file = writeEepromFile?.files[0];
    if (!file) {
      log("No file selected.", "error");
      return;
    }
    if (!claim("writeEeprom")) {
      log("Serial port is busy.", "error");
      return;
    }
    isBusy = true;
    updateUI(true);
    setProgress(writeEepromFill, writeEepromPct, 0);
    
    const radioType = getRadioType();
    const blockSize = getBlockSize();  // Uses TK11_MAX_CHUNK_SIZE for TK11
    
    log(`Writing to ${radioType} from file (${(file.size / 1024).toFixed(1)} KB)...`);
    try {
      const port = getPort();
      const firmwareVersion = await initRadio(port);  // Uses tk11Init for TK11
      console.log("[app.js] 🔍 firmwareVersion =", firmwareVersion, "| radioType =", getRadioType());
      if (getRadioType() === "K5") {
        console.log("[app.js] ➡️ Calling setFirmwareVersion...");
        setFirmwareVersion(firmwareVersion);
      }
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      for (let offset = 0; offset < data.length; offset += blockSize) {
        const chunk = data.slice(offset, offset + blockSize);
        await writeRadio(port, offset, chunk, chunk.length);  // Uses tk11Write for TK11
        setProgress(writeEepromFill, writeEepromPct, ((offset + chunk.length) / data.length) * 100);
      }
      
      await rebootRadio(port);  // Uses tk11Reboot for TK11
      log(`Write ${radioType} memory complete.`, "success");
    } catch (e) {
      log(`Write failed: ${e.message}`, "error");
    } finally {
      release("writeEeprom");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

// Dump Calibration K5
if (dumpCalibK5Btn) {
  dumpCalibK5Btn.addEventListener("click", async () => {
    if (isBusy || !isConnected()) return;
    if (!claim("dumpCalib")) {
      log("Serial port is busy.", "error");
      return;
    }
    isBusy = true;
    updateUI(true);
    setProgress(dumpCalibK5Fill, dumpCalibK5Pct, 0);
    log("Dumping calibration (0x1E00 - 0x2000)...");
    try {
      const port = getPort();
      const firmwareVersion = await eepromInit(port);
      console.log("[app.js] 🔍 eepromInit returned:", firmwareVersion);
      setFirmwareVersion(firmwareVersion);
      const buffer = new Uint8Array(0x200);
      for (let offset = 0; offset < 0x200; offset += EEPROM_BLOCK_SIZE) {
        const chunkSize = Math.min(EEPROM_BLOCK_SIZE, 0x200 - offset);
        const data = await eepromRead(port, 0x1e00 + offset, chunkSize);
        buffer.set(data.slice(0, chunkSize), offset);
        setProgress(dumpCalibK5Fill, dumpCalibK5Pct, ((offset + chunkSize) / 0x200) * 100);
      }
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `calibration_${Date.now()}.bin`;
      a.click();
      URL.revokeObjectURL(url);
      log("Calibration dump complete.", "success");
    } catch (e) {
      log(`Dump calibration failed: ${e.message}`, "error");
    } finally {
      release("dumpCalib");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

// Restore Calibration K5
if (restoreCalibK5Btn) {
  restoreCalibK5Btn.addEventListener("click", async () => {
    if (isBusy || !isConnected()) return;
    const file = restoreCalibK5File?.files[0];
    if (!file) {
      log("No calibration file selected.", "error");
      return;
    }
    if (file.size !== 0x200) {
      log(`Invalid calibration file size: expected 512 bytes, got ${file.size}`, "error");
      return;
    }
    if (!claim("restoreCalib")) {
      log("Serial port is busy.", "error");
      return;
    }
    isBusy = true;
    updateUI(true);
    setProgress(restoreCalibK5Fill, restoreCalibK5Pct, 0);
    log("Restoring calibration...");
    try {
      const port = getPort();
      const firmwareVersion = await eepromInit(port);
      console.log("[app.js] 🔍 eepromInit returned:", firmwareVersion);
      setFirmwareVersion(firmwareVersion);
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      for (let offset = 0; offset < data.length; offset += 0x40) {
        const chunk = data.slice(offset, offset + 0x40);
        await eepromWrite(port, 0x1e00 + offset, chunk, chunk.length);
        setProgress(restoreCalibK5Fill, restoreCalibK5Pct, ((offset + chunk.length) / data.length) * 100);
      }
      await eepromReboot(port);
      log("Calibration restore complete.", "success");
    } catch (e) {
      log(`Restore calibration failed: ${e.message}`, "error");
    } finally {
      release("restoreCalib");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

// ========== TK11 Calibration Functions ==========

// Dump Calibration TK11

if (dumpCalibTK11Btn) {
  dumpCalibTK11Btn.addEventListener("click", async () => {
    if (isBusy || !isConnected()) return;
    if (getRadioType() !== 'TK11') {
      log('This function is for TK11 only', 'error');
      return;
    }
    if (!claim("dumpCalibTK11")) {
      log("Serial port is busy.", "error");
      return;
    }
    isBusy = true;
    updateUI(true);
    setProgress(dumpCalibTK11Fill, dumpCalibTK11Pct, 0);
    log("[TK11] Dumping calibration (0x0A0000 - 0x0A1000)...");
    try {
      const port = getPort();
      await tk11Init(port);
      const buffer = new Uint8Array(TK11_CALIB_SIZE); // 69632 bytes (68 KB)
      for (let offset = 0; offset < TK11_CALIB_SIZE; offset += TK11_MAX_CHUNK_SIZE) {
        const chunkSize = Math.min(TK11_MAX_CHUNK_SIZE, TK11_CALIB_SIZE - offset);
        const data = await tk11Read(port, TK11_CALIB_START + offset, chunkSize);
        buffer.set(data.slice(0, chunkSize), offset);
        setProgress(dumpCalibTK11Fill, dumpCalibTK11Pct, ((offset + chunkSize) / TK11_CALIB_SIZE) * 100);
      }
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TK11_calibration_${Date.now()}.bin`;
      a.click();
      URL.revokeObjectURL(url);
      log("[TK11] Calibration dump complete (69632 bytes = 68 KB).", "success");
    } catch (e) {
      log(`[TK11] Dump calibration failed: ${e.message}`, "error");
    } finally {
      release("dumpCalibTK11");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

// Restore Calibration TK11
const restoreCalibTK11File = document.getElementById("restoreCalibTK11File");
const restoreCalibTK11Fill = document.getElementById("restoreCalibTK11Fill");
const restoreCalibTK11Pct = document.getElementById("restoreCalibTK11Pct");

if (restoreCalibTK11Btn) {
  restoreCalibTK11Btn.addEventListener("click", async () => {
    if (isBusy || !isConnected()) return;
    if (getRadioType() !== 'TK11') {
      log('This function is for TK11 only', 'error');
      return;
    }
    const file = restoreCalibTK11File?.files[0];
    if (!file) {
      log("[TK11] No calibration file selected.", "error");
      return;
    }
    if (file.size !== TK11_CALIB_SIZE) {
      log(`[TK11] Invalid calibration file size: expected ${TK11_CALIB_SIZE} bytes (68 KB), got ${file.size}`, "error");
      return;
    }
    if (!claim("restoreCalibTK11")) {
      log("Serial port is busy.", "error");
      return;
    }
    isBusy = true;
    updateUI(true);
    setProgress(restoreCalibTK11Fill, restoreCalibTK11Pct, 0);
    log("[TK11] Restoring calibration (0x0A0000 - 0x0A1000)...");
    try {
      const port = getPort();
      await tk11Init(port);
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      for (let offset = 0; offset < data.length; offset += 0x40) {
        const chunk = data.slice(offset, offset + 0x40);
        await tk11Write(port, TK11_CALIB_START + offset, chunk, chunk.length);
        setProgress(restoreCalibTK11Fill, restoreCalibTK11Pct, ((offset + chunk.length) / data.length) * 100);
      }
      await tk11Reboot(port);
      log("[TK11] Calibration restore complete (69632 bytes = 68 KB).", "success");
    } catch (e) {
      log(`[TK11] Restore calibration failed: ${e.message}`, "error");
    } finally {
      release("restoreCalibTK11");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

// ========== Firmware Selection Logic ==========

// K5 Firmware Selection
if (k5FirmwareSelect) {
  k5FirmwareSelect.addEventListener("change", async (e) => {
    const path = e.target.value;
    if (!path) {
      k5SelectedFirmware = null;
      updateK5FlashButton();
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = "No firmware selected";
      return;
    }
    try {
      log(`[K5] Loading firmware from: ${e.target.options[e.target.selectedIndex].text}...`);
      
      // Check if it's a GitHub Release URL (needs special handling)
      if (path.includes('/releases/download/')) {
        log('[K5] Detected GitHub Release URL - using API loader');
        k5SelectedFirmware = await loadFirmwareWithCORS(path);
        updateK5FlashButton();
        const name = path.split('/').pop();
        if (k5FirmwareStatus) k5FirmwareStatus.textContent = `Selected: ${name} (${k5SelectedFirmware.length} bytes)`;
        log(`[K5] ✅ Firmware loaded: ${k5SelectedFirmware.length} bytes`);
      } else {
        // Regular URL or GitHub repository file
        let fetchUrl = path;
        if (path.startsWith('http://') || path.startsWith('https://')) {
          fetchUrl = convertGitHubUrl(path);
          if (fetchUrl !== path) {
            log(`Converted GitHub URL to: ${fetchUrl}`);
          }
        }
        
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Failed to load firmware");
        const buffer = await response.arrayBuffer();
        k5SelectedFirmware = new Uint8Array(buffer);
        updateK5FlashButton();
        const name = path.split('/').pop();
        if (k5FirmwareStatus) k5FirmwareStatus.textContent = `Selected: ${name} (${k5SelectedFirmware.length} bytes)`;
        log(`[K5] ✅ Firmware loaded: ${k5SelectedFirmware.length} bytes`);
      }
      
      // Clear file input when selecting from dropdown
      if (firmwareFile) firmwareFile.value = "";
    } catch (err) {
      k5SelectedFirmware = null;
      updateK5FlashButton();
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = "Failed to load firmware";
      log(`Error loading firmware: ${err.message}`, "error");
    }
  });
}

// K5 File input (custom firmware)
if (firmwareFile) {
  firmwareFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) {
      k5SelectedFirmware = null;
      updateK5FlashButton();
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = "No firmware selected";
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      k5SelectedFirmware = new Uint8Array(buffer);
      updateK5FlashButton();
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = `Selected: ${file.name} (${k5SelectedFirmware.length} bytes)`;
      // Clear dropdown when selecting file
      if (k5FirmwareSelect) k5FirmwareSelect.value = "";
      log(`K5 custom firmware loaded: ${file.name}`);
    } catch (err) {
      k5SelectedFirmware = null;
      updateK5FlashButton();
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = "Failed to load firmware";
      log(`Error loading firmware: ${err.message}`, "error");
    }
  });
}

// K1 Firmware Selection
if (k1FirmwareSelect) {
  k1FirmwareSelect.addEventListener("change", async (e) => {
    const path = e.target.value;
    if (!path) {
      k1SelectedFirmware = null;
      if (k1FirmwareStatus) k1FirmwareStatus.textContent = "No firmware selected";
      return;
    }
    try {
      log(`[K1] Loading firmware from: ${e.target.options[e.target.selectedIndex].text}...`);
      
      // Check if it's a GitHub Release URL (needs special handling)
      if (path.includes('/releases/download/')) {
        log('[K1] Detected GitHub Release URL - using API loader');
        k1SelectedFirmware = await loadFirmwareWithCORS(path);
        const name = path.split('/').pop();
        if (k1FirmwareStatus) k1FirmwareStatus.textContent = `Selected: ${name} (${k1SelectedFirmware.length} bytes)`;
        log(`[K1] ✅ Firmware loaded: ${k1SelectedFirmware.length} bytes`);
      } else {
        // Regular URL or GitHub repository file
        let fetchUrl = path;
        if (path.startsWith('http://') || path.startsWith('https://')) {
          fetchUrl = convertGitHubUrl(path);
          if (fetchUrl !== path) {
            log(`Converted GitHub URL to: ${fetchUrl}`);
          }
        }
        
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Failed to load firmware");
        const buffer = await response.arrayBuffer();
        k1SelectedFirmware = new Uint8Array(buffer);
        const name = path.split('/').pop();
        if (k1FirmwareStatus) k1FirmwareStatus.textContent = `Selected: ${name} (${k1SelectedFirmware.length} bytes)`;
        log(`[K1] ✅ Firmware loaded: ${k1SelectedFirmware.length} bytes`);
      }
      
      // Clear file input when selecting from dropdown
      if (k1FirmwareFile) k1FirmwareFile.value = "";
    } catch (err) {
      k1SelectedFirmware = null;
      if (k1FirmwareStatus) k1FirmwareStatus.textContent = "Failed to load firmware";
      log(`Error loading firmware: ${err.message}`, "error");
    }
  });
}

// K1 File input (custom firmware)
if (k1FirmwareFile) {
  k1FirmwareFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) {
      k1SelectedFirmware = null;
      if (k1FirmwareStatus) k1FirmwareStatus.textContent = "No firmware selected";
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      k1SelectedFirmware = new Uint8Array(buffer);
      if (k1FirmwareStatus) k1FirmwareStatus.textContent = `Selected: ${file.name} (${k1SelectedFirmware.length} bytes)`;
      // Clear dropdown when selecting file
      if (k1FirmwareSelect) k1FirmwareSelect.value = "";
      log(`K1 custom firmware loaded: ${file.name}`);
    } catch (err) {
      k1SelectedFirmware = null;
      if (k1FirmwareStatus) k1FirmwareStatus.textContent = "Failed to load firmware";
      log(`Error loading firmware: ${err.message}`, "error");
    }
  });
}

// K5 URL firmware loading
const k5FirmwareUrl = document.getElementById("k5FirmwareUrl");
const k5LoadUrlBtn = document.getElementById("k5LoadUrlBtn");
if (k5LoadUrlBtn && k5FirmwareUrl) {
  k5LoadUrlBtn.addEventListener("click", async () => {
    const inputUrl = k5FirmwareUrl.value.trim();
    if (!inputUrl) {
      log("Please enter a firmware URL", "error");
      return;
    }
    try {
      k5LoadUrlBtn.disabled = true;
      k5LoadUrlBtn.textContent = "Loading...";
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = "Loading firmware from URL...";
      
      const url = convertGitHubUrl(inputUrl);
      if (url !== inputUrl) {
        log(`Converted GitHub URL to: ${url}`);
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const buffer = await response.arrayBuffer();
      k5SelectedFirmware = new Uint8Array(buffer);
      updateK5FlashButton();
      const name = url.split('/').pop() || 'firmware.bin';
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = `Selected: ${name} (${k5SelectedFirmware.length} bytes)`;
      // Clear other inputs
      if (k5FirmwareSelect) k5FirmwareSelect.value = "";
      if (firmwareFile) firmwareFile.value = "";
      log(`K5 firmware loaded from URL: ${name}`);
    } catch (err) {
      k5SelectedFirmware = null;
      updateK5FlashButton();
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = "Failed to load firmware from URL";
      log(`Error loading firmware from URL: ${err.message}`, "error");
    } finally {
      k5LoadUrlBtn.disabled = false;
      k5LoadUrlBtn.textContent = "Load";
    }
  });
}

// K1 URL firmware loading
const k1FirmwareUrl = document.getElementById("k1FirmwareUrl");
const k1LoadUrlBtn = document.getElementById("k1LoadUrlBtn");
if (k1LoadUrlBtn && k1FirmwareUrl) {
  k1LoadUrlBtn.addEventListener("click", async () => {
    const inputUrl = k1FirmwareUrl.value.trim();
    if (!inputUrl) {
      log("Please enter a firmware URL", "error");
      return;
    }
    try {
      k1LoadUrlBtn.disabled = true;
      k1LoadUrlBtn.textContent = "Loading...";
      if (k1FirmwareStatus) k1FirmwareStatus.textContent = "Loading firmware from URL...";
      
      // Check if it's a GitHub Release URL (needs special handling)
      if (inputUrl.includes('/releases/download/')) {
        log('[K1] Detected GitHub Release URL - using API loader');
        k1SelectedFirmware = await loadFirmwareWithCORS(inputUrl);
        const name = inputUrl.split('/').pop() || 'firmware.bin';
        if (k1FirmwareStatus) k1FirmwareStatus.textContent = `Selected: ${name} (${k1SelectedFirmware.length} bytes)`;
        log(`[K1] ✅ Firmware loaded from GitHub Release: ${name} (${k1SelectedFirmware.length} bytes)`);
      } else {
        // Regular URL or GitHub repository file
        const url = convertGitHubUrl(inputUrl);
        if (url !== inputUrl) {
          log(`Converted GitHub URL to: ${url}`);
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const buffer = await response.arrayBuffer();
        k1SelectedFirmware = new Uint8Array(buffer);
        const name = url.split('/').pop() || 'firmware.bin';
        if (k1FirmwareStatus) k1FirmwareStatus.textContent = `Selected: ${name} (${k1SelectedFirmware.length} bytes)`;
        log(`[K1] ✅ Firmware loaded from URL: ${name} (${k1SelectedFirmware.length} bytes)`);
      }
      
      // Clear other inputs
      if (k1FirmwareSelect) k1FirmwareSelect.value = "";
      if (k1FirmwareFile) k1FirmwareFile.value = "";
    } catch (err) {
      k1SelectedFirmware = null;
      if (k1FirmwareStatus) k1FirmwareStatus.textContent = "Failed to load firmware from URL";
      log(`Error loading firmware from URL: ${err.message}`, "error");
    } finally {
      k1LoadUrlBtn.disabled = false;
      k1LoadUrlBtn.textContent = "Load";
    }
  });
}

// Copyright
const year = new Date().getFullYear();
if (footerCopyright) footerCopyright.textContent = `Copyright ${year} Matoz`;

updateUI(false);

// ========== Default Calibration Restore ==========
const defaultCalibSelect = document.getElementById("defaultCalibSelect");
const defaultCalibFill = document.getElementById("defaultCalibFill");
const defaultCalibPct = document.getElementById("defaultCalibPct");
const defaultCalibHint = document.getElementById("defaultCalibHint");

let selectedDefaultCalib = null;

if (defaultCalibSelect) {
  defaultCalibSelect.addEventListener("change", async (e) => {
    const path = e.target.value;
    if (!path) {
      selectedDefaultCalib = null;
      if (defaultCalibHint) defaultCalibHint.textContent = "Select a model to restore its default calibration.";
      return;
    }
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error("Failed to load calibration file");
      const buffer = await response.arrayBuffer();
      selectedDefaultCalib = new Uint8Array(buffer);
      const name = path.split('/').pop().replace('.bin', '');
      if (defaultCalibHint) defaultCalibHint.textContent = `Selected: ${name} (${selectedDefaultCalib.length} bytes)`;
      log(`Default calibration loaded: ${name}`);
    } catch (err) {
      selectedDefaultCalib = null;
      if (defaultCalibHint) defaultCalibHint.textContent = "Failed to load calibration file";
      log(`Error loading calibration: ${err.message}`, "error");
    }
  });
}

if (restoreDefaultCalibBtn) {
  restoreDefaultCalibBtn.addEventListener("click", async () => {
    if (isBusy || !isConnected()) return;
    if (!selectedDefaultCalib) {
      log("No default calibration selected.", "error");
      return;
    }
    if (selectedDefaultCalib.length !== 0x200) {
      log(`Invalid calibration file size: expected 512 bytes, got ${selectedDefaultCalib.length}`, "error");
      return;
    }
    if (!claim("restoreDefaultCalib")) {
      log("Serial port is busy.", "error");
      return;
    }
    isBusy = true;
    updateUI(true);
    setProgress(defaultCalibFill, defaultCalibPct, 0);
    log("Restoring default calibration...");
    try {
      const port = getPort();
      const firmwareVersion = await eepromInit(port);
      console.log("[app.js] 🔍 eepromInit returned:", firmwareVersion);
      setFirmwareVersion(firmwareVersion);
      for (let offset = 0; offset < selectedDefaultCalib.length; offset += 0x40) {
        const chunk = selectedDefaultCalib.slice(offset, offset + 0x40);
        await eepromWrite(port, 0x1e00 + offset, chunk, chunk.length);
        setProgress(defaultCalibFill, defaultCalibPct, ((offset + chunk.length) / selectedDefaultCalib.length) * 100);
      }
      await eepromReboot(port);
      log("Default calibration restore complete.", "success");
    } catch (e) {
      log(`Restore default calibration failed: ${e.message}`, "error");
    } finally {
      release("restoreDefaultCalib");
    }
    isBusy = false;
    updateUI(isConnected());
  });
}

// Update UI when radio type changes
onRadioTypeChange((type, config) => {
  const toolsEyebrow = document.getElementById('toolsEyebrow');
  const channelsEyebrow = document.getElementById('channelsEyebrow');
  const memorySizeLabel = document.querySelector('.memory-type-label');
  
  if (toolsEyebrow) {
    toolsEyebrow.textContent = type === 'K5' ? 'UV-K5/K1 TOOLSET' : 
                              type === 'TK11' ? 'TK11 TOOLSET' : 
                              'RT-890 TOOLSET';
  }
  if (channelsEyebrow) {
    channelsEyebrow.textContent = type === 'K5' ? 'K5/K1 CHANNELS' : 
                                 type === 'TK11' ? 'TK11 CHANNELS' : 
                                 'RT-890 CHANNELS';
  }
  if (memorySizeLabel) {
    memorySizeLabel.textContent = (type === 'TK11' || type === 'RT890') ? 'Check Flash Size' : 'Check EEPROM Size';
  }
  
  // Show/hide radio-specific elements
  document.querySelectorAll('.k5-only').forEach(el => {
    el.style.display = type === 'K5' ? '' : 'none';
  });
  document.querySelectorAll('.tk11-only').forEach(el => {
    el.style.display = type === 'TK11' ? '' : 'none';
  });
  document.querySelectorAll('.rt890-only').forEach(el => {
    el.style.display = type === 'RT890' ? '' : 'none';
  });
  document.querySelectorAll('.k5-tk11-only').forEach(el => {
    el.style.display = (type === 'K5' || type === 'TK11') ? '' : 'none';
  });
  document.querySelectorAll('.tk11-hidden').forEach(el => {
    el.style.display = type === 'TK11' ? 'none' : '';
  });
  
  // Control sidebar navigation visibility
  const sidebarLinks = {
    navHome: type === 'K5' || type === 'TK11',  // Tools: K5 and TK11
    navChannels: type === 'K5',
    navSettings: type === 'K5',
    navMirror: type === 'K5',
    navSmr: type === 'K5',
    navK1: type === 'K5' || type === 'RT890',  // Flash: K5 and RT890
    navTK11Settings: type === 'TK11'
  };
  
  Object.entries(sidebarLinks).forEach(([id, visible]) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = visible ? '' : 'none';
    }
  });
  
  // Hide all DEV panels when switching radios (they require devmode to show)
  document.querySelectorAll('.dev-panel').forEach(el => {
    el.style.display = 'none';
  });
  document.querySelectorAll('.k5-calib-only').forEach(el => {
    el.style.display = type === 'K5' ? '' : 'none';
  });
  
  // Reset dev mode when switching radios
  devModeEnabled = false;
  
  // Update baud rate selector
  if (baudSelect) {
    baudSelect.innerHTML = '';
    config.baudRates.forEach(baud => {
      const option = document.createElement('option');
      option.value = baud;
      option.textContent = baud;
      option.selected = baud === config.defaultBaud;
      baudSelect.appendChild(option);
    });
  }
  
  // Dropdowns are now static in HTML with k5-only/tk11-only classes
  
  log(`Switched to ${config.name} mode`);
});

// ============================================
// DEV MODE - Secret Key Sequence for TK11 and K5
// ============================================

// Secret sequence: Type "devmode" anywhere
let devModeSequence = '';
const DEV_MODE_CODE = 'devmode';

document.addEventListener('keypress', (e) => {
  devModeSequence += e.key.toLowerCase();
  
  // Keep only last N characters
  if (devModeSequence.length > DEV_MODE_CODE.length) {
    devModeSequence = devModeSequence.slice(-DEV_MODE_CODE.length);
  }
  
  // Check if sequence matches
  if (devModeSequence === DEV_MODE_CODE) {
    devModeEnabled = !devModeEnabled;
    const radioType = getRadioType();
    
    // Hide all dev panels first
    document.querySelectorAll('.dev-panel').forEach(el => {
      el.style.display = 'none';
    });
    
    if (devModeEnabled) {
      // Show only the panels for the current radio type
      if (radioType === 'TK11') {
        document.querySelectorAll('.tk11-dev').forEach(el => {
          el.style.display = '';
        });
      } else if (radioType === 'K5') {
        document.querySelectorAll('.k5-dev').forEach(el => {
          el.style.display = '';
        });
      }
      log(`🔧 Developer mode ENABLED for ${radioType}`, 'success');
    } else {
      log('🔧 Developer mode DISABLED', 'info');
    }
    
    devModeSequence = '';
  }
});

// DEV Backup Button - TK11
const devBackupStartAddrTK11 = document.getElementById('devBackupStartAddrTK11');
const devBackupEndAddrTK11 = document.getElementById('devBackupEndAddrTK11');
const devBackupFillTK11 = document.getElementById('devBackupFillTK11');
const devBackupPctTK11 = document.getElementById('devBackupPctTK11');

if (devBackupBtnTK11) {
  devBackupBtnTK11.addEventListener('click', async () => {
    if (isBusy || !isConnected()) return;
    if (getRadioType() !== 'TK11') {
      log('This DEV panel is for TK11 only', 'error');
      return;
    }
    
    const startAddr = parseInt(devBackupStartAddrTK11.value, 16) || 0;
    const endAddr = parseInt(devBackupEndAddrTK11.value, 16) || 0x0A1000;
    
    if (startAddr >= endAddr) {
      log('Start address must be less than end address', 'error');
      return;
    }
    
    const size = endAddr - startAddr;
    if (size > 0x200000) { // 2MB max for TK11
      log('Range too large (max 2MB for TK11)', 'error');
      return;
    }
    
    if (!claim('devBackupTK11')) {
      log('Serial port is busy.', 'error');
      return;
    }
    
    isBusy = true;
    updateUI(true);
    setProgress(devBackupFillTK11, devBackupPctTK11, 0);
    log(`[TK11] Reading EEPROM from 0x${startAddr.toString(16).toUpperCase()} to 0x${endAddr.toString(16).toUpperCase()} (${size} bytes)...`);
    
    try {
      const port = getPort();
      await tk11Init(port);
      
      const data = new Uint8Array(size);
      const chunkSize = 128;
      let bytesRead = 0;
      
      for (let addr = startAddr; addr < endAddr; addr += chunkSize) {
        const readSize = Math.min(chunkSize, endAddr - addr);
        const chunk = await tk11Read(port, addr, readSize);
        data.set(chunk, addr - startAddr);
        bytesRead += readSize;
        setProgress(devBackupFillTK11, devBackupPctTK11, (bytesRead / size) * 100);
      }
      
      // Download file
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TK11_DEV_0x${startAddr.toString(16).toUpperCase()}_0x${endAddr.toString(16).toUpperCase()}.bin`;
      a.click();
      URL.revokeObjectURL(url);
      
      log(`[TK11] DEV Backup complete: ${size} bytes saved`, 'success');
    } catch (e) {
      log(`[TK11] DEV Backup failed: ${e.message}`, 'error');
    } finally {
      release('devBackupTK11');
    }
    
    isBusy = false;
    updateUI(isConnected());
  });
}

// DEV Backup Button - K5
const devBackupStartAddrK5 = document.getElementById('devBackupStartAddrK5');
const devBackupEndAddrK5 = document.getElementById('devBackupEndAddrK5');
const devBackupFillK5 = document.getElementById('devBackupFillK5');
const devBackupPctK5 = document.getElementById('devBackupPctK5');

if (devBackupBtnK5) {
  devBackupBtnK5.addEventListener('click', async () => {
    if (isBusy || !isConnected()) return;
    if (getRadioType() !== 'K5') {
      log('This DEV panel is for K5 only', 'error');
      return;
    }
    
    const startAddr = parseInt(devBackupStartAddrK5.value, 16) || 0;
    const endAddr = parseInt(devBackupEndAddrK5.value, 16) || 0x2000;
    
    if (startAddr >= endAddr) {
      log('Start address must be less than end address', 'error');
      return;
    }
    
    const size = endAddr - startAddr;
    if (size > 0x80000) { // 512KB max for K5
      log('Range too large (max 512KB for K5)', 'error');
      return;
    }
    
    if (!claim('devBackupK5')) {
      log('Serial port is busy.', 'error');
      return;
    }
    
    isBusy = true;
    updateUI(true);
    setProgress(devBackupFillK5, devBackupPctK5, 0);
    log(`[K5] Reading EEPROM from 0x${startAddr.toString(16).toUpperCase()} to 0x${endAddr.toString(16).toUpperCase()} (${size} bytes)...`);
    
    try {
      const port = getPort();
      const firmwareVersion = await initRadio(port);
      console.log("[app.js] 🔍 firmwareVersion =", firmwareVersion, "| radioType =", getRadioType());
      if (getRadioType() === "K5") {
        console.log("[app.js] ➡️ Calling setFirmwareVersion...");
        setFirmwareVersion(firmwareVersion);
      }
      
      const data = new Uint8Array(size);
      const chunkSize = EEPROM_BLOCK_SIZE;
      let bytesRead = 0;
      
      for (let addr = startAddr; addr < endAddr; addr += chunkSize) {
        const readSize = Math.min(chunkSize, endAddr - addr);
        const chunk = await readRadio(port, addr, readSize);
        data.set(chunk, addr - startAddr);
        bytesRead += readSize;
        setProgress(devBackupFillK5, devBackupPctK5, (bytesRead / size) * 100);
      }
      
      // Download file
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `K5_DEV_0x${startAddr.toString(16).toUpperCase()}_0x${endAddr.toString(16).toUpperCase()}.bin`;
      a.click();
      URL.revokeObjectURL(url);
      
      log(`[K5] DEV Backup complete: ${size} bytes saved`, 'success');
    } catch (e) {
      log(`[K5] DEV Backup failed: ${e.message}`, 'error');
    } finally {
      release('devBackupK5');
    }
    
    isBusy = false;
    updateUI(isConnected());
  });
}

// DEV Restore Button - TK11
const devRestoreStartAddrTK11 = document.getElementById('devRestoreStartAddrTK11');
const devRestoreFileTK11 = document.getElementById('devRestoreFileTK11');
const devRestoreFillTK11 = document.getElementById('devRestoreFillTK11');
const devRestorePctTK11 = document.getElementById('devRestorePctTK11');

if (devRestoreBtnTK11) {
  devRestoreBtnTK11.addEventListener('click', async () => {
    if (isBusy || !isConnected()) return;
    if (getRadioType() !== 'TK11') {
      log('This DEV panel is for TK11 only', 'error');
      return;
    }
    
    if (!devRestoreFileTK11.files.length) {
      log('Please select a file to restore', 'error');
      return;
    }
    
    const startAddr = parseInt(devRestoreStartAddrTK11.value, 16) || 0;
    const file = devRestoreFileTK11.files[0];
    const data = new Uint8Array(await file.arrayBuffer());
    
    if (data.length > 0x200000) { // 2MB max for TK11
      log('File too large (max 2MB for TK11)', 'error');
      return;
    }
    
    if (!confirm(`⚠️ WARNING [TK11]: This will write ${data.length} bytes starting at address 0x${startAddr.toString(16).toUpperCase()}.\n\nThis may damage your radio if used incorrectly!\n\nAre you sure you want to continue?`)) {
      return;
    }
    
    if (!claim('devRestoreTK11')) {
      log('Serial port is busy.', 'error');
      return;
    }
    
    isBusy = true;
    updateUI(true);
    setProgress(devRestoreFillTK11, devRestorePctTK11, 0);
    log(`[TK11] Writing ${data.length} bytes to EEPROM starting at 0x${startAddr.toString(16).toUpperCase()}...`);
    
    try {
      const port = getPort();
      await tk11Init(port);
      
      const chunkSize = 128;
      let bytesWritten = 0;
      
      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const writeSize = Math.min(chunkSize, data.length - offset);
        const chunk = data.slice(offset, offset + writeSize);
        await tk11Write(port, startAddr + offset, chunk);
        bytesWritten += writeSize;
        setProgress(devRestoreFillTK11, devRestorePctTK11, (bytesWritten / data.length) * 100);
      }
      
      log(`[TK11] DEV Restore complete: ${data.length} bytes written`, 'success');
    } catch (e) {
      log(`[TK11] DEV Restore failed: ${e.message}`, 'error');
    } finally {
      release('devRestoreTK11');
    }
    
    isBusy = false;
    updateUI(isConnected());
  });
}

// DEV Restore Button - K5
const devRestoreStartAddrK5 = document.getElementById('devRestoreStartAddrK5');
const devRestoreFileK5 = document.getElementById('devRestoreFileK5');
const devRestoreFillK5 = document.getElementById('devRestoreFillK5');
const devRestorePctK5 = document.getElementById('devRestorePctK5');

if (devRestoreBtnK5) {
  devRestoreBtnK5.addEventListener('click', async () => {
    if (isBusy || !isConnected()) return;
    if (getRadioType() !== 'K5') {
      log('This DEV panel is for K5 only', 'error');
      return;
    }
    
    if (!devRestoreFileK5.files.length) {
      log('Please select a file to restore', 'error');
      return;
    }
    
    const startAddr = parseInt(devRestoreStartAddrK5.value, 16) || 0;
    const file = devRestoreFileK5.files[0];
    const data = new Uint8Array(await file.arrayBuffer());
    
    if (data.length > 0x80000) { // 512KB max for K5
      log('File too large (max 512KB for K5)', 'error');
      return;
    }
    
    if (!confirm(`⚠️ WARNING [K5]: This will write ${data.length} bytes starting at address 0x${startAddr.toString(16).toUpperCase()}.\n\nThis may damage your radio if used incorrectly!\n\nAre you sure you want to continue?`)) {
      return;
    }
    
    if (!claim('devRestoreK5')) {
      log('Serial port is busy.', 'error');
      return;
    }
    
    isBusy = true;
    updateUI(true);
    setProgress(devRestoreFillK5, devRestorePctK5, 0);
    log(`[K5] Writing ${data.length} bytes to EEPROM starting at 0x${startAddr.toString(16).toUpperCase()}...`);
    
    try {
      const port = getPort();
      const firmwareVersion = await initRadio(port);
      console.log("[app.js] 🔍 firmwareVersion =", firmwareVersion, "| radioType =", getRadioType());
      if (getRadioType() === "K5") {
        console.log("[app.js] ➡️ Calling setFirmwareVersion...");
        setFirmwareVersion(firmwareVersion);
      }
      
      const chunkSize = EEPROM_BLOCK_SIZE;
      let bytesWritten = 0;
      
      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const writeSize = Math.min(chunkSize, data.length - offset);
        const chunk = data.slice(offset, offset + writeSize);
        await writeRadio(port, startAddr + offset, chunk, writeSize);
        bytesWritten += writeSize;
        setProgress(devRestoreFillK5, devRestorePctK5, (bytesWritten / data.length) * 100);
      }
      
      log(`[K5] DEV Restore complete: ${data.length} bytes written`, 'success');
    } catch (e) {
      log(`[K5] DEV Restore failed: ${e.message}`, 'error');
    } finally {
      release('devRestoreK5');
    }
    
    isBusy = false;
    updateUI(isConnected());
  });
}

// ============================================
// HEX View DEV - Compare functionality
// ============================================

// Helper function to escape HTML special characters
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');
}

// Helper function to format hex with differences highlighted
function formatHexComparison(data1, data2, startAddr = 0) {
  const lines1 = [];
  const lines2 = [];
  const differences = [];
  
  const bytesPerLine = 16;
  const maxLen = Math.max(data1.length, data2.length);
  
  for (let offset = 0; offset < maxLen; offset += bytesPerLine) {
    const addr = (startAddr + offset).toString(16).toUpperCase().padStart(6, '0');
    
    let hex1 = '';
    let hex2 = '';
    let ascii1 = '';
    let ascii2 = '';
    
    for (let i = 0; i < bytesPerLine; i++) {
      const idx = offset + i;
      const byte1 = idx < data1.length ? data1[idx] : null;
      const byte2 = idx < data2.length ? data2[idx] : null;
      
      if (byte1 !== null) {
        const hexVal1 = byte1.toString(16).toUpperCase().padStart(2, '0');
        if (byte2 !== null && byte1 !== byte2) {
          hex1 += `<span style="color: #ef4444; font-weight: bold;">${hexVal1}</span> `;
          differences.push({
            address: startAddr + idx,
            byte1: byte1,
            byte2: byte2
          });
        } else {
          hex1 += hexVal1 + ' ';
        }
        ascii1 += (byte1 >= 32 && byte1 <= 126) ? String.fromCharCode(byte1) : '.';
      } else {
        hex1 += '   ';
        ascii1 += ' ';
      }
      
      if (byte2 !== null) {
        const hexVal2 = byte2.toString(16).toUpperCase().padStart(2, '0');
        if (byte1 !== null && byte1 !== byte2) {
          hex2 += `<span style="color: #ef4444; font-weight: bold;">${hexVal2}</span> `;
        } else {
          hex2 += hexVal2 + ' ';
        }
        ascii2 += (byte2 >= 32 && byte2 <= 126) ? String.fromCharCode(byte2) : '.';
      } else {
        hex2 += '   ';
        ascii2 += ' ';
      }
      
      if (i === 7) {
        hex1 += ' ';
        hex2 += ' ';
      }
    }
    
    lines1.push(`<span style="color: #888;">${addr}</span>  ${hex1} |${escapeHtml(ascii1)}|`);
    lines2.push(`<span style="color: #888;">${addr}</span>  ${hex2} |${escapeHtml(ascii2)}|`);
  }
  
  return { lines1, lines2, differences };
}

// Generate differences console output
function generateDiffConsole(differences, file1Name, file2Name) {
  if (differences.length === 0) {
    return `✅ No differences found between "${file1Name}" and "${file2Name}"`;
  }
  
  let output = `Found ${differences.length} byte difference(s):\n`;
  output += `${'─'.repeat(60)}\n`;
  output += `Address     │ ${file1Name.substring(0, 20).padEnd(20)} │ ${file2Name.substring(0, 20).padEnd(20)}\n`;
  output += `${'─'.repeat(60)}\n`;
  
  // Show ALL differences
  for (const diff of differences) {
    const addr = '0x' + diff.address.toString(16).toUpperCase().padStart(6, '0');
    const val1 = '0x' + diff.byte1.toString(16).toUpperCase().padStart(2, '0');
    const val2 = '0x' + diff.byte2.toString(16).toUpperCase().padStart(2, '0');
    output += `${addr}    │ ${val1.padEnd(20)} │ ${val2.padEnd(20)}\n`;
  }
  
  return output;
}

// Setup HEX View DEV for a specific radio type
function setupHexViewDev(suffix) {
  const compareMode = document.getElementById(`hexDevCompareMode${suffix}`);
  const startAddrInput = document.getElementById(`hexDevStartAddr${suffix}`);
  const endAddrInput = document.getElementById(`hexDevEndAddr${suffix}`);
  const file1Input = document.getElementById(`hexDevFile1${suffix}`);
  const file2Input = document.getElementById(`hexDevFile2${suffix}`);
  const file2Group = document.querySelector(`.hexDevFile2Group${suffix}`);
  const compareBtn = document.getElementById(`hexDevCompareBtn${suffix}`);
  const clearBtn = document.getElementById(`hexDevClearBtn${suffix}`);
  const progressDiv = document.getElementById(`hexDevProgress${suffix}`);
  const pctSpan = document.getElementById(`hexDevPct${suffix}`);
  const fillDiv = document.getElementById(`hexDevFill${suffix}`);
  const outputDiv = document.getElementById(`hexDevOutput${suffix}`);
  const leftDiv = document.getElementById(`hexDevLeft_${suffix}`);
  const rightDiv = document.getElementById(`hexDevRight_${suffix}`);
  const consoleDiv = document.getElementById(`hexDevConsole${suffix}`);
  const file1NameSpan = document.getElementById(`hexDevFile1Name${suffix}`);
  const file2NameSpan = document.getElementById(`hexDevFile2Name${suffix}`);
  
  if (!compareMode || !compareBtn) return;
  
  // Toggle file2 visibility based on compare mode
  compareMode.addEventListener('change', () => {
    if (file2Group) {
      file2Group.style.display = compareMode.value === 'files' ? '' : 'none';
    }
    updateHexDevCompareButtons();  // Update button state when mode changes
  });
  
  // Update Compare button when files are selected/removed
  if (file1Input) {
    file1Input.addEventListener('change', updateHexDevCompareButtons);
  }
  if (file2Input) {
    file2Input.addEventListener('change', updateHexDevCompareButtons);
  }
  
  // Clear button
  clearBtn.addEventListener('click', () => {
    file1Input.value = '';
    file2Input.value = '';
    startAddrInput.value = '';
    endAddrInput.value = '';
    outputDiv.style.display = 'none';
    leftDiv.innerHTML = '';
    rightDiv.innerHTML = '';
    consoleDiv.innerHTML = '';
    progressDiv.style.display = 'none';
  });
  
  // Compare button
  compareBtn.addEventListener('click', async () => {
    const mode = compareMode.value;
    const radioType = getRadioType();
    
    // Validate radio type matches
    if ((suffix === 'TK11' && radioType !== 'TK11') || (suffix === 'K5' && radioType !== 'K5')) {
      log(`This DEV panel is for ${suffix} only`, 'error');
      return;
    }
    
    // Get files
    const file1 = file1Input.files[0];
    if (!file1) {
      log('Please select File 1', 'error');
      return;
    }
    
    let data1, data2;
    let file1Name = file1.name;
    let file2Name = mode === 'files' ? 'File 2' : 'Radio Memory';
    
    try {
      data1 = new Uint8Array(await file1.arrayBuffer());
      
      // Parse optional start/end addresses
      let startAddr = startAddrInput.value ? parseInt(startAddrInput.value, 16) : 0;
      let endAddr = endAddrInput.value ? parseInt(endAddrInput.value, 16) : data1.length;
      
      if (mode === 'files') {
        // Compare two files
        const file2 = file2Input.files[0];
        if (!file2) {
          log('Please select File 2', 'error');
          return;
        }
        file2Name = file2.name;
        data2 = new Uint8Array(await file2.arrayBuffer());
        
        // Apply range if specified
        if (startAddrInput.value || endAddrInput.value) {
          const len = Math.min(endAddr - startAddr, data1.length - startAddr, data2.length - startAddr);
          if (len > 0) {
            data1 = data1.slice(startAddr, startAddr + len);
            data2 = data2.slice(startAddr, startAddr + len);
          }
        }
        
        // Limit display size
        const maxDisplay = 2097152; // 2MB max display for files
        if (data1.length > maxDisplay) {
          data1 = data1.slice(0, maxDisplay);
          data2 = data2.slice(0, maxDisplay);
          log(`Display limited to first ${maxDisplay} bytes`, 'warning');
        }
        
      } else {
        // Compare file with radio memory
        if (isBusy || !isConnected()) {
          log('Serial port is busy or not connected', 'error');
          return;
        }
        
        if (!claim('hexViewDev')) {
          log('Serial port is busy.', 'error');
          return;
        }
        
        const readLength = endAddrInput.value ? (endAddr - startAddr) : Math.min(data1.length, 32768);
        
        isBusy = true;
        updateUI(true);
        progressDiv.style.display = '';
        setProgress(fillDiv, pctSpan, 0);
        
        try {
          const port = await getConnectedPort();
          const blockSize = getBlockSize();
          
          // Initialize radio before reading
          const firmwareVersion = await initRadio(port);
          console.log("[app.js] 🔍 firmwareVersion =", firmwareVersion, "| radioType =", getRadioType());
          if (getRadioType() === "K5") {
            console.log("[app.js] ➡️ Calling setFirmwareVersion...");
            setFirmwareVersion(firmwareVersion);
          }
          
          data2 = new Uint8Array(readLength);
          let bytesRead = 0;
          
          for (let addr = startAddr; addr < startAddr + readLength; addr += blockSize) {
            const len = Math.min(blockSize, startAddr + readLength - addr);
            const chunk = await readRadio(port, addr, len);
            data2.set(chunk.slice(0, len), bytesRead);
            bytesRead += len;
            setProgress(fillDiv, pctSpan, Math.round((bytesRead / readLength) * 100));
          }
          
          // Slice file1 to match
          if (startAddrInput.value || endAddrInput.value) {
            data1 = data1.slice(startAddr, startAddr + readLength);
          } else {
            data1 = data1.slice(0, readLength);
          }
          
          log(`Read ${bytesRead} bytes from radio for comparison`, 'success');
          
        } finally {
          release('hexViewDev');
          isBusy = false;
          updateUI();
          progressDiv.style.display = 'none';
        }
      }
      
      // Perform comparison
      const displayStartAddr = startAddrInput.value ? parseInt(startAddrInput.value, 16) : 0;
      const { lines1, lines2, differences } = formatHexComparison(data1, data2, displayStartAddr);
      
      // Update UI
      file1NameSpan.textContent = file1Name;
      file2NameSpan.textContent = file2Name;
      leftDiv.innerHTML = lines1.join('\n');
      rightDiv.innerHTML = lines2.join('\n');
      consoleDiv.textContent = generateDiffConsole(differences, file1Name, file2Name);
      outputDiv.style.display = '';
      
      // Sync scrolling
      const syncScroll = (source, target) => {
        source.addEventListener('scroll', () => {
          target.scrollTop = source.scrollTop;
          target.scrollLeft = source.scrollLeft;
        });
      };
      syncScroll(leftDiv, rightDiv);
      syncScroll(rightDiv, leftDiv);
      
      log(`Comparison complete: ${differences.length} difference(s) found`, differences.length > 0 ? 'warning' : 'success');
      
    } catch (err) {
      log(`Comparison error: ${err.message}`, 'error');
      console.error(err);
    }
  });
}


// Initialize HEX View DEV for both radio types
setupHexViewDev('TK11');
setupHexViewDev('K5');

// Initialize K5 Flash button state (disabled until firmware is selected)
updateK5FlashButton();

// Initialize Lock Password module (K5 only)
LockPassword.init(updateUI);

// Initialize Memory Size Detector (K5 & TK11)
MemorySizeDetector.init();
EepromCleaner.init();

// Initialize Firmware Dropdowns (K5, K1, RT890)
initK5FirmwareDropdown();
initK1FirmwareDropdown();
initRT890FirmwareDropdown();

// =============================================================================
// Auto-load firmware from URL parameter (like egzumer's uvtools)
// Example: ?firmwareURL=https://github.com/.../firmware.bin
// =============================================================================
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const firmwareURL = urlParams.get('firmwareURL');
  
  if (firmwareURL) {
    console.log(`[URL Param] Firmware URL detected: ${firmwareURL}`);
    
    // Wait for UI to be ready
    setTimeout(async () => {
      try {
        // Detect radio type from URL pattern (optional enhancement)
        let targetRadio = 'K5'; // Default
        if (firmwareURL.includes('rt890') || firmwareURL.includes('tk11') || firmwareURL.includes('RT-890')) {
          targetRadio = 'TK11';
        } else if (firmwareURL.includes('k1') || firmwareURL.includes('K1') || firmwareURL.includes('calypso')) {
          targetRadio = 'K5'; // K1 uses K5 interface
        }
        
        // Switch to correct radio type if needed
        const radioSelect = document.getElementById('radioTypeSelect');
        if (radioSelect && radioSelect.value !== targetRadio) {
          console.log(`[URL Param] Switching to ${targetRadio}`);
          radioSelect.value = targetRadio;
          radioSelect.dispatchEvent(new Event('change'));
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait for UI update
        }
        
        // Load firmware based on radio type
        if (targetRadio === 'TK11') {
          // Load into RT890/TK11
          console.log('[URL Param] Loading firmware for RT890/TK11...');
          const data = await loadFirmwareFromURL(firmwareURL);
          if (data && data.byteLength === 60416) {
            window.RT890.setFirmwareData(data);
            console.log(`[URL Param] ✅ RT890 firmware loaded: ${data.byteLength} bytes`);
          } else {
            console.error(`[URL Param] ❌ Invalid RT890 firmware size: ${data ? data.byteLength : 0} bytes (expected 60416)`);
          }
        } else {
          // Load into K5/K1
          console.log('[URL Param] Loading firmware for K5/K1...');
          const data = await loadFirmwareFromURL(firmwareURL);
          if (data) {
            // Detect if it's K1 firmware (>61440 bytes)
            if (data.byteLength > 61440) {
              console.log('[URL Param] Detected K1 firmware (>61440 bytes)');
              k1SelectedFirmware = data;
              if (k1FirmwareStatus) {
                k1FirmwareStatus.textContent = `✅ URL firmware loaded: ${data.byteLength} bytes`;
                k1FirmwareStatus.classList.remove('error');
                k1FirmwareStatus.classList.add('success');
              }
              console.log(`[URL Param] ✅ K1 firmware loaded: ${data.byteLength} bytes`);
            } else {
              console.log('[URL Param] Detected K5 firmware (≤61440 bytes)');
              k5SelectedFirmware = data;
              updateK5FlashButton();
              if (k5FirmwareStatus) {
                k5FirmwareStatus.textContent = `✅ URL firmware loaded: ${data.byteLength} bytes`;
                k5FirmwareStatus.classList.remove('error');
                k5FirmwareStatus.classList.add('success');
              }
              console.log(`[URL Param] ✅ K5 firmware loaded: ${data.byteLength} bytes`);
            }
          }
        }
      } catch (error) {
        console.error('[URL Param] ❌ Failed to load firmware from URL:', error);
      }
    }, 1000);
  }
});

// Helper function to load firmware from any URL
async function loadFirmwareFromURL(url) {
  console.log(`[URL Loader] Loading from: ${url}`);
  
  // Check if it's a GitHub Release URL
  if (url.includes('github.com') && url.includes('/releases/download/')) {
    console.log('[URL Loader] Detected GitHub Release URL - using direct fetch');
    // GitHub releases still have CORS issues, so try direct first, fallback to error
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      console.log(`[URL Loader] ✅ Downloaded ${data.byteLength} bytes`);
      return data;
    } catch (error) {
      console.error('[URL Loader] ❌ GitHub release download failed:', error.message);
      throw new Error('GitHub release URLs are not supported due to CORS restrictions. Please use a direct download link or jsDelivr CDN URL.');
    }
  }
  
  // Check if it's a GitHub repository URL (blob/main or raw/main)
  if (url.includes('github.com') && (url.includes('/blob/') || url.includes('/raw/'))) {
    console.log('[URL Loader] Detected GitHub repository URL - converting to jsDelivr');
    const cdnUrl = convertGitHubUrl(url);
    console.log(`[URL Loader] CDN URL: ${cdnUrl}`);
    const response = await fetch(cdnUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.arrayBuffer();
    console.log(`[URL Loader] ✅ Downloaded ${data.byteLength} bytes via CDN`);
    return data;
  }
  
  // Direct HTTP(S) URL
  console.log('[URL Loader] Loading via direct fetch');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.arrayBuffer();
  console.log(`[URL Loader] ✅ Downloaded ${data.byteLength} bytes`);
  return data;
}

