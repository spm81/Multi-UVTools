// flash-k1-ui.js
// K1 Flash UI - Based on working uvtools2 flash.js

'use strict';

// ========== CONSTANTS ==========
const BAUDRATE_K1 = 38400;

// Message types (same as K5 - shared bootloader protocol)
const MSG_NOTIFY_DEV_INFO = 0x0518;
const MSG_NOTIFY_BL_VER = 0x0530;
const MSG_PROG_FW = 0x0519;
const MSG_PROG_FW_RESP = 0x051A;

const OBFUS_TBL = new Uint8Array([
  0x16, 0x6c, 0x14, 0xe6, 0x2e, 0x91, 0x0d, 0x40,
  0x21, 0x35, 0xd5, 0x40, 0x13, 0x03, 0xe9, 0x80
]);

// ========== STATE ==========
let k1Port = null;
let k1Reader = null;
let k1Writer = null;
let k1FirmwareData = null;
let k1FirmwareName = '';
let isK1Flashing = false;
let k1ReadBuffer = [];
let isK1Reading = false;

// ========== UI ELEMENTS ==========
const k1FlashBtn = document.getElementById('k1FlashBtn');
const k1FirmwareFile = document.getElementById('k1FirmwareFile');
const k1FirmwareSelect = document.getElementById('k1FirmwareSelect');
const k1Log = document.getElementById('k1Log');
const k1FlashFill = document.getElementById('k1FlashFill');
const k1FlashPct = document.getElementById('k1FlashPct');

// ========== LOGGING ==========
function logK1(message, type = 'info') {
  console.log(`[K1] ${message}`);
  if (k1Log) {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    k1Log.appendChild(entry);
    k1Log.scrollTop = k1Log.scrollHeight;
  }
}

// ========== PROGRESS ==========
function updateK1Progress(percent) {
  const rounded = Math.round(percent);
  if (k1FlashFill) k1FlashFill.style.width = `${rounded}%`;
  if (k1FlashPct) k1FlashPct.textContent = `${rounded}%`;
}

// ========== BUTTON STATE ==========
function updateK1FlashButton() {
  if (k1FlashBtn) {
    k1FlashBtn.disabled = !k1FirmwareData || isK1Flashing;
    if (k1FirmwareData && !isK1Flashing) {
      k1FlashBtn.classList.add('ready');
    } else {
      k1FlashBtn.classList.remove('ready');
    }
  }
}

// ========== FIRMWARE LOADING ==========
function setK1FirmwareBuffer(buf, name = 'firmware.bin') {
  k1FirmwareData = new Uint8Array(buf);
  k1FirmwareName = name;
  logK1(`Firmware loaded: ${name} (${k1FirmwareData.length} bytes)`, 'success');
  updateK1FlashButton();
}

async function loadK1FirmwareFromUrl(url, name) {
  try {
    logK1(`Loading firmware from: ${name}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    setK1FirmwareBuffer(buffer, name);
  } catch (error) {
    logK1(`Error loading firmware: ${error.message}`, 'error');
    k1FirmwareData = null;
    k1FirmwareName = '';
    updateK1FlashButton();
  }
}

// ========== SERIAL CONNECTION ==========
async function connectK1() {
  try {
    logK1('Requesting serial port...');
    k1Port = await navigator.serial.requestPort();
    logK1(`Opening port at ${BAUDRATE_K1} baud...`);
    await k1Port.open({ baudRate: BAUDRATE_K1 });
    
    k1Reader = k1Port.readable.getReader();
    k1Writer = k1Port.writable.getWriter();
    
    startK1Reading();
    await sleep(500);
    
    logK1('Connected!', 'success');
  } catch (e) {
    logK1(`Connection error: ${e?.message ?? String(e)}`, 'error');
    throw e;
  }
}

async function disconnectK1() {
  isK1Reading = false;
  if (k1Reader) {
    try { await k1Reader.cancel(); } catch {}
    try { k1Reader.releaseLock(); } catch {}
    k1Reader = null;
  }
  if (k1Writer) {
    try { await k1Writer.close(); } catch {}
    k1Writer = null;
  }
  if (k1Port) {
    try { await k1Port.close(); } catch {}
    k1Port = null;
  }
  logK1('Disconnected');
}

function startK1Reading() {
  if (!k1Reader || isK1Reading) return;
  isK1Reading = true;
  k1ReadLoop().catch(e => {
    if (isK1Reading) logK1(`Read error: ${e?.message}`, 'error');
  });
}

async function k1ReadLoop() {
  try {
    while (isK1Reading && k1Reader) {
      const { value, done } = await k1Reader.read();
      if (done) break;
      if (value?.length) {
        k1ReadBuffer.push(...value);
      }
    }
  } catch (e) {
    if (isK1Reading) logK1(`Read error: ${e?.message}`, 'error');
  }
}

// ========== PROTOCOL HELPERS ==========
function createK1Message(msgType, dataLen) {
  const msg = new Uint8Array(4 + dataLen);
  const view = new DataView(msg.buffer);
  view.setUint16(0, msgType, true);
  view.setUint16(2, dataLen, true);
  return msg;
}

async function sendK1Message(msg) {
  const packet = makeK1Packet(msg);
  await k1Writer.write(packet);
}

function makeK1Packet(msg) {
  let msgLen = msg.length;
  if (msgLen % 2 !== 0) msgLen++;
  const buf = new Uint8Array(8 + msgLen);
  const view = new DataView(buf.buffer);

  view.setUint16(0, 0xCDAB, true);
  view.setUint16(2, msgLen, true);
  view.setUint16(6 + msgLen, 0xBADC, true);

  for (let i = 0; i < msg.length; i++) buf[4 + i] = msg[i];

  const crc = calcK1CRC(buf, 4, msgLen);
  view.setUint16(4 + msgLen, crc, true);

  obfuscateK1(buf, 4, 2 + msgLen);
  return buf;
}

function fetchK1Message(buf) {
  if (buf.length < 8) return null;

  let packBegin = -1;
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0xab && buf[i + 1] === 0xcd) {
      packBegin = i;
      break;
    }
  }
  if (packBegin === -1) {
    if (buf.length > 0 && buf[buf.length - 1] === 0xab) buf.splice(0, buf.length - 1);
    else buf.length = 0;
    return null;
  }
  if (buf.length - packBegin < 8) return null;

  const msgLen = (buf[packBegin + 3] << 8) | buf[packBegin + 2];
  const packEnd = packBegin + 6 + msgLen;
  if (buf.length < packEnd + 2) return null;

  if (buf[packEnd] !== 0xdc || buf[packEnd + 1] !== 0xba) {
    buf.splice(0, packBegin + 2);
    return null;
  }

  const msgBuf = new Uint8Array(msgLen + 2);
  for (let i = 0; i < msgLen + 2; i++) msgBuf[i] = buf[packBegin + 4 + i];
  obfuscateK1(msgBuf, 0, msgLen + 2);

  const view = new DataView(msgBuf.buffer);
  const msgType = view.getUint16(0, true);
  const data = msgBuf.slice(4);

  buf.splice(0, packEnd + 2);
  return { msgType, data, rawData: msgBuf };
}

function obfuscateK1(buf, off, size) {
  for (let i = 0; i < size; i++) buf[off + i] ^= OBFUS_TBL[i % OBFUS_TBL.length];
}

function calcK1CRC(buf, off, size) {
  let CRC = 0;
  for (let i = 0; i < size; i++) {
    const b = buf[off + i] & 0xff;
    CRC ^= b << 8;
    for (let j = 0; j < 8; j++) {
      if (CRC & 0x8000) CRC = ((CRC << 1) ^ 0x1021) & 0xffff;
      else CRC = (CRC << 1) & 0xffff;
    }
  }
  return CRC;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function arrayToHex(arr) {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

// ========== FLASH FIRMWARE ==========
async function flashK1() {
  if (!k1FirmwareData || isK1Flashing) return;
  
  try {
    if (!k1Port) await connectK1();
    await flashK1Firmware();
  } catch (e) {
    logK1(`Flash error: ${e?.message ?? String(e)}`, 'error');
    isK1Flashing = false;
    updateK1FlashButton();
  } finally {
    if (k1Port) await disconnectK1();
  }
}

async function flashK1Firmware() {
  isK1Flashing = true;
  updateK1FlashButton();
  updateK1Progress(0);

  k1ReadBuffer = [];
  logK1('Waiting for device...');
  await sleep(1000);

  try {
    // Wait for device info
    const devInfo = await waitForK1DeviceInfo();
    logK1(`UID: ${arrayToHex(devInfo.uid)}`);
    logK1(`Bootloader: ${devInfo.blVersion}`);
    logK1('Device detected!', 'success');

    // Handshake
    logK1('Performing handshake...');
    await performK1Handshake(devInfo.blVersion);
    logK1('Handshake complete!', 'success');

    // Program firmware
    await programK1Firmware();

    updateK1Progress(100);
    logK1('Flash completed successfully!', 'success');

  } finally {
    isK1Flashing = false;
    updateK1FlashButton();
  }
}

async function waitForK1DeviceInfo() {
  let lastTimestamp = 0, acc = 0, timeout = 0;
  logK1('Waiting for device info...');

  while (timeout < 500) {
    await sleep(10);
    timeout++;

    const msg = fetchK1Message(k1ReadBuffer);
    if (!msg) continue;

    if (msg.msgType === MSG_NOTIFY_DEV_INFO) {
      const now = Date.now();
      const dt = now - lastTimestamp;
      lastTimestamp = now;

      if (lastTimestamp > 0 && dt >= 5 && dt <= 1000) {
        acc++;
        if (acc >= 5) {
          const uid = msg.data.slice(0, 16);
          let blVersionEnd = -1;
          for (let i = 16; i < 32; i++) {
            if (msg.data[i] === 0) {
              blVersionEnd = i;
              break;
            }
          }
          if (blVersionEnd === -1) blVersionEnd = 32;
          const blVersion = new TextDecoder().decode(msg.data.slice(16, blVersionEnd));
          return { uid, blVersion };
        }
      } else {
        acc = 0;
      }
    }
  }
  throw new Error('Timeout: Device not detected. Is it in DFU mode?');
}

async function performK1Handshake(blVersion) {
  let acc = 0;

  while (acc < 3) {
    await sleep(50);
    const msg = fetchK1Message(k1ReadBuffer);
    if (msg && msg.msgType === MSG_NOTIFY_DEV_INFO) {
      const blMsg = createK1Message(MSG_NOTIFY_BL_VER, 4);
      const blBytes = new TextEncoder().encode(blVersion.substring(0, 4));
      for (let i = 0; i < Math.min(blBytes.length, 4); i++) blMsg[4 + i] = blBytes[i];
      await sendK1Message(blMsg);
      acc++;
      await sleep(50);
    }
  }

  logK1('Waiting for device to stop broadcasting...');
  await sleep(200);

  while (k1ReadBuffer.length > 0) {
    const msg = fetchK1Message(k1ReadBuffer);
    if (!msg) break;
  }
}

async function programK1Firmware() {
  const pageCount = Math.ceil(k1FirmwareData.length / 256);
  const timestamp = Date.now() & 0xffffffff;
  logK1(`Programming ${pageCount} pages...`);

  let pageIndex = 0, retryCount = 0;
  const MAX_RETRIES = 3;

  while (pageIndex < pageCount) {
    updateK1Progress((pageIndex / pageCount) * 100);

    const msg = createK1Message(MSG_PROG_FW, 268);
    const view = new DataView(msg.buffer);
    view.setUint32(4, timestamp, true);
    view.setUint16(8, pageIndex, true);
    view.setUint16(10, pageCount, true);

    const offset = pageIndex * 256;
    const len = Math.min(256, k1FirmwareData.length - offset);
    for (let i = 0; i < len; i++) msg[16 + i] = k1FirmwareData[offset + i];

    await sendK1Message(msg);

    let gotResponse = false;
    for (let i = 0; i < 300 && !gotResponse; i++) {
      await sleep(10);
      const resp = fetchK1Message(k1ReadBuffer);
      if (!resp) continue;
      if (resp.msgType === MSG_NOTIFY_DEV_INFO) continue;

      if (resp.msgType === MSG_PROG_FW_RESP) {
        const dv = new DataView(resp.data.buffer);
        const respPageIndex = dv.getUint16(4, true);
        const err = dv.getUint16(6, true);

        if (respPageIndex !== pageIndex) continue;
        if (err !== 0) {
          logK1(`Page ${pageIndex + 1}/${pageCount} error: ${err}`, 'error');
          retryCount++;
          if (retryCount > MAX_RETRIES) throw new Error(`Too many errors on page ${pageIndex}`);
          break;
        }

        gotResponse = true;
        retryCount = 0;
        if ((pageIndex + 1) % 10 === 0 || pageIndex === pageCount - 1)
          logK1(`Page ${pageIndex + 1}/${pageCount} OK`, 'success');
      }
    }

    if (gotResponse) {
      pageIndex++;
    } else {
      logK1(`Page ${pageIndex + 1}/${pageCount} timeout`, 'error');
      retryCount++;
      if (retryCount > MAX_RETRIES) throw new Error(`Too many timeouts on page ${pageIndex}`);
    }
  }
}

// ========== EVENT LISTENERS ==========

// File input
if (k1FirmwareFile) {
  k1FirmwareFile.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = (ev) => setK1FirmwareBuffer(ev.target.result, file.name);
    fr.readAsArrayBuffer(file);
  });
}

// Select dropdown
if (k1FirmwareSelect) {
  k1FirmwareSelect.addEventListener('change', async (e) => {
    const value = e.target.value;
    if (value && value !== '') {
      const selectedOption = e.target.options[e.target.selectedIndex];
      const name = selectedOption ? selectedOption.textContent : value;
      await loadK1FirmwareFromUrl(value, name);
    } else {
      k1FirmwareData = null;
      k1FirmwareName = '';
      updateK1FlashButton();
    }
  });
}

// Flash button
if (k1FlashBtn) {
  k1FlashBtn.addEventListener('click', async () => {
    console.log('[K1] Flash button clicked!');
    await flashK1();
  });
  // Initially disabled
  k1FlashBtn.disabled = true;
}

// Web Serial check
if (!('serial' in navigator)) {
  logK1('Web Serial not supported in this browser!', 'error');
  if (k1FlashBtn) k1FlashBtn.disabled = true;
}

console.log('[K1 UI] Initialized successfully!');
logK1('K1 Flash ready. Select firmware to begin.');

// Export for external use
export { flashK1, updateK1FlashButton };
