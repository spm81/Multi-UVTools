// flash-rt890-ui.js
// RT-890/TK11 Flash UI
// Based on DualTachyon protocol
// v7.4 - Added firmware size validation (60416 bytes)

'use strict';

// ========== FIRMWARE SIZE VALIDATION ==========
// RT-890 firmware MUST be exactly 60416 bytes (per GitHub bricky149/rt890-flash-rs)
const RT890_FIRMWARE_SIZE = 60416;

// Helper function to load GitHub Release assets (CORS-enabled via API)
async function loadFirmwareWithCORS(releaseUrl) {
  console.log('[GitHub] Loading release asset from:', releaseUrl);
  
  // Parse: github.com/USER/REPO/releases/download/TAG/FILENAME
  const match = releaseUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/releases\/download\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid GitHub release URL');
  }
  
  const [, user, repo, tag, filename] = match;
  console.log(`[GitHub] Parsed: ${user}/${repo} @ ${tag} → ${filename}`);
  
  // Step 1: Get release info from GitHub API
  const apiUrl = `https://api.github.com/repos/${user}/${repo}/releases/tags/${tag}`;
  console.log('[GitHub] Fetching release info from API...');
  
  const releaseResponse = await fetch(apiUrl);
  if (!releaseResponse.ok) {
    throw new Error(`GitHub API error: ${releaseResponse.status}`);
  }
  
  const releaseData = await releaseResponse.json();
  
  // Step 2: Find matching asset
  const asset = releaseData.assets.find(a => a.name === filename);
  if (!asset) {
    throw new Error(`Asset "${filename}" not found in release "${tag}"`);
  }
  
  console.log(`[GitHub] Found asset ID ${asset.id}: ${asset.name} (${asset.size} bytes)`);
  
  // Step 3: Download via API (has CORS!)
  const assetUrl = asset.url;
  console.log('[GitHub] Downloading asset via API...');
  
  const assetResponse = await fetch(assetUrl, {
    headers: {
      'Accept': 'application/octet-stream'
    }
  });
  
  if (!assetResponse.ok) {
    throw new Error(`Asset download failed: ${assetResponse.status}`);
  }
  
  const arrayBuffer = await assetResponse.arrayBuffer();
  console.log(`[GitHub] ✅ Downloaded ${arrayBuffer.byteLength} bytes`);
  
  return new Uint8Array(arrayBuffer);
}

// Helper function to convert GitHub URLs to jsDelivr (avoids CORS issues)
function convertGitHubUrl(url) {
  let match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
  }
  match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/raw\/refs\/heads\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
  }
  match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/raw\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
  }
  match = url.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)/);
  if (match) {
    const [, user, repo, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
  }
  return url;
}



// ========== CONSTANTS ==========
const BAUDRATE_RT890 = 115200;
const BLOCK_SIZE = 128;
const READ_TIMEOUT = 2000;

// Commands
const CMD_ERASE_FLASH = 0x39;
const CMD_WRITE_FLASH = 0x57;
const CMD_READ_FLASH = 0x52;

// Response
const ACK = 0x06;
const BOOTLOADER_MODE = 0xFF;

// ========== STATE ==========
let rt890Port = null;
let rt890Reader = null;
let rt890Writer = null;
let rt890FirmwareData = null;
let rt890FirmwareName = '';
let isRt890Flashing = false;
let rt890ReadBuffer = [];
let isRt890Reading = false;

// ========== UI ELEMENTS ==========
const rt890FlashBtn = document.getElementById('rt890FlashBtn');
const rt890FirmwareFile = document.getElementById('rt890FirmwareFile');
const rt890FirmwareSelect = document.getElementById('rt890FirmwareSelect');
const rt890Log = document.getElementById('rt890Log');
const rt890FlashFill = document.getElementById('rt890FlashFill');
const rt890FlashPct = document.getElementById('rt890FlashPct');
const rt890FirmwareStatus = document.getElementById('rt890FirmwareStatus');

// ========== LOGGING ==========
function logRt890(message, type = 'info') {
  console.log(`[RT890] ${message}`);
  if (rt890Log) {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    rt890Log.appendChild(entry);
    rt890Log.scrollTop = rt890Log.scrollHeight;
  }
}

// ========== HELPERS ==========
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Simple checksum: sum of all bytes mod 256
function calcChecksum(data, length) {
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum = (sum + data[i]) & 0xFF;
  }
  return sum;
}

function verifyChecksum(data) {
  const sum = calcChecksum(data, data.length - 1);
  return data[data.length - 1] === sum;
}

// ========== FIRMWARE VALIDATION ==========
function validateRt890Firmware(data, name) {
  const size = data.length;
  
  // Check exact size (60416 bytes)
  if (size !== RT890_FIRMWARE_SIZE) {
    const msg = `Invalid firmware size!\n` +
                `Expected: ${RT890_FIRMWARE_SIZE} bytes (59 KB)\n` +
                `Got: ${size} bytes (${(size / 1024).toFixed(1)} KB)\n\n` +
                `RT-890 firmware must be exactly 60416 bytes.`;
    logRt890(msg, 'error');
    return false;
  }
  
  logRt890(`✅ Firmware size validated: ${size} bytes (OK!)`, 'success');
  return true;
}

// ========== PROGRESS ==========
function updateRt890Progress(percent) {
  const rounded = Math.round(percent);
  if (rt890FlashFill) rt890FlashFill.style.width = `${rounded}%`;
  if (rt890FlashPct) rt890FlashPct.textContent = `${rounded}%`;
}

// ========== BUTTON STATE ==========
function updateRt890FlashButton() {
  if (rt890FlashBtn) {
    rt890FlashBtn.disabled = !rt890FirmwareData || isRt890Flashing;
    if (rt890FirmwareData && !isRt890Flashing) {
      rt890FlashBtn.classList.add('ready');
    } else {
      rt890FlashBtn.classList.remove('ready');
    }
  }
}

// ========== FIRMWARE LOADING ==========
function setRt890FirmwareBuffer(buf, name = 'firmware.bin') {
  const data = new Uint8Array(buf);
  
  // Validate firmware size BEFORE accepting
  if (!validateRt890Firmware(data, name)) {
    rt890FirmwareData = null;
    rt890FirmwareName = '';
    if (rt890FirmwareStatus) {
      rt890FirmwareStatus.textContent = `❌ Invalid firmware: ${name} (wrong size)`;
      rt890FirmwareStatus.style.color = '#ff4444';
    }
    updateRt890FlashButton();
    return false;
  }
  
  rt890FirmwareData = data;
  rt890FirmwareName = name;
  logRt890(`Firmware loaded: ${name} (${rt890FirmwareData.length} bytes)`, 'success');
  
  // Update status display
  if (rt890FirmwareStatus) {
    rt890FirmwareStatus.textContent = `✅ Selected: ${name} (${rt890FirmwareData.length} bytes)`;
    rt890FirmwareStatus.style.color = '#00ff00';
  }
  updateRt890FlashButton();
  return true;
}

async function loadRt890FirmwareFromUrl(url, name) {
  try {
    logRt890(`Loading firmware from: ${name}...`);
    
    // Check if it's a GitHub Release URL (needs special handling)
    if (url.includes('/releases/download/')) {
      logRt890('[RT890] Detected GitHub Release URL - using API loader');
      const firmwareData = await loadFirmwareWithCORS(url);
      setRt890FirmwareBuffer(firmwareData.buffer, name);
      logRt890(`[RT890] ✅ Firmware loaded: ${firmwareData.byteLength} bytes`);
    } else {
      // Regular URL or GitHub repository file
      let fetchUrl = url;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        fetchUrl = convertGitHubUrl(url);
        if (fetchUrl !== url) {
          logRt890(`Converted GitHub URL to: ${fetchUrl}`);
        }
      }
      
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      setRt890FirmwareBuffer(buffer, name);
      logRt890(`[RT890] ✅ Firmware loaded: ${buffer.byteLength} bytes`);
    }
  } catch (error) {
    logRt890(`Error loading firmware: ${error.message}`, 'error');
    rt890FirmwareData = null;
    rt890FirmwareName = '';
    updateRt890FlashButton();
  }
}

// ========== SERIAL CONNECTION ==========
async function connectRt890() {
  try {
    logRt890('Requesting serial port...');
    rt890Port = await navigator.serial.requestPort();
    logRt890(`Opening port at ${BAUDRATE_RT890} baud...`);
    await rt890Port.open({ 
      baudRate: BAUDRATE_RT890,
      dataBits: 8,
      parity: 'none',
      stopBits: 1
    });
    
    rt890Reader = rt890Port.readable.getReader();
    rt890Writer = rt890Port.writable.getWriter();
    
    startRt890Reading();
    await sleep(500);
    
    logRt890('Connected!', 'success');
  } catch (e) {
    logRt890(`Connection error: ${e?.message ?? String(e)}`, 'error');
    throw e;
  }
}

async function disconnectRt890() {
  isRt890Reading = false;
  if (rt890Reader) {
    try { await rt890Reader.cancel(); } catch {}
    try { rt890Reader.releaseLock(); } catch {}
    rt890Reader = null;
  }
  if (rt890Writer) {
    try { await rt890Writer.close(); } catch {}
    rt890Writer = null;
  }
  if (rt890Port) {
    try { await rt890Port.close(); } catch {}
    rt890Port = null;
  }
  logRt890('Disconnected');
}

function startRt890Reading() {
  if (!rt890Reader || isRt890Reading) return;
  isRt890Reading = true;
  rt890ReadLoop().catch(e => {
    if (isRt890Reading) logRt890(`Read error: ${e?.message}`, 'error');
  });
}

async function rt890ReadLoop() {
  try {
    while (isRt890Reading && rt890Reader) {
      const { value, done } = await rt890Reader.read();
      if (done) break;
      if (value?.length) {
        rt890ReadBuffer.push(...value);
      }
    }
  } catch (e) {
    if (isRt890Reading) logRt890(`Read error: ${e?.message}`, 'error');
  }
}

// ========== PROTOCOL COMMANDS ==========

// Wait for specific number of bytes with timeout
async function waitForBytes(count, timeoutMs = READ_TIMEOUT) {
  const startTime = Date.now();
  while (rt890ReadBuffer.length < count) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for ${count} bytes (got ${rt890ReadBuffer.length})`);
    }
    await sleep(10);
  }
  return rt890ReadBuffer.splice(0, count);
}

// Wait for single ACK byte
async function waitForAck(timeoutMs = READ_TIMEOUT) {
  const startTime = Date.now();
  while (rt890ReadBuffer.length < 1) {
    if (Date.now() - startTime > timeoutMs) {
      return false;
    }
    await sleep(10);
  }
  const response = rt890ReadBuffer.shift();
  return response === ACK;
}

// Check if radio is in bootloader mode
async function isBootloaderMode() {
  rt890ReadBuffer = [];
  
  // Try to read flash at address 0
  const command = new Uint8Array(4);
  command[0] = CMD_READ_FLASH;
  command[1] = 0x00;
  command[2] = 0x00;
  command[3] = calcChecksum(command, 3);
  
  await rt890Writer.write(command);
  
  try {
    const response = await waitForBytes(1, 1000);
    
    if (response[0] === BOOTLOADER_MODE) {
      await sleep(100);
      rt890ReadBuffer = [];
      return true;
    }
    
    // Got data, not in bootloader
    await waitForBytes(BLOCK_SIZE + 3, 1000);
    return false;
    
  } catch (e) {
    return true;
  }
}

// Erase flash command
async function eraseFlash() {
  logRt890('Erasing flash (this may take a moment)...');
  
  const command = new Uint8Array(5);
  command[0] = CMD_ERASE_FLASH;
  command[1] = 0x00;
  command[2] = 0x00;
  command[3] = 0x55; // Magic byte
  command[4] = calcChecksum(command, 4);
  
  rt890ReadBuffer = [];
  await rt890Writer.write(command);
  
  const ack = await waitForAck(10000); // Erase can take up to 10 seconds
  if (!ack) {
    throw new Error('Flash erase failed - no ACK received');
  }
  
  logRt890('Flash erased!', 'success');
  return true;
}

// Write flash command (128 bytes at a time)
async function writeFlash(offset, data) {
  const command = new Uint8Array(BLOCK_SIZE + 4);
  command[0] = CMD_WRITE_FLASH;
  command[1] = (offset >> 8) & 0xFF; // Offset high (Big Endian)
  command[2] = offset & 0xFF;        // Offset low
  
  const len = Math.min(BLOCK_SIZE, data.length);
  for (let i = 0; i < len; i++) {
    command[3 + i] = data[i];
  }
  for (let i = len; i < BLOCK_SIZE; i++) {
    command[3 + i] = 0xFF;
  }
  
  command[BLOCK_SIZE + 3] = calcChecksum(command, BLOCK_SIZE + 3);
  
  rt890ReadBuffer = [];
  await rt890Writer.write(command);
  
  return await waitForAck(2000);
}

// ========== FLASH FIRMWARE ==========
async function flashRt890() {
  if (!rt890FirmwareData || isRt890Flashing) return;
  
  // Final validation before flashing
  if (rt890FirmwareData.length !== RT890_FIRMWARE_SIZE) {
    logRt890(`ABORT: Firmware size (${rt890FirmwareData.length}) != expected (${RT890_FIRMWARE_SIZE})`, 'error');
    return;
  }
  
  isRt890Flashing = true;
  updateRt890FlashButton();
  updateRt890Progress(0);
  rt890ReadBuffer = [];
  
  try {
    // Connect
    await connectRt890();
    await sleep(500);
    
    // Check bootloader mode
    logRt890('Checking bootloader mode...');
    const bootloader = await isBootloaderMode();
    
    if (!bootloader) {
      throw new Error('Radio is NOT in bootloader mode!\nTurn off radio, hold PTT, then turn on.');
    }
    
    logRt890('Bootloader mode detected!', 'success');
    
    // Erase flash
    await eraseFlash();
    
    // Calculate total blocks
    const totalBlocks = Math.ceil(rt890FirmwareData.length / BLOCK_SIZE);
    logRt890(`Programming ${totalBlocks} blocks (${rt890FirmwareData.length} bytes)...`);
    
    // Write firmware
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    for (let block = 0; block < totalBlocks; block++) {
      const offset = block * BLOCK_SIZE;
      const blockData = rt890FirmwareData.slice(offset, offset + BLOCK_SIZE);
      
      const progress = ((block + 1) / totalBlocks) * 100;
      updateRt890Progress(progress);
      
      const success = await writeFlash(offset, blockData);
      
      if (!success) {
        retryCount++;
        logRt890(`Block ${block + 1}/${totalBlocks} failed, retry ${retryCount}/${MAX_RETRIES}`, 'error');
        
        if (retryCount > MAX_RETRIES) {
          throw new Error(`Too many errors at offset 0x${offset.toString(16).toUpperCase()}`);
        }
        
        block--;
        await sleep(100);
        continue;
      }
      
      retryCount = 0;
      
      if ((block + 1) % 20 === 0 || block === totalBlocks - 1) {
        logRt890(`Block ${block + 1}/${totalBlocks} (0x${offset.toString(16).toUpperCase()}) OK`);
      }
    }
    
    updateRt890Progress(100);
    logRt890('═══════════════════════════════════════', 'success');
    logRt890('Flash complete!', 'success');
    logRt890('Turn off the radio and turn it back on.', 'success');
    logRt890('═══════════════════════════════════════', 'success');
    
  } catch (e) {
    logRt890(`Flash error: ${e?.message ?? String(e)}`, 'error');
  } finally {
    isRt890Flashing = false;
    updateRt890FlashButton();
    if (rt890Port) await disconnectRt890();
  }
}

// ========== EVENT LISTENERS ==========

// File input
if (rt890FirmwareFile) {
  rt890FirmwareFile.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = (ev) => setRt890FirmwareBuffer(ev.target.result, file.name);
    fr.readAsArrayBuffer(file);
  });
}

// Select dropdown
if (rt890FirmwareSelect) {
  rt890FirmwareSelect.addEventListener('change', async (e) => {
    const value = e.target.value;
    if (value && value !== '') {
      const selectedOption = e.target.options[e.target.selectedIndex];
      const name = selectedOption ? selectedOption.textContent : value;
      await loadRt890FirmwareFromUrl(value, name);
    } else {
      rt890FirmwareData = null;
      rt890FirmwareName = '';
      updateRt890FlashButton();
    }
  });
}

// URL input loading
const rt890FirmwareUrl = document.getElementById('rt890FirmwareUrl');
const rt890LoadUrlBtn = document.getElementById('rt890LoadUrlBtn');
if (rt890LoadUrlBtn && rt890FirmwareUrl) {
  rt890LoadUrlBtn.addEventListener('click', async () => {
    const inputUrl = rt890FirmwareUrl.value.trim();
    if (!inputUrl) {
      logRt890('Please enter a firmware URL', 'error');
      return;
    }
    try {
      rt890LoadUrlBtn.disabled = true;
      rt890LoadUrlBtn.textContent = 'Loading...';
      if (rt890FirmwareStatus) rt890FirmwareStatus.textContent = 'Loading firmware from URL...';
      logRt890(`Loading firmware from URL...`);
      
      // Check if it's a GitHub Release URL (needs special handling)
      if (inputUrl.includes('/releases/download/')) {
        logRt890('[RT890] Detected GitHub Release URL - using API loader');
        const firmwareData = await loadFirmwareWithCORS(inputUrl);
        const name = inputUrl.split('/').pop() || 'firmware.bin';
        setRt890FirmwareBuffer(firmwareData.buffer, name);
        logRt890(`[RT890] ✅ Firmware loaded: ${firmwareData.byteLength} bytes`);
      } else {
        // Regular URL or GitHub repository file
        const url = convertGitHubUrl(inputUrl);
        if (url !== inputUrl) {
          logRt890(`Converted GitHub URL to CDN: ${url}`);
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const buffer = await response.arrayBuffer();
        const name = url.split('/').pop() || 'firmware.bin';
        setRt890FirmwareBuffer(buffer, name);
        logRt890(`[RT890] ✅ Firmware loaded: ${buffer.byteLength} bytes`);
      }
      
      // Clear other inputs
      if (rt890FirmwareSelect) rt890FirmwareSelect.value = '';
      if (rt890FirmwareFile) rt890FirmwareFile.value = '';
    } catch (err) {
      rt890FirmwareData = null;
      rt890FirmwareName = '';
      updateRt890FlashButton();
      if (rt890FirmwareStatus) rt890FirmwareStatus.textContent = 'Failed to load firmware from URL';
      logRt890(`Error loading firmware from URL: ${err.message}`, 'error');
      if (err.message === 'Failed to fetch') {
        logRt890('Tip: This may be a CORS error. Try using a direct download link.', 'error');
      }
    } finally {
      rt890LoadUrlBtn.disabled = false;
      rt890LoadUrlBtn.textContent = 'Load';
    }
  });
}

// Flash button
if (rt890FlashBtn) {
  rt890FlashBtn.addEventListener('click', async () => {
    console.log('[RT890] Flash button clicked!');
    await flashRt890();
  });
  rt890FlashBtn.disabled = true;
}

// Web Serial check
if (!('serial' in navigator)) {
  logRt890('Web Serial not supported in this browser!', 'error');
  if (rt890FlashBtn) rt890FlashBtn.disabled = true;
} else {
  logRt890('RT-890/TK11 Flash ready. Select firmware to begin.');
  logRt890(`📏 Expected firmware size: ${RT890_FIRMWARE_SIZE} bytes (59 KB)`);
}

console.log('[RT890 UI] Initialized successfully!');

// Export
export { flashRt890, updateRt890FlashButton, RT890_FIRMWARE_SIZE };
