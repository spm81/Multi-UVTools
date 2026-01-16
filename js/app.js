// Helper function to convert GitHub URLs to jsDelivr (avoids CORS issues)
function convertGitHubUrl(url) {
  // Convert github.com/user/repo/blob/branch/path to jsDelivr
  let match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
  }
  // Convert github.com/user/repo/raw/refs/heads/branch/path
  match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/raw\/refs\/heads\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
  }
  // Convert github.com/user/repo/raw/branch/path
  match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/raw\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
  }
  // Convert raw.githubusercontent.com/user/repo/branch/path
  match = url.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
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
import { 
  connect, 
  disconnect, 
  getPort, 
  subscribe, 
  isConnected, 
  claim, 
  release,
  setFirmwareVersion 
} from "./serial-manager.js";
import { getRadioType, getRadioConfig, onRadioTypeChange } from "./radio-selector.js";

// Constants
const OFFICIAL_VERSION_PACKET = new Uint8Array([
  48, 5, 16, 0, 42, 79, 69, 70, 87, 45, 76, 79, 83, 69, 72, 85, 0, 0, 0, 0,
]);
const EEPROM_CONFIG_END = 0x1e00;
const EEPROM_CAL_END = 0x2000;

// DEV mode state
let devModeEnabled = false;

// DOM Elements
const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const backupBtn = document.getElementById("backupBtn");
const restoreBtn = document.getElementById("restoreBtn");
const flashBtn = document.getElementById("flashBtn");
const readEepromBtn = document.getElementById("readEepromBtn");
const writeEepromBtn = document.getElementById("writeEepromBtn");
const dumpCalibK5Btn = document.getElementById("dumpCalibK5Btn");
const restoreCalibK5Btn = document.getElementById("restoreCalibK5Btn");
const backupCalib = document.getElementById("backupCalib");
const restoreCalib = document.getElementById("restoreCalib");
const restoreFile = document.getElementById("restoreFile");
const firmwareFile = document.getElementById("firmwareFile");
const readEepromSize = document.getElementById("readEepromSize");
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
let k1SelectedFirmware = null;
let isBusy = false;

// Logging function
const log = (msg, tone = "info") => {
  if (!logArea) return;
  const entry = document.createElement("div");
  entry.className = `log-entry log-${tone}`;
  const timestamp = new Date().toLocaleTimeString("en-US");
  entry.textContent = `[${timestamp}] ${msg}`;
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
};

// Progress bar helper
const setProgress = (fill, pct, value, visible = true) => {
  const v = Math.max(0, Math.min(100, value));
  const container = fill ? fill.closest(".progress") : null;
  if (container) {
    container.classList.toggle("active", visible);
  }
  if (fill) fill.style.width = `${v}%`;
  if (pct) pct.textContent = `${v.toFixed(1)}%`;
};

// Update device info with VID/PID like k5_editor
const updateDeviceInfo = (port) => {
  if (!deviceInfo) return;
  if (!port) {
    deviceInfo.textContent = "No serial port selected.";
    return;
  }
  const info = port.getInfo ? port.getInfo() : {};
  const details = [];
  if (info.usbVendorId) details.push(`VID ${info.usbVendorId.toString(16)}`);
  if (info.usbProductId) details.push(`PID ${info.usbProductId.toString(16)}`);
  deviceInfo.textContent = details.length
    ? `Active port (${details.join(" / ")})`
    : "Serial port ready.";
};

// Update UI state
const updateUI = (connected, firmware = "-") => {
  if (homeStatusDot) homeStatusDot.dataset.status = connected ? "connected" : "disconnected";
  if (connectionLabel) connectionLabel.textContent = connected ? "Connected" : "Disconnected";
  if (connectBtn) connectBtn.disabled = connected || isBusy;
  if (disconnectBtn) disconnectBtn.disabled = !connected || isBusy;
  if (backupBtn) backupBtn.disabled = !connected || isBusy;
  if (restoreBtn) restoreBtn.disabled = !connected || isBusy;
  if (flashBtn) flashBtn.disabled = isBusy || !k5SelectedFirmware;
  if (readEepromBtn) readEepromBtn.disabled = !connected || isBusy;
  if (writeEepromBtn) writeEepromBtn.disabled = !connected || isBusy;
  if (dumpCalibK5Btn) dumpCalibK5Btn.disabled = !connected || isBusy;
  if (restoreCalibK5Btn) restoreCalibK5Btn.disabled = !connected || isBusy;
  if (baudSelect) baudSelect.disabled = connected;
  if (firmwareInfo) firmwareInfo.textContent = firmware;
};

// Update K5 Flash button state
function updateK5FlashButton() {
  if (flashBtn) {
    const hasFirmware = k5SelectedFirmware !== null;
    flashBtn.disabled = isBusy || !hasFirmware;
    flashBtn.classList.toggle("ready", hasFirmware);
  }
}

// Subscribe to serial manager state changes
subscribe((state) => {
  updateUI(state.connected, state.firmwareVersion || "-");
  updateDeviceInfo(state.port);
});

// Helper to get connected port
const getConnectedPort = async () => {
  if (!isConnected()) {
    const radioConfig = getRadioConfig();
    const baud = parseInt(baudSelect?.value || radioConfig.defaultBaud.toString(), 10);
    await connect({ baudRate: baud });
  }
  return getPort();
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
    return await tk11Write(port, address, data, size);
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

// Download helper
const downloadBlob = (data, filename) => {
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// ==================== CONNECT/DISCONNECT ====================
if (connectBtn) {
  connectBtn.addEventListener("click", async () => {
    if (!claim("home")) {
      log("Another tool is using the serial connection.", "error");
      return;
    }
    try {
      const radioConfig = getRadioConfig();
      const baud = parseInt(baudSelect?.value || radioConfig.defaultBaud.toString(), 10);
      await connect({ baudRate: baud });
      const port = getPort();
      updateDeviceInfo(port);
      
      // Try to get firmware version
      try {
        const version = await initRadio(port);
        setFirmwareVersion(version);
        log(`Connected at ${baud} bps. Firmware: ${version}`);
      } catch (e) {
        log(`Connected at ${baud} bps.`);
      }
    } catch (error) {
      log(`Failed to connect: ${error.message}`, "error");
    } finally {
      release("home");
    }
  });
}

if (disconnectBtn) {
  disconnectBtn.addEventListener("click", async () => {
    if (!claim("home")) {
      log("Another tool is using the serial connection.", "error");
      return;
    }
    try {
      await disconnect();
      log("Serial port disconnected.");
    } catch (error) {
      log(`Failed to disconnect: ${error.message}`, "error");
    } finally {
      release("home");
    }
  });
}

// ==================== BACKUP EEPROM ====================
if (backupBtn) {
  backupBtn.addEventListener("click", async () => {
    if (!claim("home")) {
      log("Another tool is using the serial connection.", "error");
      return;
    }
    isBusy = true;
    updateUI(isConnected());
    
    const radioType = getRadioType();
    const radioConfig = getRadioConfig();
    const includeCal = backupCalib?.checked ?? false;
    
    let end, fileName;
    if (radioType === 'TK11') {
      end = includeCal ? TK11_MEMORY_LIMIT_CALIB : TK11_MEMORY_LIMIT;
      fileName = includeCal ? "tk11-eeprom-with-cal.bin" : "tk11-eeprom-no-cal.bin";
    } else {
      end = includeCal ? EEPROM_CAL_END : EEPROM_CONFIG_END;
      fileName = includeCal ? "uv-k5-eeprom-with-cal.bin" : "uv-k5-eeprom-no-cal.bin";
    }
    
    log(`Starting EEPROM backup (${includeCal ? "with" : "without"} calibration).`);
    
    try {
      const port = await getConnectedPort();
      await initRadio(port);
      
      const rawEEPROM = new Uint8Array(end);
      const blockSize = getBlockSize();
      setProgress(backupFill, backupPct, 0, true);
      
      for (let i = 0; i < end; i += blockSize) {
        const data = await readRadio(port, i, blockSize);
        rawEEPROM.set(data, i);
        const pct = (i / end) * 100;
        setProgress(backupFill, backupPct, pct, true);
      }
      
      setProgress(backupFill, backupPct, 100);
      downloadBlob(new Blob([rawEEPROM], { type: "application/octet-stream" }), fileName);
      log("Backup completed.", "success");
    } catch (error) {
      log(`Backup failed: ${error.message}`, "error");
      setProgress(backupFill, backupPct, 0, false);
    } finally {
      isBusy = false;
      updateUI(isConnected());
      release("home");
    }
  });
}

// ==================== RESTORE EEPROM ====================
if (restoreBtn) {
  restoreBtn.addEventListener("click", async () => {
    if (!restoreFile?.files?.length) {
      log("Select a .bin file to restore.", "error");
      return;
    }
    if (!claim("home")) {
      log("Another tool is using the serial connection.", "error");
      return;
    }
    
    isBusy = true;
    updateUI(isConnected());
    
    const radioType = getRadioType();
    const includeCal = restoreCalib?.checked ?? false;
    const file = restoreFile.files[0];
    
    let maxSize;
    if (radioType === 'TK11') {
      maxSize = includeCal ? TK11_MEMORY_LIMIT_CALIB : TK11_MEMORY_LIMIT;
    } else {
      maxSize = includeCal ? EEPROM_CAL_END : EEPROM_CONFIG_END;
    }
    
    if (file.size > maxSize) {
      log(`File too large for this mode. Max size is ${maxSize} bytes.`, "error");
      isBusy = false;
      updateUI(isConnected());
      release("home");
      return;
    }
    
    log(`Starting EEPROM restore (${includeCal ? "with" : "without"} calibration).`);
    
    try {
      const port = await getConnectedPort();
      await initRadio(port);
      
      const rawEEPROM = new Uint8Array(await file.arrayBuffer());
      const blockSize = getBlockSize();
      setProgress(restoreFill, restorePct, 0, true);
      
      for (let i = 0; i < rawEEPROM.length; i += blockSize) {
        const chunk = rawEEPROM.slice(i, i + blockSize);
        await writeRadio(port, i, chunk, chunk.length);
        const pct = (i / rawEEPROM.length) * 100;
        setProgress(restoreFill, restorePct, pct, true);
      }
      
      setProgress(restoreFill, restorePct, 100);
      await rebootRadio(port);
      log("Restore completed.", "success");
    } catch (error) {
      log(`Restore failed: ${error.message}`, "error");
      setProgress(restoreFill, restorePct, 0, false);
    } finally {
      isBusy = false;
      updateUI(isConnected());
      release("home");
    }
  });
}

// ==================== K5 FIRMWARE FLASH ====================
if (flashBtn) {
  flashBtn.addEventListener("click", async () => {
    if (!k5SelectedFirmware) {
      log("No firmware selected. Choose from the list or upload a file.", "error");
      return;
    }
    if (!claim("k5flash")) {
      log("Another tool is using the serial connection.", "error");
      return;
    }
    
    isBusy = true;
    updateUI(isConnected());
    setProgress(flashFill, flashPct, 0, true);
    
    try {
      // Disconnect any existing connection
      await disconnect();
      
      log("Put radio in boot mode: PTT + Power On");
      log("Connecting at 38400 baud...");
      
      // Connect at 38400 for bootloader
      await connect({ baudRate: 38400 });
      const flashingPort = getPort();
      
      if (!flashingPort) {
        throw new Error("No serial port available.");
      }
      
      log("Waiting for bootloader (30s timeout)...");
      
      // Wait for bootloader with 30 second timeout
      try {
        await readPacket(flashingPort, 0x18, 30000);
      } catch (e) {
        throw new Error("Bootloader not detected. Ensure radio is in boot mode (PTT + Power On).");
      }
      
      log("Bootloader detected!");
      
      // Get firmware version
      let versionText = "unknown";
      try {
        const rawVersion = unpackFirmwareVersion(k5SelectedFirmware);
        const decoded = new TextDecoder().decode(rawVersion).replace(/\0.*$/, "");
        if (decoded && /^[\x20-\x7E]+$/.test(decoded)) {
          versionText = decoded;
        }
      } catch (e) {
        log("Warning: Could not read firmware version");
      }
      log(`Firmware version: ${versionText}`);
      
      // Send official version packet
      await sendPacket(flashingPort, OFFICIAL_VERSION_PACKET);
      await readPacket(flashingPort, 0x18, 5000);
      
      // Unpack firmware
      const firmware = unpackFirmware(k5SelectedFirmware);
      if (firmware.length > 0xf000) {
        throw new Error("Firmware size too large for official flashing.");
      }
      
      log(`Writing ${firmware.length} bytes...`);
      
      for (let i = 0; i < firmware.length; i += FLASH_BLOCK_SIZE) {
        const data = firmware.slice(i, i + FLASH_BLOCK_SIZE);
        const command = flashGenerateCommand(data, i, firmware.length);
        await sendPacket(flashingPort, command);
        await readPacket(flashingPort, 0x1a, 5000);
        
        const pct = ((i + FLASH_BLOCK_SIZE) / firmware.length) * 100;
        setProgress(flashFill, flashPct, Math.min(pct, 100), true);
      }
      
      setProgress(flashFill, flashPct, 100, true);
      log("Firmware programmed successfully!", "success");
      
    } catch (error) {
      log(`Flash failed: ${error.message}`, "error");
      setProgress(flashFill, flashPct, 0, false);
    } finally {
      try {
        await disconnect();
      } catch (e) {}
      isBusy = false;
      updateUI(isConnected());
      release("k5flash");
    }
  });
}

// ==================== FIRMWARE SELECTION ====================

// K5 Firmware select handler
if (k5FirmwareSelect) {
  k5FirmwareSelect.addEventListener("change", async () => {
    const path = k5FirmwareSelect.value;
    if (!path) {
      k5SelectedFirmware = null;
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = "No firmware selected";
      updateK5FlashButton();
      return;
    }
    
    // Get the selected option's display name
    const selectedOption = k5FirmwareSelect.selectedOptions[0];
    const firmwareName = selectedOption ? selectedOption.text : path.split('/').pop();
    
    if (k5FirmwareStatus) k5FirmwareStatus.textContent = "Loading...";
    
    try {
      const url = convertGitHubUrl(path);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load: ${response.statusText}`);
      k5SelectedFirmware = new Uint8Array(await response.arrayBuffer());
      
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = `Ready: ${firmwareName} (${k5SelectedFirmware.length} bytes)`;
      log(`Loaded firmware: ${firmwareName}`);
    } catch (error) {
      k5SelectedFirmware = null;
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = `Error: ${error.message}`;
      log(`Failed to load firmware: ${error.message}`, "error");
    }
    updateK5FlashButton();
  });
}

// K5 Firmware file upload handler
if (firmwareFile) {
  firmwareFile.addEventListener("change", async () => {
    if (!firmwareFile.files?.length) {
      k5SelectedFirmware = null;
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = "No file selected";
      updateK5FlashButton();
      return;
    }
    
    const file = firmwareFile.files[0];
    const fileName = file.name;
    if (k5FirmwareStatus) k5FirmwareStatus.textContent = "Loading file...";
    
    try {
      k5SelectedFirmware = new Uint8Array(await file.arrayBuffer());
      
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = `Ready: ${fileName} (${k5SelectedFirmware.length} bytes)`;
      if (k5FirmwareSelect) k5FirmwareSelect.value = "";
      log(`Loaded firmware file: ${file.name}`);
    } catch (error) {
      k5SelectedFirmware = null;
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = `Error: ${error.message}`;
      log(`Failed to load firmware file: ${error.message}`, "error");
    }
    updateK5FlashButton();
  });
}

// K5 Firmware URL paste handler
const k5FirmwareUrl = document.getElementById("k5FirmwareUrl");
const k5FirmwareUrlLoad = document.getElementById("k5FirmwareUrlLoad");

if (k5FirmwareUrlLoad && k5FirmwareUrl) {
  k5FirmwareUrlLoad.addEventListener("click", async () => {
    const rawUrl = k5FirmwareUrl.value.trim();
    if (!rawUrl) {
      log("Please enter a firmware URL.", "error");
      return;
    }
    
    // Convert GitHub URL to jsDelivr CDN
    const url = convertGitHubUrl(rawUrl);
    if (k5FirmwareStatus) k5FirmwareStatus.textContent = "Loading from URL...";
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      k5SelectedFirmware = new Uint8Array(await response.arrayBuffer());
      
      let versionText = "unknown";
      try {
        const rawVersion = unpackFirmwareVersion(k5SelectedFirmware);
        const decoded = new TextDecoder().decode(rawVersion).replace(/\0.*$/, "");
        // Check if decoded text contains only printable ASCII characters
        if (decoded && /^[\x20-\x7E]+$/.test(decoded)) {
          versionText = decoded;
        }
      } catch (e) {}
      
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = `Ready: ${versionText} (${k5SelectedFirmware.length} bytes)`;
      if (k5FirmwareSelect) k5FirmwareSelect.value = "";
      log(`Loaded firmware from URL: ${versionText}`);
    } catch (error) {
      k5SelectedFirmware = null;
      if (k5FirmwareStatus) k5FirmwareStatus.textContent = `Error: ${error.message}`;
      log(`Failed to load firmware from URL: ${error.message}`, "error");
    }
    updateK5FlashButton();
  });
}

// ==================== RADIO TYPE CHANGE ====================
onRadioTypeChange((newType) => {
  const radioConfig = getRadioConfig();
  if (baudSelect) {
    baudSelect.innerHTML = "";
    radioConfig.baudRates.forEach((baud) => {
      const opt = document.createElement("option");
      opt.value = baud;
      opt.textContent = baud;
      if (baud === radioConfig.defaultBaud) opt.selected = true;
      baudSelect.appendChild(opt);
    });
  }
  log(`Switched to ${newType} mode`, "info");
});

// ==================== INITIALIZATION ====================
updateUI(false);
updateK5FlashButton();
log("Ready. Connect the radio to begin.");

if (footerCopyright) {
  const year = new Date().getFullYear();
  footerCopyright.textContent = `Copyright ${year} matoz.pt`;
}
