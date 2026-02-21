// flash-h3-ui.js
// TD-H3/H8 Firmware Flasher
// Adapted from h3webtools by nicFW

'use strict';

// ========== STATE ==========
let h3Port = null;
let h3Writer = null;
let h3Reader = null;
let h3Started = false;
let h3Firmware = null;
let h3FirmwareName = '';
let h3LastBlock = -1;
let h3Detected = false;
let h3Flashing = false;
let h3Block = 0;
let h3TimeoutId;

// ========== UI ELEMENTS ==========
const h3FlashBtn = document.getElementById('h3FlashBtn');
const h3FirmwareFile = document.getElementById('h3FirmwareFile');
const h3FirmwareSelect = document.getElementById('h3FirmwareSelect');
const h3FirmwareUrl = document.getElementById('h3FirmwareUrl');
const h3LoadUrlBtn = document.getElementById('h3LoadUrlBtn');
const h3Log = document.getElementById('h3Log');
const h3FlashFill = document.getElementById('h3FlashFill');
const h3FlashPct = document.getElementById('h3FlashPct');
const h3FirmwareStatus = document.getElementById('h3FirmwareStatus');
const h3AbortBtn = document.getElementById('h3AbortBtn');

// Init sequence for H3/H8 bootloader
const H3_INIT_SEQUENCE = new Uint8Array([
    0xA0, 0xEE, 0x74, 0x71, 0x07, 0x74,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55
]);

// ========== LOGGING ==========
function logH3(message, type = 'info') {
  console.log(`[H3] ${message}`);
  if (h3Log) {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    h3Log.appendChild(entry);
    h3Log.scrollTop = h3Log.scrollHeight;
  }
}

// ========== PROGRESS ==========
function updateH3Progress(percent) {
  if (h3FlashFill) h3FlashFill.style.width = `${percent}%`;
  if (h3FlashPct) h3FlashPct.textContent = `${Math.round(percent)}%`;
}

// ========== HELPER: Convert GitHub URLs to jsDelivr (avoids CORS issues) ==========
function convertGitHubUrlH3(url) {
  if (!url || !url.includes('github.com')) return url;

  // Convert github.com/user/repo/blob/branch/path → cdn.jsdelivr.net/gh/user/repo@branch/path
  let match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/(blob|tree|raw)\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, type, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
  }

  // Convert raw.githubusercontent.com/user/repo/branch/path → cdn.jsdelivr.net/gh/user/repo@branch/path
  match = url.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
  }

  return url;
}

// ========== FIRMWARE LOADING ==========
function processFirmwareData(data, name) {
  const fileBytes = new Uint8Array(data);
  const roundedLength = Math.ceil(fileBytes.length / 32) * 32;

  if (roundedLength > 0xf800) {
    throw new Error("File too large (max 63488 bytes)");
  }

  h3LastBlock = (roundedLength / 32) - 1;
  h3Firmware = new Uint8Array(roundedLength);
  h3Firmware.set(fileBytes);
  h3FirmwareName = name;

  logH3(`✅ Firmware loaded: ${name} (${fileBytes.length} bytes)`, 'success');
  if (h3FirmwareStatus) {
    h3FirmwareStatus.textContent = `✅ Selected: ${name} (${fileBytes.length} bytes)`;
    h3FirmwareStatus.style.color = '#00ff00';
  }
  setH3ActiveButtons();
}

async function loadH3FirmwareFromUrl(url) {
  logH3(`Fetching firmware from URL...`);
  try {
    // Convert GitHub URLs to jsDelivr to avoid CORS
    let fetchUrl = url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      fetchUrl = convertGitHubUrlH3(url);
      if (fetchUrl !== url) {
        logH3(`Converted GitHub URL to CDN: ${fetchUrl}`);
      }
    }
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    const name = url.split('/').pop() || 'firmware.bin';
    processFirmwareData(buffer, name);
    return true;
  } catch (e) {
    logH3(`❌ Failed to load firmware: ${e.message}`, 'error');
    if (h3FirmwareStatus) {
      h3FirmwareStatus.textContent = `❌ ${e.message}`;
      h3FirmwareStatus.style.color = '#ff4444';
    }
    return false;
  }
}

async function loadH3FirmwareFromFile(file) {
  logH3(`Loading firmware: ${file.name}...`);
  try {
    const buffer = await file.arrayBuffer();
    processFirmwareData(buffer, file.name);
    return true;
  } catch (e) {
    logH3(`❌ File error: ${e.message}`, 'error');
    if (h3FirmwareStatus) {
      h3FirmwareStatus.textContent = `❌ ${e.message}`;
      h3FirmwareStatus.style.color = '#ff4444';
    }
    return false;
  }
}

// ========== PRELOADED FIRMWARES ==========
async function loadH3PreloadedFirmwares() {
  if (!h3FirmwareSelect) return;

  try {
    const response = await fetch('js/firmwares.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    h3FirmwareSelect.innerHTML = '<option value="">-- Select Firmware --</option>';

    if (data.h3_firmwares && data.h3_firmwares.length > 0) {
      data.h3_firmwares.forEach(group => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = group.group;
        group.firmwares.forEach(fw => {
          // Skip entries with empty path
          if (!fw.path) return;
          const option = document.createElement('option');
          // Convert GitHub URLs via jsDelivr to avoid CORS
          let fwUrl = fw.path;
          if (fwUrl.startsWith('http://') || fwUrl.startsWith('https://')) {
            fwUrl = convertGitHubUrlH3(fwUrl);
          }
          option.value = fwUrl;
          option.textContent = fw.name;
          optgroup.appendChild(option);
        });
        // Only add optgroup if it has options
        if (optgroup.children.length > 0) {
          h3FirmwareSelect.appendChild(optgroup);
        }
      });
    }

    console.log('[H3] Preloaded firmwares loaded successfully');
  } catch (e) {
    console.error('[H3] Failed to load firmwares:', e);
    h3FirmwareSelect.innerHTML = '<option value="">-- No preloaded firmwares --</option>';
  }
}

// ========== SERIAL ==========
function disposeH3Serial() {
  try { if (h3Writer) h3Writer.releaseLock(); } catch {}
  try { if (h3Reader) h3Reader.releaseLock(); } catch {}
  try { if (h3Port) h3Port.close(); } catch {}
}

function closeH3Serial() {
  disposeH3Serial();
  h3Port = null;
  h3Reader = null;
  h3Writer = null;
}

async function openH3Serial(baud) {
  if (h3Port) {
    try {
      await h3Port.open({ baudRate: baud });
      h3Writer = h3Port.writable.getWriter();
      h3Reader = h3Port.readable.getReader();
      return true;
    } catch (error) {
      logH3(`Serial port error: ${error.message}`, 'error');
      closeH3Serial();
    }
  }
  return false;
}

function setH3ActiveButtons() {
  const canFlash = h3Firmware !== null && !h3Flashing;
  if (h3FlashBtn) h3FlashBtn.disabled = !canFlash;
  if (h3AbortBtn) h3AbortBtn.disabled = !h3Flashing;
  if (h3FirmwareFile) h3FirmwareFile.disabled = h3Flashing;
  if (h3FirmwareSelect) h3FirmwareSelect.disabled = h3Flashing;
  if (h3FirmwareUrl) h3FirmwareUrl.disabled = h3Flashing;
  if (h3LoadUrlBtn) h3LoadUrlBtn.disabled = h3Flashing;
}

// ========== FLASH PROTOCOL ==========
async function detectH3() {
  try {
    // Try to detect bootloader
    for (let attempt = 0; attempt < 3 && !h3Detected; attempt++) {
      await h3Writer.write(H3_INIT_SEQUENCE);
      logH3(`Sending init sequence (attempt ${attempt + 1})...`);

      // Wait for response
      const startTime = Date.now();
      while (Date.now() - startTime < 2000) {
        const { value, done } = await Promise.race([
          h3Reader.read(),
          new Promise((_, reject) => setTimeout(() => reject('timeout'), 500))
        ]).catch(() => ({ value: null, done: false }));

        if (value && value.length > 0) {
          if (value[0] === 0x89 || value.includes(0x89)) {
            h3Detected = true;
            logH3('✅ Bootloader detected!', 'success');
            return true;
          }
        }
        if (done) break;
      }
    }
    return h3Detected;
  } catch (e) {
    return false;
  }
}

function createH3Block(blockNumber) {
  const offset = blockNumber * 32;
  const packet = new Uint8Array(37);

  // Header
  packet[0] = 0xA1;
  packet[1] = (offset >> 8) & 0xFF;
  packet[2] = offset & 0xFF;

  // Data (32 bytes)
  for (let i = 0; i < 32; i++) {
    packet[3 + i] = h3Firmware[offset + i] || 0x00;
  }

  // Checksum
  let checksum = 0;
  for (let i = 0; i < 35; i++) {
    checksum ^= packet[i];
  }
  packet[35] = checksum;
  packet[36] = 0xA2;

  return packet;
}

async function flashH3() {
  if (!h3Firmware) {
    logH3('❌ No firmware loaded!', 'error');
    return;
  }

  h3Flashing = true;
  h3Started = true;
  h3Block = 0;
  h3Detected = false;
  setH3ActiveButtons();
  updateH3Progress(0);

  logH3('🚀 Starting TD-H3/H8 flash process...');
  logH3(`📄 Firmware: ${h3FirmwareName}`);
  logH3('⚠️ Put radio in bootloader mode: Hold PTT + Power On');

  try {
    // Request port
    logH3('Requesting serial port...');
    h3Port = await navigator.serial.requestPort();

    // Open at 115200 baud
    logH3('Opening port at 115200 baud...');
    if (!await openH3Serial(115200)) {
      throw new Error('Failed to open serial port');
    }

    // Detect bootloader
    logH3('Detecting bootloader...');
    if (!await detectH3()) {
      throw new Error('Bootloader not detected. Make sure radio is in bootloader mode (PTT + Power On)');
    }

    // Flash blocks
    const totalBlocks = h3LastBlock + 1;
    logH3(`📝 Writing ${totalBlocks} blocks (${h3Firmware.length} bytes)...`);

    for (h3Block = 0; h3Block <= h3LastBlock && h3Started; h3Block++) {
      const packet = createH3Block(h3Block);
      await h3Writer.write(packet);

      // Wait for ACK
      const ackTimeout = setTimeout(() => {
        logH3(`⚠️ Block ${h3Block} ACK timeout`, 'warning');
      }, 1000);

      try {
        const { value } = await Promise.race([
          h3Reader.read(),
          new Promise((_, reject) => setTimeout(() => reject('timeout'), 1000))
        ]);
        clearTimeout(ackTimeout);

        if (!value || value[0] !== 0x06) {
          logH3(`⚠️ Block ${h3Block} - unexpected response`, 'warning');
        }
      } catch (e) {
        clearTimeout(ackTimeout);
      }

      const progress = ((h3Block + 1) / totalBlocks) * 100;
      updateH3Progress(progress);

      if ((h3Block + 1) % 50 === 0 || h3Block === h3LastBlock) {
        logH3(`Block ${h3Block + 1}/${totalBlocks} (${Math.round(progress)}%)`);
      }
    }

    if (h3Started) {
      logH3('✅ Flash completed successfully!', 'success');
      logH3('🔄 Turn off the radio and turn it back on.');
      updateH3Progress(100);
    }

  } catch (error) {
    logH3(`❌ Flashing failed: ${error.message}`, 'error');
    h3Started = false;
  }

  closeH3Serial();
  h3Flashing = false;
  setH3ActiveButtons();
}

// ========== EVENT LISTENERS ==========
if (h3FirmwareSelect) {
  h3FirmwareSelect.addEventListener('change', async () => {
    if (h3FirmwareSelect.value) {
      await loadH3FirmwareFromUrl(h3FirmwareSelect.value);
      // Clear other inputs
      if (h3FirmwareFile) h3FirmwareFile.value = '';
      if (h3FirmwareUrl) h3FirmwareUrl.value = '';
    }
  });
}

if (h3FirmwareFile) {
  h3FirmwareFile.addEventListener('change', async (event) => {
    if (event.target.files[0]) {
      await loadH3FirmwareFromFile(event.target.files[0]);
      // Clear other inputs
      if (h3FirmwareSelect) h3FirmwareSelect.value = '';
      if (h3FirmwareUrl) h3FirmwareUrl.value = '';
    }
  });
}

if (h3LoadUrlBtn && h3FirmwareUrl) {
  h3LoadUrlBtn.addEventListener('click', async () => {
    const url = h3FirmwareUrl.value.trim();
    if (url) {
      await loadH3FirmwareFromUrl(url);
      // Clear other inputs
      if (h3FirmwareSelect) h3FirmwareSelect.value = '';
      if (h3FirmwareFile) h3FirmwareFile.value = '';
    }
  });
}

if (h3FlashBtn) {
  h3FlashBtn.addEventListener('click', async () => {
    await flashH3();
  });
}

if (h3AbortBtn) {
  h3AbortBtn.addEventListener('click', () => {
    h3Started = false;
    closeH3Serial();
    logH3('⚠️ Flash aborted by user', 'warning');
    h3Flashing = false;
    setH3ActiveButtons();
  });
}

// ========== INITIALIZATION ==========
if (!('serial' in navigator)) {
  logH3('❌ Web Serial not supported in this browser!', 'error');
  if (h3FlashBtn) h3FlashBtn.disabled = true;
} else {
  logH3('TD-H3/H8 Flash ready. Select firmware to begin.');
  logH3('⚠️ Put radio in bootloader mode: Hold PTT + Power On');
}

// Load preloaded firmwares
loadH3PreloadedFirmwares();

setH3ActiveButtons();

console.log('[H3 Flash UI] Initialized successfully!');
