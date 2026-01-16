// smr-joaquim-uv-kx.js - SMR (Serial Monitor & Register) for Joaquim UV-KX Firmware
// Profile: Joaquim UV-KX

import { getPort, subscribe } from "./serial-manager.js";

const PROFILE_NAME = "Joaquim UV-KX";

// BK4819 Register definitions for Joaquim firmware
const BK4819_REGISTERS = {
  0x00: "Chip ID",
  0x02: "TX Power",
  0x07: "FSK Configuration",
  0x10: "Interrupt Status",
  0x13: "RSSI",
  0x30: "VCO Control",
  0x32: "Gain Control",
  0x33: "AFC",
  0x36: "Bandwidth",
  0x37: "XTAL",
  0x38: "RF Frequency Low",
  0x39: "RF Frequency High",
  0x3F: "BK4819 Revision",
  0x67: "Battery Voltage",
};

let smrRunning = false;
let smrReader = null;
let cleanupFn = null;

function updateStatus(msg) {
  const el = document.getElementById("smrStatus");
  if (el) el.textContent = `[${PROFILE_NAME}] ${msg}`;
}

function logSMR(msg, type = "info") {
  console.log(`[SMR-Joaquim] ${msg}`);
  const logEl = document.getElementById("smrLogOutput") || document.getElementById("logOutput");
  if (logEl) {
    const div = document.createElement("div");
    div.className = `log-${type}`;
    div.textContent = `[SMR] ${msg}`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

function formatRegisterValue(reg, value) {
  const name = BK4819_REGISTERS[reg] || `Register 0x${reg.toString(16).padStart(2, '0')}`;
  return `${name}: 0x${value.toString(16).padStart(4, '0')} (${value})`;
}

async function sendSMRCommand(port, cmd, data = []) {
  if (!port?.writable) return null;
  
  const writer = port.writable.getWriter();
  try {
    // Protocol: 0xAB 0xCD [cmd] [len] [data...] [checksum]
    const payload = [cmd, data.length, ...data];
    let checksum = 0;
    for (const b of payload) checksum ^= b;
    
    const packet = new Uint8Array([0xAB, 0xCD, ...payload, checksum]);
    await writer.write(packet);
  } finally {
    writer.releaseLock();
  }
  return true;
}

async function readRegister(reg) {
  const port = getPort();
  if (!port) {
    logSMR("Not connected", "error");
    return;
  }
  
  try {
    // Command 0x14 = Read BK4819 register
    await sendSMRCommand(port, 0x14, [reg]);
    logSMR(`Reading register 0x${reg.toString(16).padStart(2, '0')}...`);
  } catch (e) {
    logSMR(`Read error: ${e.message}`, "error");
  }
}

async function writeRegister(reg, value) {
  const port = getPort();
  if (!port) {
    logSMR("Not connected", "error");
    return;
  }
  
  try {
    // Command 0x16 = Write BK4819 register
    const highByte = (value >> 8) & 0xFF;
    const lowByte = value & 0xFF;
    await sendSMRCommand(port, 0x16, [reg, highByte, lowByte]);
    logSMR(`Writing 0x${value.toString(16).padStart(4, '0')} to register 0x${reg.toString(16).padStart(2, '0')}...`);
  } catch (e) {
    logSMR(`Write error: ${e.message}`, "error");
  }
}

async function monitorLoop(port, reader) {
  let buffer = new Uint8Array(0);
  
  try {
    while (smrRunning) {
      const { value, done } = await reader.read();
      if (done) break;
      
      // Append to buffer
      const newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;
      
      // Parse responses
      while (buffer.length >= 4) {
        // Find start marker
        let startIdx = -1;
        for (let i = 0; i < buffer.length - 2; i++) {
          if (buffer[i] === 0xAB && buffer[i+1] === 0xCD) {
            startIdx = i;
            break;
          }
        }
        
        if (startIdx === -1) {
          buffer = new Uint8Array(0);
          break;
        }
        
        if (buffer.length < startIdx + 4) break;
        
        const cmd = buffer[startIdx + 2];
        const len = buffer[startIdx + 3];
        
        if (buffer.length < startIdx + 4 + len) break;
        
        const data = buffer.slice(startIdx + 4, startIdx + 4 + len);
        
        // Parse register response
        if (cmd === 0x14 && len >= 3) {
          const reg = data[0];
          const value = (data[1] << 8) | data[2];
          logSMR(formatRegisterValue(reg, value), "success");
        }
        
        buffer = buffer.slice(startIdx + 4 + len + 1);
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError' && smrRunning) {
      logSMR(`Monitor error: ${e.message}`, "error");
    }
  }
}

async function startMonitor() {
  const port = getPort();
  if (!port) {
    updateStatus("Not connected");
    logSMR("Please connect to a radio first", "error");
    return;
  }
  
  if (smrRunning) return;
  
  try {
    smrReader = port.readable.getReader();
    smrRunning = true;
    updateStatus("Monitoring...");
    logSMR(`Started SMR monitor (${PROFILE_NAME})`);
    
    document.getElementById("smrStartBtn")?.setAttribute("disabled", "");
    document.getElementById("smrStopBtn")?.removeAttribute("disabled");
    
    await monitorLoop(port, smrReader);
  } catch (e) {
    logSMR(`Monitor error: ${e.message}`, "error");
    updateStatus("Error");
  } finally {
    await stopMonitor();
  }
}

async function stopMonitor() {
  smrRunning = false;
  
  if (smrReader) {
    try {
      await smrReader.cancel();
      smrReader.releaseLock();
    } catch (e) {}
    smrReader = null;
  }
  
  updateStatus("Stopped");
  document.getElementById("smrStartBtn")?.removeAttribute("disabled");
  document.getElementById("smrStopBtn")?.setAttribute("disabled", "");
  logSMR(`Stopped SMR monitor (${PROFILE_NAME})`);
}

function populateRegisterSelect() {
  const select = document.getElementById("smrRegisterSelect");
  if (!select) return;
  
  select.innerHTML = '<option value="">-- Select Register --</option>';
  for (const [reg, name] of Object.entries(BK4819_REGISTERS)) {
    const opt = document.createElement("option");
    opt.value = reg;
    opt.textContent = `0x${parseInt(reg).toString(16).padStart(2, '0')} - ${name}`;
    select.appendChild(opt);
  }
}

function initSMR() {
  populateRegisterSelect();
  
  document.getElementById("smrStartBtn")?.addEventListener("click", startMonitor);
  document.getElementById("smrStopBtn")?.addEventListener("click", stopMonitor);
  
  document.getElementById("smrReadBtn")?.addEventListener("click", () => {
    const select = document.getElementById("smrRegisterSelect");
    const customInput = document.getElementById("smrCustomRegister");
    let reg = select?.value ? parseInt(select.value) : null;
    if (!reg && customInput?.value) {
      reg = parseInt(customInput.value, 16);
    }
    if (reg !== null && !isNaN(reg)) {
      readRegister(reg);
    } else {
      logSMR("Please select or enter a register", "error");
    }
  });
  
  document.getElementById("smrWriteBtn")?.addEventListener("click", () => {
    const select = document.getElementById("smrRegisterSelect");
    const customInput = document.getElementById("smrCustomRegister");
    const valueInput = document.getElementById("smrWriteValue");
    
    let reg = select?.value ? parseInt(select.value) : null;
    if (!reg && customInput?.value) {
      reg = parseInt(customInput.value, 16);
    }
    
    const value = parseInt(valueInput?.value || "0", 16);
    
    if (reg !== null && !isNaN(reg) && !isNaN(value)) {
      writeRegister(reg, value);
    } else {
      logSMR("Please select/enter a register and value", "error");
    }
  });
  
  // Subscribe to serial connection changes
  cleanupFn = subscribe((connected) => {
    if (!connected && smrRunning) {
      stopMonitor();
    }
  });
  
  updateStatus("Ready");
  logSMR(`Initialized ${PROFILE_NAME} SMR profile`);
}

function cleanupSMR() {
  stopMonitor();
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}

// Initialize when page loads
document.addEventListener("spa:page", (e) => {
  if (e.detail?.page === "smr") {
    initSMR();
  } else {
    cleanupSMR();
  }
});

// Also init if already on the page
if (document.querySelector("#smr.active, .page#smr.active")) {
  initSMR();
}

export { startMonitor, stopMonitor, readRegister, writeRegister, initSMR, cleanupSMR };
