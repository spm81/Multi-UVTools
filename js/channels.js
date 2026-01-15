import {
  EEPROM_BLOCK_SIZE,
  eepromInit,
  eepromRead,
  eepromWrite,
  eepromReboot,
} from "./protocol.js";
import {
  tk11Init,
  tk11Read,
  tk11Write,
  tk11Reboot,
  TK11_MAX_CHUNK_SIZE,
} from "./protocol-tk11.js";
import { claim, release, getPort, subscribe } from "./serial-manager.js";
import { getRadioType, onRadioTypeChange } from "./radio-selector.js";

// Aliases for cleaner code
const getSelectedRadio = getRadioType;
const onRadioChange = onRadioTypeChange;
import { TK11_PROFILE } from "./profiles/tk11.js";

const readChannelsBtn = document.getElementById("readChannelsBtn");
const writeChannelsBtn = document.getElementById("writeChannelsBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const importCsvBtn = document.getElementById("importCsvBtn");
const channelStatus = document.getElementById("channelStatus");
const channelBody = document.getElementById("channelBody");
const pageInfo = document.getElementById("pageInfo");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageLinks = document.getElementById("pageLinks");
const viewPagesBtn = document.getElementById("viewPagesBtn");
const viewAllBtn = document.getElementById("viewAllBtn");
const paginationControls = document.getElementById("paginationControls");
const tableWrap = document.getElementById("tableWrap");
const channelFill = document.getElementById("channelFill");
const channelPct = document.getElementById("channelPct");
const channelModal = document.getElementById("channelModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalFill = document.getElementById("modalFill");
const modalPct = document.getElementById("modalPct");
const connectionDot = document.getElementById("channelsStatusDot");
const connectionLabel = document.getElementById("channelsStatusLabel");
const firmwareEl = document.getElementById("channelsFirmware");

// Radio-specific constants
const K5_CHANNEL_COUNT = 200;
const TK11_CHANNEL_COUNT = 999;
const IJV_CHANNEL_COUNT = 999;

// K5 Channel Profiles
const K5_CHANNEL_PROFILES = {
  default200: {
    name: 'Default 200 Channels',
    channelCount: 200,
    channelSize: 16,  // Bytes per channel in freq area
    nameSize: 16,     // Bytes per name
    attrSize: 1,      // Bytes per attribute
    addresses: {
      freq: 0x0000,   // Channel frequency data (200 * 16 = 0x0C80)
      attr: 0x0D60,   // Channel attributes (200 bytes)
      name: 0x0F50    // Channel names (200 * 16 = 0x0C80)
    },
    layout: 'split'   // Data split across multiple memory regions
  },
  ijv_vx3: {
    name: 'IJV_vX3xx (999 Channels)',
    channelCount: 999,
    channelSize: 32,  // 32 bytes per channel (unified structure)
    addresses: {
      start: 0x2000   // All channel data starts here (999 * 32 = 0x7CE0)
    },
    layout: 'unified', // All data in one block per channel
    structure: {
      nameOffset: 0,
      nameLength: 10,
      codeSelOffset: 10,   // 5 bytes (10 nibbles)
      groupBandOffset: 15,
      freqOffset: 16,      // 4 bytes (ul32)
      offsetOffset: 20,    // 4 bytes (ul32)
      rxcodeOffset: 24,
      txcodeOffset: 25,
      codetypeOffset: 26,  // tx_codetype:4, rx_codetype:4
      flags1Offset: 27,    // txlock:1, writeprot:1, enablescan:1, modulation:3, shift:2
      flags2Offset: 28,    // busylock:1, txpower:2, bw:4, reverse:1
      flags3Offset: 29,    // libero:3, compander:2, agcmode:3
      squelchStepOffset: 30, // squelch:4, step:4
      scramblerPttOffset: 31 // scrambler:1, ptt_id:4, digcode:3
    }
  }
};

let currentK5Profile = 'default200';

// Get current K5 profile
const getK5Profile = () => K5_CHANNEL_PROFILES[currentK5Profile];

// Dynamic channel count based on selected radio and profile
const getChannelCount = () => {
  const radio = getSelectedRadio();
  if (radio === 'TK11') return TK11_CHANNEL_COUNT;
  return getK5Profile().channelCount;
};

const CHANNEL_COUNT = K5_CHANNEL_COUNT;  // Default, will be overridden dynamically
const PAGE_SIZE = 20;
const MAX_READ_BLOCK = 0x80;

const MODE_LIST = ["FM", "NFM", "AM", "NAM", "USB"];
const POWER_LIST = [
  "USER",
  "LOW 1 (<20mW)",
  "LOW 2 (125mW)",
  "LOW 3 (250mW)",
  "LOW 4 (500mW)",
  "1.0W",
  "2.0W",
  "5.0W",
];
const PTTID_LIST = ["OFF", "UP CODE", "DOWN CODE", "UP+DOWN CODE", "APOLLO QUINDAR"];
const SCRAMBLER_LIST = [
  "OFF",
  "2600Hz",
  "2700Hz",
  "2800Hz",
  "2900Hz",
  "3000Hz",
  "3100Hz",
  "3200Hz",
  "3300Hz",
  "3400Hz",
  "3500Hz",
];
const SCANLIST_LIST = [
  "None",
  "List [1]",
  "List [2]",
  "List [1, 2]",
  "List [3]",
  "List [1, 3]",
  "List [2, 3]",
  "All List [1, 2, 3]",
];
const STEPS = [
  2.5, 5, 6.25, 10, 12.5, 25, 8.33, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 1.25,
  9, 15, 20, 30, 50, 100, 125, 200, 250, 500,
];

// ==================== TK11 SPECIFIC LISTS ====================
const TK11_MODE_LIST = ['FM', 'AM', 'LSB', 'USB', 'CW', 'NFM'];
const TK11_POWER_LIST = ['Low (1W)', 'Mid (5W)', 'High (10W)'];
const TK11_BW_LIST = ['Wide', 'Narrow'];
const TK11_TONE_TYPES = ['None', 'CTCSS', 'DCS-N', 'DCS-I'];
const TK11_PTTID_LIST = ['OFF', 'Start', 'End', 'Start & End'];
const TK11_ENCRYPT_LIST = ['Off', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const TK11_SQUELCH_LIST = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];
const TK11_SCANLIST_LIST = ['None', ...Array.from({length: 32}, (_, i) => String(i + 1)), 'All'];
const TK11_STEPS = [2.5, 5, 6.25, 10, 12.5, 20, 25, 50, 100];
const CTCSS_TONES = [
  67.0, 69.3, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4,
  100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8, 136.5,
  141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5, 167.9, 171.3, 173.8,
  177.3, 179.9, 183.5, 186.2, 189.9, 192.8, 196.6, 199.5, 203.5, 206.5,
  210.7, 218.1, 225.7, 229.1, 233.6, 241.8, 250.3, 254.1,
];
const DTCS_CODES = [
  23, 25, 26, 31, 32, 36, 43, 47, 51, 53, 54, 65, 71, 72, 73, 74, 114, 115,
  116, 122, 125, 131, 132, 134, 143, 145, 152, 155, 156, 162, 165, 172, 174,
  205, 212, 223, 225, 226, 243, 244, 245, 246, 251, 252, 255, 261, 263, 265,
  266, 271, 274, 306, 311, 315, 325, 331, 332, 343, 346, 351, 356, 364, 365,
  371, 411, 412, 413, 423, 431, 432, 445, 446, 452, 454, 455, 462, 464, 465,
  466, 503, 506, 516, 523, 526, 532, 546, 565, 606, 612, 624, 627, 631, 632,
  654, 662, 664, 703, 712, 723, 731, 732, 734, 743, 754,
];

// ==================== IJV SPECIFIC LISTS ====================
const IJV_MODE_LIST = ['FM', 'AM', 'USB', 'CW', 'WFM'];
const IJV_POWER_LIST = ['Low', 'Mid', 'High'];
const IJV_BW_LIST = [
  'W 26k', 'W 23k', 'W 20k', 'W 17k', 'W 14k',
  'W.12k', 'N 10k', 'N. 9k', 'U  7k', 'U  6k'
];
const IJV_SHIFT_LIST = ['', '+', '-', 'off'];  // 0=None, 1=Plus, 2=Minus, 3=off
const IJV_COMPANDER_LIST = ['OFF', 'TX', 'RX', 'RX/TX'];
const IJV_AGC_MODE_LIST = ['AUTO', 'MAN', 'FAST', 'NORM', 'SLOW'];
const IJV_SQUELCH_LIST = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'NO RX'];
const IJV_PTTID_LIST = [
  'OFF', 'CALL ID', 'SEL CALL', 'CODE BEGIN', 'CODE END',
  'CODE BEG+END', 'ROGER Single', 'ROGER 2Tones', 'MDC 1200', 'Apollo Quindar'
];
const IJV_SCRAMBLER_LIST = ['OFF', 'ON'];  // Per-channel only enables/disables global scrambler
const IJV_DIGCODE_LIST = ['OFF', 'DTMF', 'ZVEI1', 'ZVEI2', 'CCIR-1', 'CCIR-1F', 'USER'];
const IJV_STEPS = [
  0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 6.25, 8.33, 9, 10, 12.5, 20, 25, 50, 100
];
const IJV_STEP_LIST = [
  '10 Hz', '50 Hz', '100 Hz', '500 Hz', '1 kHz', '2.5 kHz',
  '5 kHz', '6.25 kHz', '8.33 kHz', '9 kHz', '10 kHz', '12.5 kHz',
  '20 kHz', '25 kHz', '50 kHz', '100 kHz'
];
const IJV_BAND_LIST = ['1', '2', '3', '4', '5', '6', '7'];
const IJV_GROUP_LIST = Array.from({length: 16}, (_, i) => `${i}`);

let currentPage = 0;
let channels = Array.from({ length: K5_CHANNEL_COUNT }, (_, index) => buildEmptyChannel(index + 1));
let canEdit = false;
let isConnected = false;
let isBusy = false;
let viewMode = "pages"; // "pages" or "all"
let currentRadio = 'K5';  // Track current radio type

// Reinitialize channels array when radio changes
const reinitChannels = () => {
  const newRadio = getSelectedRadio();
  if (newRadio !== currentRadio) {
    currentRadio = newRadio;
    const count = getChannelCount();
    channels = Array.from({ length: count }, (_, index) => buildEmptyChannel(index + 1));
    currentPage = 0;
    canEdit = false;
    renderTable();
    updatePaginationControls();
    setStatus(`Radio changed to ${newRadio}. Read channels to begin.`);
  }
};

// Listen for radio changes
onRadioChange(reinitChannels);

function buildEmptyChannel(number) {
  const isTK11 = getSelectedRadio() === 'TK11';
  const isIJV = currentK5Profile === 'ijv_vx3';
  
  if (isTK11) {
    return {
      number,
      name: "",
      rxFreqHz: 0,
      txFreqHz: 0,
      offsetDir: 0,
      offsetHz: 0,
      duplex: "",
      rxToneType: "None",
      rxTone: "",
      txToneType: "None",
      txTone: "",
      power: "Low (1W)",
      mode: "FM",
      bw: "Wide",
      step: 12.5,
      reverse: false,
      busy: false,
      squelch: 4,
      encrypt: "Off",
      pttid: "OFF",
      dtmfDecode: false,
      scanlist: 0,
      signal: "DTMF",
      msw: 0,
      band: 5,
    };
  } else if (isIJV) {
    // IJV firmware - 999 channels with extended features
    return {
      number,
      name: "",
      rxFreqHz: 0,
      txFreqHz: 0,
      offsetDir: 0,
      offsetHz: 0,
      duplex: "",
      rxToneType: "None",
      rxTone: "",
      txToneType: "None",
      txTone: "",
      power: "High",
      mode: "FM",
      bw: "W 26k",
      step: 11,  // Index for 12.5 kHz
      reverse: false,
      busy: false,
      txLock: false,
      pttid: "OFF",
      scrambler: "OFF",
      digCode: "OFF",
      squelch: 4,
      compander: "OFF",
      agcMode: "AUTO",
      band: 1,
      group: 0,
      codeSel: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      writeProt: false,
      enableScan: true,
    };
  } else {
    // K5 Default - 200 channels
    return {
      number,
      name: "",
      rxFreqHz: 0,
      txFreqHz: 0,
      offsetDir: 0,
      offsetHz: 0,
      duplex: "",
      rxToneType: "None",
      rxTone: "",
      txToneType: "None",
      txTone: "",
      power: "USER",
      mode: "FM",
      step: STEPS[0],
      reverse: false,
      scrambler: "OFF",
      busy: false,
      txLock: false,
      pttid: "OFF",
      dtmfDecode: false,
      scanlist: 0,
      compander: 0,
      band: 7,
    };
  }
}

const setStatus = (message, tone = "info") => {
  channelStatus.textContent = message;
  channelStatus.classList.toggle("status-error", tone === "error");
};

const setProgress = (value, visible = true) => {
  const pct = Math.max(0, Math.min(100, value));
  const container = channelFill.closest(".progress");
  if (container) {
    container.classList.toggle("active", visible);
  }
  channelFill.style.width = `${pct}%`;
  channelPct.textContent = `${pct.toFixed(1)}%`;
  modalFill.style.width = `${pct}%`;
  modalPct.textContent = `${pct.toFixed(1)}%`;
};

const updateActionState = () => {
  readChannelsBtn.disabled = isBusy || !isConnected;
  writeChannelsBtn.disabled = isBusy || !isConnected || !canEdit;
  exportCsvBtn.disabled = isBusy || !canEdit;
  importCsvBtn.disabled = isBusy || !canEdit;
};

const disableActions = (disabled) => {
  isBusy = disabled;
  updateActionState();
};

const setEditEnabled = (enabled) => {
  canEdit = enabled;
  updateActionState();
  renderTable();
};

const updatePaginationControls = () => {
  const totalPages = Math.ceil(channels.length / PAGE_SIZE);
  if (currentPage >= totalPages) {
    currentPage = Math.max(0, totalPages - 1);
  }
  renderPageLinks();
};

const showModal = (title, message) => {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  channelModal.classList.add("active");
  channelModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

const hideModal = () => {
  channelModal.classList.remove("active");
  channelModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
};

const formatFreq = (freqHz) => {
  if (!freqHz) return "";
  return (freqHz / 1_000_000).toFixed(6);
};

const formatOffset = (offsetHz) => {
  if (!offsetHz) return "";
  return (offsetHz / 1_000_000).toFixed(6);
};

const parseFreq = (value) => {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num) || num <= 0) return 0;
  return Math.round(num * 1_000_000);
};

const updateDuplexFromOffset = (channel) => {
  if (!channel.offsetHz || channel.offsetHz === 0) {
    channel.duplex = "";
    channel.offsetDir = 0;
    channel.txFreqHz = channel.rxFreqHz;
    return;
  }
  if (channel.duplex === "+") {
    channel.offsetDir = 1;
    channel.txFreqHz = channel.rxFreqHz + channel.offsetHz;
  } else if (channel.duplex === "-") {
    channel.offsetDir = 2;
    channel.txFreqHz = channel.rxFreqHz - channel.offsetHz;
  } else {
    channel.duplex = "";
    channel.offsetDir = 0;
    channel.txFreqHz = channel.rxFreqHz;
    channel.offsetHz = 0;
  }
};

const updateOffsetFromMemory = (channel) => {
  if (!channel.rxFreqHz) {
    channel.txFreqHz = 0;
    channel.offsetHz = 0;
    channel.offsetDir = 0;
    channel.duplex = "";
    return;
  }
  if (channel.offsetDir === 1) {
    channel.duplex = "+";
    channel.txFreqHz = channel.rxFreqHz + channel.offsetHz;
  } else if (channel.offsetDir === 2) {
    channel.duplex = "-";
    channel.txFreqHz = channel.rxFreqHz - channel.offsetHz;
  } else {
    channel.duplex = "";
    channel.offsetHz = 0;
    channel.txFreqHz = channel.rxFreqHz;
  }
};

const getToneIndex = (type, value) => {
  if (type === "CTCSS") return CTCSS_TONES.indexOf(Number.parseFloat(value));
  if (type === "DCS" || type === "DCS-R") return DTCS_CODES.indexOf(Number.parseInt(value, 10));
  return 0;
};

const getToneFlag = (type) => {
  if (type === "CTCSS") return 1;
  if (type === "DCS") return 2;
  if (type === "DCS-R") return 3;
  return 0;
};

const getToneValue = (type, code) => {
  if (type === "CTCSS") return CTCSS_TONES[code] ?? "";
  if (type === "DCS" || type === "DCS-R") return DTCS_CODES[code] ?? "";
  return "";
};

const readRange = async (start, length) => {
  const buffer = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += MAX_READ_BLOCK) {
    const size = Math.min(MAX_READ_BLOCK, length - offset);
    const data = await eepromRead(getPort(), start + offset, size);
    buffer.set(data.slice(0, size), offset);
  }
  return buffer;
};

const writeRange = async (start, data) => {
  for (let offset = 0; offset < data.length; offset += EEPROM_BLOCK_SIZE) {
    const chunk = data.slice(offset, offset + EEPROM_BLOCK_SIZE);
    await eepromWrite(getPort(), start + offset, chunk, chunk.length);
  }
};

// Decode IJV firmware channels (999 channels, 32 bytes each)
const decodeIJVChannels = (channelBytes, channelCount) => {
  const view = new DataView(channelBytes.buffer, channelBytes.byteOffset, channelBytes.byteLength);
  const decoded = [];
  
  for (let i = 0; i < channelCount; i++) {
    const base = i * 32;
    const channel = buildEmptyChannel(i + 1);
    
    // Bytes 0-9: Name (10 chars)
    let name = '';
    for (let j = 0; j < 10; j++) {
      const byte = channelBytes[base + j];
      if (byte === 0x00 || byte === 0xff) break;
      name += String.fromCharCode(byte);
    }
    channel.name = name.trim();
    
    // Byte 15: group:4, band:4
    const groupBand = channelBytes[base + 15];
    channel.group = groupBand & 0x0f;
    channel.band = (groupBand >> 4) & 0x0f;
    
    // Bytes 16-19: Frequency (ul32)
    const freqRaw = view.getUint32(base + 16, true);
    // Bytes 20-23: Offset (ul32)
    const offsetRaw = view.getUint32(base + 20, true);
    
    // Skip empty channels (show empty but keep defaults)
    if (freqRaw === 0xffffffff || freqRaw === 0) {
      decoded.push(channel);
      continue;
    }
    
    channel.rxFreqHz = freqRaw * 10;
    channel.offsetHz = offsetRaw * 10;
    
    // Byte 24-25: RX/TX codes
    const rxcode = channelBytes[base + 24];
    const txcode = channelBytes[base + 25];
    
    // Byte 26: tx_codetype:4, rx_codetype:4
    const codeTypes = channelBytes[base + 26];
    const rxcodeflag = codeTypes & 0x0f;
    const txcodeflag = (codeTypes >> 4) & 0x0f;
    channel.rxToneType = ['None', 'CTCSS', 'DCS', 'DCS-R'][rxcodeflag] ?? 'None';
    channel.txToneType = ['None', 'CTCSS', 'DCS', 'DCS-R'][txcodeflag] ?? 'None';
    channel.rxTone = getToneValue(channel.rxToneType, rxcode);
    channel.txTone = getToneValue(channel.txToneType, txcode);
    
    // Byte 27: txlock:1, writeprot:1, enablescan:1, modulation:3, shift:2
    const byte27 = channelBytes[base + 27];
    const shiftVal = byte27 & 0x03; // 0=none, 1=+, 2=-, 3=off
    channel.duplex = IJV_SHIFT_LIST[shiftVal] ?? '';
    const modulation = (byte27 >> 2) & 0x07;
    channel.enableScan = (byte27 >> 5) & 0x01;
    channel.writeProt = (byte27 >> 6) & 0x01;
    channel.txLock = (byte27 >> 7) & 0x01 ? true : false;
    
    // Byte 28: busylock:1, txpower:2, bw:4, reverse:1
    const byte28 = channelBytes[base + 28];
    channel.reverse = (byte28 & 0x01) ? true : false;
    const bwIndex = (byte28 >> 1) & 0x0f; // 0-9 for IJV bandwidths
    channel.bw = IJV_BW_LIST[bwIndex] ?? 'W 26k';
    const powerIndex = (byte28 >> 5) & 0x03;
    channel.power = IJV_POWER_LIST[powerIndex] ?? 'High';
    channel.busy = ((byte28 >> 7) & 0x01) ? true : false;
    
    // Byte 29: libero:3, compander:2, agcmode:3
    const byte29 = channelBytes[base + 29];
    const agcIndex = byte29 & 0x07;
    channel.agcMode = IJV_AGC_MODE_LIST[agcIndex] ?? 'AUTO';
    const compIndex = (byte29 >> 3) & 0x03;
    channel.compander = IJV_COMPANDER_LIST[compIndex] ?? 'OFF';
    
    // Byte 30: squelch:4, step:4
    const byte30 = channelBytes[base + 30];
    channel.step = byte30 & 0x0f;
    channel.squelch = (byte30 >> 4) & 0x0f;
    
    // Byte 31: scrambler:1, ptt_id:4, digcode:3
    const byte31 = channelBytes[base + 31];
    const digcodeIndex = byte31 & 0x07;
    channel.digCode = IJV_DIGCODE_LIST[digcodeIndex] ?? 'OFF';
    const pttIndex = (byte31 >> 3) & 0x0f;
    channel.pttid = IJV_PTTID_LIST[pttIndex] ?? 'OFF';
    channel.scrambler = ((byte31 >> 7) & 0x01) ? 'ON' : 'OFF';
    
    // Map modulation to mode string
    channel.mode = IJV_MODE_LIST[modulation] ?? 'FM';
    
    decoded.push(channel);
  }
  
  return decoded;
};

// Encode IJV firmware channels (999 channels, 32 bytes each)
const encodeIJVChannels = () => {
  const profile = getK5Profile();
  const channelCount = profile.channelCount;
  const channelBytes = new Uint8Array(channelCount * 32);
  const view = new DataView(channelBytes.buffer);
  
  // Fill with 0xFF (empty channel marker)
  channelBytes.fill(0xff);
  
  channels.forEach((channel, index) => {
    if (index >= channelCount) return;
    
    const base = index * 32;
    
    // Clear channel bytes first (0x00)
    for (let j = 0; j < 32; j++) {
      channelBytes[base + j] = 0x00;
    }
    
    // Bytes 0-9: Name (10 chars)
    const name = (channel.name || '').slice(0, 10);
    for (let j = 0; j < name.length; j++) {
      channelBytes[base + j] = name.charCodeAt(j);
    }
    
    // Byte 15: group:4, band:4
    const group = channel.group ?? 0;
    const band = channel.band ?? 0;
    channelBytes[base + 15] = (group & 0x0f) | ((band & 0x0f) << 4);
    
    // If no frequency, leave channel empty
    if (!channel.rxFreqHz) {
      view.setUint32(base + 16, 0, true);
      return;
    }
    
    // Bytes 16-19: Frequency (ul32)
    const freqRaw = Math.round(channel.rxFreqHz / 10);
    view.setUint32(base + 16, freqRaw, true);
    
    // Bytes 20-23: Offset (ul32)
    const offsetRaw = Math.round(channel.offsetHz / 10);
    view.setUint32(base + 20, offsetRaw, true);
    
    // Byte 24-25: RX/TX codes
    const rxToneFlag = getToneFlag(channel.rxToneType);
    const txToneFlag = getToneFlag(channel.txToneType);
    const rxToneIndex = getToneIndex(channel.rxToneType, channel.rxTone);
    const txToneIndex = getToneIndex(channel.txToneType, channel.txTone);
    channelBytes[base + 24] = rxToneIndex < 0 ? 0 : rxToneIndex;
    channelBytes[base + 25] = txToneIndex < 0 ? 0 : txToneIndex;
    
    // Byte 26: tx_codetype:4, rx_codetype:4
    channelBytes[base + 26] = ((txToneFlag & 0x0f) << 4) | (rxToneFlag & 0x0f);
    
    // Byte 27: txlock:1, writeprot:1, enablescan:1, modulation:3, shift:2
    const shiftIndex = Math.max(0, IJV_SHIFT_LIST.indexOf(channel.duplex ?? ''));
    const modeIndex = Math.max(0, IJV_MODE_LIST.indexOf(channel.mode ?? 'FM'));
    const enableScan = channel.enableScan ? 1 : 0;
    const writeProt = channel.writeProt ? 1 : 0;
    const txLock = channel.txLock ? 1 : 0;
    channelBytes[base + 27] = (shiftIndex & 0x03) | ((modeIndex & 0x07) << 2) | ((enableScan & 0x01) << 5) | ((writeProt & 0x01) << 6) | ((txLock & 0x01) << 7);
    
    // Byte 28: busylock:1, txpower:2, bw:4, reverse:1
    const reverse = channel.reverse ? 1 : 0;
    const bwIndex = Math.max(0, IJV_BW_LIST.indexOf(channel.bw ?? 'W 26k'));
    const powerIndex = Math.max(0, IJV_POWER_LIST.indexOf(channel.power ?? 'High'));
    const busy = channel.busy ? 1 : 0;
    channelBytes[base + 28] = (reverse & 0x01) | ((bwIndex & 0x0f) << 1) | ((powerIndex & 0x03) << 5) | ((busy & 0x01) << 7);
    
    // Byte 29: libero:3, compander:2, agcmode:3
    const agcIndex = Math.max(0, IJV_AGC_MODE_LIST.indexOf(channel.agcMode ?? 'AUTO'));
    const compIndex = Math.max(0, IJV_COMPANDER_LIST.indexOf(channel.compander ?? 'OFF'));
    channelBytes[base + 29] = (agcIndex & 0x07) | ((compIndex & 0x03) << 3);
    
    // Byte 30: squelch:4, step:4
    const squelch = channel.squelch ?? 0;
    const step = channel.step ?? 0;
    channelBytes[base + 30] = (step & 0x0f) | ((squelch & 0x0f) << 4);
    
    // Byte 31: scrambler:1, ptt_id:4, digcode:3
    const digcodeIndex = Math.max(0, IJV_DIGCODE_LIST.indexOf(channel.digCode ?? 'OFF'));
    const pttIndex = Math.max(0, IJV_PTTID_LIST.indexOf(channel.pttid ?? 'OFF'));
    const scrambler = channel.scrambler === 'ON' ? 1 : 0;
    channelBytes[base + 31] = (digcodeIndex & 0x07) | ((pttIndex & 0x0f) << 3) | ((scrambler & 0x01) << 7);
  });
  
  return channelBytes;
};

const decodeChannels = (channelBytes, nameBytes, attrBytes) => {
  const view = new DataView(channelBytes.buffer, channelBytes.byteOffset, channelBytes.byteLength);
  const decoded = [];
  for (let i = 0; i < K5_CHANNEL_COUNT; i += 1) {
    const base = i * 16;
    const channel = buildEmptyChannel(i + 1);
    const freqRaw = view.getUint32(base, true);
    const offsetRaw = view.getUint32(base + 4, true);
    const rxcode = channelBytes[base + 8];
    const txcode = channelBytes[base + 9];
    const flagsTone = channelBytes[base + 10];
    const flagsMode = channelBytes[base + 11];
    const flagsExtra = channelBytes[base + 12];
    const flagsDtmf = channelBytes[base + 13];
    const step = channelBytes[base + 14];
    const scrambler = channelBytes[base + 15];
    const attr = attrBytes[i] ?? 0;

    channel.scanlist = (attr >> 5) & 0x7;
    channel.compander = (attr >> 3) & 0x3;
    channel.band = attr & 0x7;

    const nameSlice = nameBytes.slice(i * 16, i * 16 + 16);
    let name = "";
    for (const byte of nameSlice) {
      if (byte === 0x00 || byte === 0xff) break;
      name += String.fromCharCode(byte);
    }
    channel.name = name.trim();

    if (freqRaw === 0xffffffff || freqRaw === 0) {
      decoded.push(channel);
      continue;
    }

    channel.rxFreqHz = freqRaw * 10;
    channel.offsetHz = offsetRaw * 10;
    channel.offsetDir = flagsMode & 0x0f;
    updateOffsetFromMemory(channel);

    const txcodeflag = (flagsTone >> 4) & 0x0f;
    const rxcodeflag = flagsTone & 0x0f;
    channel.rxToneType = ["None", "CTCSS", "DCS", "DCS-R"][rxcodeflag] ?? "None";
    channel.txToneType = ["None", "CTCSS", "DCS", "DCS-R"][txcodeflag] ?? "None";
    channel.rxTone = getToneValue(channel.rxToneType, rxcode);
    channel.txTone = getToneValue(channel.txToneType, txcode);

    const modulation = (flagsMode >> 4) & 0x0f;
    const bandwidth = (flagsExtra >> 1) & 0x01;
    const tempMode = modulation * 2 + bandwidth;
    channel.mode = MODE_LIST[tempMode] ?? (tempMode === 5 ? "USB" : "FM");

    const txpower = (flagsExtra >> 2) & 0x07;
    channel.power = POWER_LIST[txpower] ?? "USER";
    channel.reverse = Boolean(flagsExtra & 0x01);
    channel.busy = Boolean(flagsExtra & 0x20);
    channel.txLock = Boolean(flagsExtra & 0x40);

    channel.pttid = PTTID_LIST[(flagsDtmf >> 1) & 0x07] ?? "OFF";
    channel.dtmfDecode = Boolean(flagsDtmf & 0x01);

    channel.step = STEPS[step] ?? STEPS[0];
    channel.scrambler = SCRAMBLER_LIST[scrambler] ?? "OFF";

    decoded.push(channel);
  }
  return decoded;
};

// ========== TK11 Channel Decode/Encode ==========
const decodeTK11Channels = (channelBytes, usageFlags) => {
  const decoded = [];
  const P = TK11_PROFILE;
  
  // Validate profile
  if (!P || !P.CHANNEL || !P.CHANNEL.RX_FREQ) {
    console.error('TK11_PROFILE not properly loaded');
    throw new Error('TK11 profile error - reload the page');
  }
  
  const channelCount = P.CHANNELS_COUNT || 999;
  const channelSize = P.CHANNEL_SIZE || 64;  // FIXED: 64 bytes per channel!
  const freqDivisor = P.FREQ_DIVISOR || 10;  // TK11 stores freq as Hz/10
  
  console.log(`Decoding ${channelCount} TK11 channels (${channelSize} bytes each), total ${channelBytes.length} bytes`);
  
  let activeChannels = 0;
  
  for (let i = 0; i < channelCount; i++) {
    const offset = i * channelSize;
    const channel = buildEmptyChannel(i + 1);
    
    // Check channel usage flag (0xFF = empty, other = band index = active)
    const usageFlag = usageFlags ? usageFlags[i] : 0;
    const isChannelActive = usageFlag !== 0xFF;
    
    // Bounds check
    if (offset + channelSize > channelBytes.length) {
      decoded.push(channel);
      continue;
    }
    
    // Read RX frequency (stored in Hz/10, multiply by 10 to get Hz)
    const rxFreqRaw = P.readUint32LE(channelBytes, offset + P.CHANNEL.RX_FREQ.offset);
    const rxFreqHz = rxFreqRaw * freqDivisor;
    
    // Check if channel is empty using BOTH usage flag AND frequency
    // The CPS may not clear channel data, only sets flag to 0xFF
    if (!isChannelActive || rxFreqRaw === 0 || rxFreqRaw === 0xFFFFFFFF) {
      decoded.push(channel);
      continue;
    }
    
    // Validate frequency range (0.15 MHz - 1160 MHz as per TK11 spec)
    if (rxFreqHz < 150000 || rxFreqHz > 1160000000) {
      console.warn(`Channel ${i+1}: Invalid frequency ${rxFreqHz} Hz, flag=${usageFlag}`);
      decoded.push(channel);
      continue;
    }
    
    activeChannels++;
    channel.rxFreqHz = rxFreqHz;
    
    // TX offset and direction (also stored in Hz/10)
    const freqDiffRaw = P.readUint32LE(channelBytes, offset + P.CHANNEL.FREQ_DIFF.offset);
    const freqDiff = freqDiffRaw * freqDivisor;
    const freqDir = channelBytes[offset + P.CHANNEL.FREQ_DIR.offset];
    
    channel.offsetHz = freqDiff;
    channel.offsetDir = freqDir;
    
    if (freqDir === 1) {
      channel.txFreqHz = rxFreqHz + freqDiff;
      channel.duplex = '+';
    } else if (freqDir === 2) {
      channel.txFreqHz = rxFreqHz - freqDiff;
      channel.duplex = '-';
    } else {
      channel.txFreqHz = rxFreqHz;
      channel.duplex = '';
    }
    
    // Name (16 bytes at offset 24)
    const nameStart = offset + P.CHANNEL.NAME.offset;
    const nameEnd = nameStart + P.CHANNEL.NAME.size;
    const nameSlice = channelBytes.slice(nameStart, nameEnd);
    let name = '';
    for (let j = 0; j < nameSlice.length; j++) {
      const byte = nameSlice[j];
      if (byte === 0 || byte === 0xFF) break;
      if (byte >= 0x20 && byte <= 0x7E) {  // Printable ASCII only
        name += String.fromCharCode(byte);
      }
    }
    channel.name = name.trim();
    
    // Power (0=Low, 1=Mid, 2=High)
    const powerVal = channelBytes[offset + P.CHANNEL.POWER.offset];
    channel.power = P.OPTIONS.POWER[powerVal] || 'Low (1W)';
    
    // Mode - TK11 uses: 0=FM, 1=AM, 2=LSB, 3=USB, 4=CW, 5=NFM
    const modeVal = channelBytes[offset + P.CHANNEL.MODE.offset];
    // Bandwidth from band byte lower nibble: 0=Wide (25kHz), 1=Narrow (12.5kHz)
    const bandByte = channelBytes[offset + P.CHANNEL.BAND.offset];
    const bandwidthFlag = bandByte & 0x0F;
    
    // Mode is stored separately from bandwidth
    channel.mode = P.OPTIONS.MODES[modeVal] || 'FM';
    // BW: 0=Wide, 1=Narrow
    channel.bw = bandwidthFlag === 1 ? 'Narrow' : 'Wide';
    
    // MSW (upper nibble of band byte)
    channel.msw = (bandByte >> 4) & 0x0F;
    
    // Step
    const stepVal = channelBytes[offset + P.CHANNEL.STEP.offset];
    channel.step = P.OPTIONS.STEPS[stepVal] || 12.5;
    
    // RX/TX Tones (at offsets 40 and 44)
    const rxQt = P.readUint32LE(channelBytes, offset + P.CHANNEL.RX_QT.offset);
    const txQt = P.readUint32LE(channelBytes, offset + P.CHANNEL.TX_QT.offset);
    const rxQtType = channelBytes[offset + P.CHANNEL.RX_QT_TYPE.offset];
    const txQtType = channelBytes[offset + P.CHANNEL.TX_QT_TYPE.offset];
    
    const rxTone = decodeTK11Tone(rxQt, rxQtType);
    const txTone = decodeTK11Tone(txQt, txQtType);
    
    channel.rxToneType = rxTone.type;
    channel.rxTone = rxTone.value;
    channel.txToneType = txTone.type;
    channel.txTone = txTone.value;
    
    // Other flags
    channel.squelch = channelBytes[offset + P.CHANNEL.SQ.offset];
    channel.busy = Boolean(channelBytes[offset + P.CHANNEL.BUSY.offset]);
    channel.reverse = Boolean(channelBytes[offset + P.CHANNEL.REVERSE.offset]);
    channel.dtmfDecode = Boolean(channelBytes[offset + P.CHANNEL.DTMF_DECODE.offset]);
    
    const scanListVal = channelBytes[offset + P.CHANNEL.SCAN_LIST.offset];
    channel.scanlist = (scanListVal === 0xFF) ? '' : scanListVal + 1;
    
    const pttIdVal = channelBytes[offset + P.CHANNEL.PTT_ID.offset];
    channel.pttid = P.OPTIONS.PTT_ID[pttIdVal] || 'OFF';
    
    const encryptVal = channelBytes[offset + P.CHANNEL.ENCRYPT.offset];
    channel.encrypt = P.OPTIONS.ENCRYPT[encryptVal] || 'Off';
    
    const signalVal = channelBytes[offset + P.CHANNEL.SIGNAL.offset];
    channel.signal = P.OPTIONS.SIGNAL[signalVal] || 'DTMF';
    
    // Store band/usage flag for reference
    channel.usageFlag = usageFlag;
    
    decoded.push(channel);
  }
  
  console.log(`TK11: Found ${activeChannels} active channels out of ${channelCount}`);
  
  return decoded;
};

const decodeTK11Tone = (value, type) => {
  if (type === 0 || value === 0 || value === 0xFFFFFFFF) {
    return { type: 'None', value: '' };
  }
  
  if (type === 1) { // CTCSS
    return { type: 'CTCSS', value: (value / 10).toFixed(1) };
  }
  
  if (type === 2) { // DCS
    const code = value & 0x1FF;
    const inverted = (value & 0x8000) !== 0;
    return { type: inverted ? 'DCS-R' : 'DCS', value: code.toString() };
  }
  
  return { type: 'None', value: '' };
};

const encodeTK11Channels = () => {
  const P = TK11_PROFILE;
  const freqDivisor = P.FREQ_DIVISOR || 10;  // TK11 stores freq as Hz/10
  const channelSize = P.CHANNEL_SIZE || 64;  // 64 bytes per channel!
  const channelCount = P.CHANNELS_COUNT || 999;
  
  const channelBytes = new Uint8Array(channelCount * channelSize);
  const usageFlags = new Uint8Array(channelCount);
  
  // Fill with defaults
  channelBytes.fill(0xFF);  // 0xFF = erased EEPROM state
  usageFlags.fill(0xFF);  // 0xFF = empty channel
  
  channels.forEach((channel, index) => {
    const offset = index * channelSize;
    
    if (!channel.rxFreqHz || channel.rxFreqHz === 0) {
      // Empty channel - leave usage flag as 0xFF
      return;
    }
    
    // Set usage flag to band index (active channel)
    usageFlags[index] = P.getBandFromFreq ? P.getBandFromFreq(channel.rxFreqHz) : 5;
    
    // RX frequency in Hz/10
    P.writeUint32LE(channelBytes, offset + P.CHANNEL.RX_FREQ.offset, Math.round(channel.rxFreqHz / freqDivisor));
    
    // TX offset and direction (also in Hz/10)
    P.writeUint32LE(channelBytes, offset + P.CHANNEL.FREQ_DIFF.offset, Math.round((channel.offsetHz || 0) / freqDivisor));
    channelBytes[offset + P.CHANNEL.FREQ_DIR.offset] = channel.offsetDir || 0;
    
    // Power (0=Low, 1=Mid, 2=High)
    const powerIndex = P.OPTIONS.POWER.indexOf(channel.power);
    channelBytes[offset + P.CHANNEL.POWER.offset] = powerIndex >= 0 ? powerIndex : 0;
    
    // Mode: 0=FM, 1=AM, 2=LSB, 3=USB, 4=CW, 5=NFM
    const modeIndex = P.OPTIONS.MODES.indexOf(channel.mode);
    channelBytes[offset + P.CHANNEL.MODE.offset] = modeIndex >= 0 ? modeIndex : 0;
    
    // Bandwidth: 0=Wide, 1=Narrow (stored in lower nibble of band byte)
    const bwVal = channel.bw === 'Narrow' ? 1 : 0;
    const mswVal = (channel.msw || 0) & 0x0F;
    channelBytes[offset + P.CHANNEL.BAND.offset] = (mswVal << 4) | bwVal;
    
    // Step
    const stepIndex = P.OPTIONS.STEPS.indexOf(channel.step);
    channelBytes[offset + P.CHANNEL.STEP.offset] = stepIndex >= 0 ? stepIndex : 4;
    
    // Squelch
    channelBytes[offset + P.CHANNEL.SQ.offset] = channel.squelch ?? 4;
    
    // Name (16 bytes, padded with 0x00)
    const nameStr = (channel.name || '').substring(0, P.CHANNEL.NAME.size);
    for (let j = 0; j < P.CHANNEL.NAME.size; j++) {
      channelBytes[offset + P.CHANNEL.NAME.offset + j] = j < nameStr.length ? nameStr.charCodeAt(j) : 0x00;
    }
    
    // Tones (RX and TX)
    const { value: rxQtVal, type: rxQtType } = encodeTK11Tone(channel.rxToneType, channel.rxTone);
    const { value: txQtVal, type: txQtType } = encodeTK11Tone(channel.txToneType, channel.txTone);
    
    P.writeUint32LE(channelBytes, offset + P.CHANNEL.RX_QT.offset, rxQtVal);
    P.writeUint32LE(channelBytes, offset + P.CHANNEL.TX_QT.offset, txQtVal);
    channelBytes[offset + P.CHANNEL.RX_QT_TYPE.offset] = rxQtType;
    channelBytes[offset + P.CHANNEL.TX_QT_TYPE.offset] = txQtType;
    
    // Flags
    channelBytes[offset + P.CHANNEL.BUSY.offset] = channel.busy ? 1 : 0;
    channelBytes[offset + P.CHANNEL.REVERSE.offset] = channel.reverse ? 1 : 0;
    channelBytes[offset + P.CHANNEL.DTMF_DECODE.offset] = channel.dtmfDecode ? 1 : 0;
    
    // Scan list (0xFF = none, 0-31 = list index)
    const scanVal = channel.scanlist;
    channelBytes[offset + P.CHANNEL.SCAN_LIST.offset] = (scanVal && scanVal > 0) ? (scanVal - 1) : 0xFF;
    
    // PTT ID
    const pttIdIndex = P.OPTIONS.PTT_ID.indexOf(channel.pttid);
    channelBytes[offset + P.CHANNEL.PTT_ID.offset] = pttIdIndex >= 0 ? pttIdIndex : 0;
    
    // Encryption
    const encryptIndex = P.OPTIONS.ENCRYPT.indexOf(channel.encrypt);
    channelBytes[offset + P.CHANNEL.ENCRYPT.offset] = encryptIndex >= 0 ? encryptIndex : 0;
    
    // Signal type (DTMF/5TONE)
    const signalIndex = P.OPTIONS.SIGNAL.indexOf(channel.signal);
    channelBytes[offset + P.CHANNEL.SIGNAL.offset] = signalIndex >= 0 ? signalIndex : 0;
  });
  
  console.log('TK11: Encoded channels, usage flags generated');
  return { channelBytes, usageFlags };
};

const encodeTK11Tone = (type, value) => {
  if (!type || type === 'None' || !value) {
    return { value: 0, type: 0 };
  }
  
  if (type === 'CTCSS') {
    return { value: Math.round(parseFloat(value) * 10), type: 1 };
  }
  
  if (type === 'DCS' || type === 'DCS-R') {
    let code = parseInt(value, 10) & 0x1FF;
    if (type === 'DCS-R') code |= 0x8000;
    return { value: code, type: 2 };
  }
  
  return { value: 0, type: 0 };
};

const encodeChannels = () => {
  const channelBytes = new Uint8Array(K5_CHANNEL_COUNT * 16);
  const nameBytes = new Uint8Array(K5_CHANNEL_COUNT * 16).fill(0xff);
  const attrBytes = new Uint8Array(K5_CHANNEL_COUNT).fill(0x00);
  const view = new DataView(channelBytes.buffer);

  channels.forEach((channel, index) => {
    const base = index * 16;
    if (!channel.rxFreqHz) {
      view.setUint32(base, 0, true);
      view.setUint32(base + 4, 0, true);
      return;
    }

    const freqRaw = Math.round(channel.rxFreqHz / 10);
    const offsetRaw = Math.round(channel.offsetHz / 10);
    view.setUint32(base, freqRaw, true);
    view.setUint32(base + 4, offsetRaw, true);

    const rxToneFlag = getToneFlag(channel.rxToneType);
    const txToneFlag = getToneFlag(channel.txToneType);
    const rxToneIndex = getToneIndex(channel.rxToneType, channel.rxTone);
    const txToneIndex = getToneIndex(channel.txToneType, channel.txTone);

    channelBytes[base + 8] = rxToneIndex < 0 ? 0 : rxToneIndex;
    channelBytes[base + 9] = txToneIndex < 0 ? 0 : txToneIndex;
    channelBytes[base + 10] = ((txToneFlag & 0x0f) << 4) | (rxToneFlag & 0x0f);

    const modeIndex = MODE_LIST.indexOf(channel.mode);
    const modulation = modeIndex >= 0 ? Math.floor(modeIndex / 2) : 0;
    const bandwidth = modeIndex >= 0 ? modeIndex % 2 : 0;
    channelBytes[base + 11] = ((modulation & 0x0f) << 4) | (channel.offsetDir & 0x0f);

    const powerIndex = Math.max(0, POWER_LIST.indexOf(channel.power));
    let flagsExtra = 0;
    flagsExtra |= channel.reverse ? 0x01 : 0;
    flagsExtra |= (bandwidth & 0x01) << 1;
    flagsExtra |= (powerIndex & 0x07) << 2;
    flagsExtra |= channel.busy ? 0x20 : 0;
    flagsExtra |= channel.txLock ? 0x40 : 0;
    channelBytes[base + 12] = flagsExtra;

    let flagsDtmf = 0;
    const pttidIndex = Math.max(0, PTTID_LIST.indexOf(channel.pttid));
    flagsDtmf |= (pttidIndex & 0x07) << 1;
    flagsDtmf |= channel.dtmfDecode ? 0x01 : 0;
    channelBytes[base + 13] = flagsDtmf;

    const stepIndex = Math.max(0, STEPS.indexOf(channel.step));
    channelBytes[base + 14] = stepIndex;
    channelBytes[base + 15] = Math.max(0, SCRAMBLER_LIST.indexOf(channel.scrambler));

    const name = channel.name.trim().slice(0, 10);
    if (name) {
      for (let i = 0; i < name.length; i += 1) {
        nameBytes[index * 16 + i] = name.charCodeAt(i);
      }
    }

    const attr =
      ((channel.scanlist & 0x7) << 5) | ((channel.compander & 0x3) << 3) | (channel.band & 0x7);
    attrBytes[index] = attr;
  });

  return { channelBytes, nameBytes, attrBytes };
};

const renderTable = () => {
  let start, end;
  const totalChannels = channels.length;
  const isTK11 = getSelectedRadio() === 'TK11';
  const isIJV = currentK5Profile === 'ijv_vx3';
  
  if (viewMode === "all") {
    start = 0;
    end = totalChannels;
    pageInfo.textContent = `All ${totalChannels} channels`;
    if (paginationControls) paginationControls.style.display = "none";
    if (tableWrap) {
      tableWrap.style.maxHeight = "none";
      tableWrap.style.overflow = "visible";
    }
  } else {
    start = currentPage * PAGE_SIZE;
    end = Math.min(totalChannels, start + PAGE_SIZE);
    pageInfo.textContent = `${start + 1}-${end} of ${totalChannels}`;
    prevPageBtn.disabled = currentPage === 0;
    nextPageBtn.disabled = end >= totalChannels;
    if (paginationControls) paginationControls.style.display = "";
    if (tableWrap) {
      tableWrap.style.maxHeight = "";
      tableWrap.style.overflow = "";
    }
    renderPageLinks();
  }

  const rows = [];
  for (let i = start; i < end; i += 1) {
    const channel = channels[i];
    
    if (isTK11) {
      // TK11 table row - different columns!
      rows.push(`
        <tr>
          <td>${channel.number}</td>
          <td><input type="text" data-index="${i}" data-field="name" value="${channel.name}" maxlength="16" ${canEdit ? "" : "disabled"} /></td>
          <td><input type="text" data-index="${i}" data-field="rxFreq" value="${formatFreq(channel.rxFreqHz)}" ${canEdit ? "" : "disabled"} /></td>
          <td>${buildSelect("duplex", i, ["", "+", "-"], channel.duplex, !canEdit)}</td>
          <td><input type="text" data-index="${i}" data-field="offset" value="${formatOffset(channel.offsetHz)}" ${canEdit && channel.duplex ? "" : "disabled"} /></td>
          <td>${buildSelect("mode", i, TK11_MODE_LIST, channel.mode, !canEdit)}</td>
          <td>${buildSelect("bw", i, TK11_BW_LIST, channel.bw || 'Wide', !canEdit)}</td>
          <td>${buildSelect("power", i, TK11_POWER_LIST, channel.power, !canEdit)}</td>
          <td>${buildSelect("rxToneType", i, TK11_TONE_TYPES, channel.rxToneType, !canEdit)}</td>
          <td>${buildToneSelectTK11("rxTone", i, channel.rxToneType, channel.rxTone, !canEdit)}</td>
          <td>${buildSelect("txToneType", i, TK11_TONE_TYPES, channel.txToneType, !canEdit)}</td>
          <td>${buildToneSelectTK11("txTone", i, channel.txToneType, channel.txTone, !canEdit)}</td>
          <td>${buildSelect("squelch", i, TK11_SQUELCH_LIST, String(channel.squelch ?? 4), !canEdit)}</td>
          <td>${buildSelect("encrypt", i, TK11_ENCRYPT_LIST, channel.encrypt || 'Off', !canEdit)}</td>
          <td>${buildSelect("step", i, TK11_STEPS.map(String), String(channel.step || 12.5), !canEdit)}</td>
          <td>${buildSelect("pttid", i, TK11_PTTID_LIST, channel.pttid || 'OFF', !canEdit)}</td>
          <td>${buildSelect("scanlist", i, TK11_SCANLIST_LIST, channel.scanlist ? String(channel.scanlist) : 'None', !canEdit)}</td>
        </tr>
      `);
    } else if (isIJV) {
      // IJV firmware table row - extended features
      rows.push(`
        <tr>
          <td>${channel.number}</td>
          <td><input type="text" data-index="${i}" data-field="name" value="${channel.name}" maxlength="10" ${canEdit ? "" : "disabled"} /></td>
          <td><input type="text" data-index="${i}" data-field="rxFreq" value="${formatFreq(channel.rxFreqHz)}" ${canEdit ? "" : "disabled"} /></td>
          <td>${buildSelect("duplex", i, IJV_SHIFT_LIST, channel.duplex, !canEdit)}</td>
          <td><input type="text" data-index="${i}" data-field="offset" value="${formatOffset(channel.offsetHz)}" ${canEdit && channel.duplex ? "" : "disabled"} /></td>
          <td>${buildSelect("power", i, IJV_POWER_LIST, channel.power || 'High', !canEdit)}</td>
          <td>${buildSelect("mode", i, IJV_MODE_LIST, channel.mode || 'FM', !canEdit)}</td>
          <td>${buildSelect("bw", i, IJV_BW_LIST, channel.bw || 'W 26k', !canEdit)}</td>
          <td>${buildSelect("rxToneType", i, ["None", "CTCSS", "DCS", "DCS-R"], channel.rxToneType, !canEdit)}</td>
          <td>${buildToneSelect("rxTone", i, channel.rxToneType, channel.rxTone, !canEdit)}</td>
          <td>${buildSelect("txToneType", i, ["None", "CTCSS", "DCS", "DCS-R"], channel.txToneType, !canEdit)}</td>
          <td>${buildToneSelect("txTone", i, channel.txToneType, channel.txTone, !canEdit)}</td>
          <td>${buildSelect("step", i, IJV_STEP_LIST, IJV_STEP_LIST[channel.step] || '12.5 kHz', !canEdit)}</td>
          <td>${buildSelect("squelch", i, IJV_SQUELCH_LIST, String(channel.squelch ?? 4), !canEdit)}</td>
          <td>${buildSelect("agcMode", i, IJV_AGC_MODE_LIST, channel.agcMode || 'AUTO', !canEdit)}</td>
          <td>${buildSelect("compander", i, IJV_COMPANDER_LIST, channel.compander || 'OFF', !canEdit)}</td>
          <td>${buildSelect("pttid", i, IJV_PTTID_LIST, channel.pttid || 'OFF', !canEdit)}</td>
          <td>${buildSelect("scrambler", i, IJV_SCRAMBLER_LIST, channel.scrambler || 'OFF', !canEdit)}</td>
          <td>${buildSelect("digCode", i, IJV_DIGCODE_LIST, channel.digCode || 'OFF', !canEdit)}</td>
          <td><input type="checkbox" data-index="${i}" data-field="reverse" ${channel.reverse ? "checked" : ""} ${canEdit ? "" : "disabled"} /></td>
          <td><input type="checkbox" data-index="${i}" data-field="busy" ${channel.busy ? "checked" : ""} ${canEdit ? "" : "disabled"} /></td>
          <td><input type="checkbox" data-index="${i}" data-field="txLock" ${channel.txLock ? "checked" : ""} ${canEdit ? "" : "disabled"} /></td>
          <td><input type="checkbox" data-index="${i}" data-field="enableScan" ${channel.enableScan ? "checked" : ""} ${canEdit ? "" : "disabled"} /></td>
          <td>${buildSelect("band", i, IJV_BAND_LIST, String(channel.band ?? 1), !canEdit)}</td>
          <td>${buildSelect("group", i, IJV_GROUP_LIST, String(channel.group ?? 0), !canEdit)}</td>
        </tr>
      `);
    } else {
      // K5 Default table row - original structure
      rows.push(`
        <tr>
          <td>${channel.number}</td>
          <td><input type="text" data-index="${i}" data-field="name" value="${channel.name}" maxlength="10" ${canEdit ? "" : "disabled"} /></td>
          <td><input type="text" data-index="${i}" data-field="rxFreq" value="${formatFreq(channel.rxFreqHz)}" ${canEdit ? "" : "disabled"} /></td>
          <td>${buildSelect("duplex", i, ["", "+", "-"], channel.duplex, !canEdit)}</td>
          <td><input type="text" data-index="${i}" data-field="offset" value="${formatOffset(channel.offsetHz)}" ${canEdit && channel.duplex ? "" : "disabled"} /></td>
          <td>${buildSelect("power", i, POWER_LIST, channel.power, !canEdit)}</td>
          <td>${buildSelect("mode", i, MODE_LIST, channel.mode, !canEdit)}</td>
          <td>${buildSelect("rxToneType", i, ["None", "CTCSS", "DCS", "DCS-R"], channel.rxToneType, !canEdit)}</td>
          <td>${buildToneSelect("rxTone", i, channel.rxToneType, channel.rxTone, !canEdit)}</td>
          <td>${buildSelect("txToneType", i, ["None", "CTCSS", "DCS", "DCS-R"], channel.txToneType, !canEdit)}</td>
          <td>${buildToneSelect("txTone", i, channel.txToneType, channel.txTone, !canEdit)}</td>
          <td>${buildSelect("step", i, STEPS.map(String), String(channel.step), !canEdit)}</td>
          <td><input type="checkbox" data-index="${i}" data-field="reverse" ${channel.reverse ? "checked" : ""} ${canEdit ? "" : "disabled"} /></td>
          <td><input type="checkbox" data-index="${i}" data-field="busy" ${channel.busy ? "checked" : ""} ${canEdit ? "" : "disabled"} /></td>
          <td><input type="checkbox" data-index="${i}" data-field="txLock" ${channel.txLock ? "checked" : ""} ${canEdit ? "" : "disabled"} /></td>
          <td>${buildSelect("pttid", i, PTTID_LIST, channel.pttid, !canEdit)}</td>
          <td>${buildSelect("scanlist", i, SCANLIST_LIST, SCANLIST_LIST[channel.scanlist] ?? "None", !canEdit)}</td>
        </tr>
      `);
    }
  }
  channelBody.innerHTML = rows.join("");
  
  // Update table header for TK11
  updateTableHeader(isTK11);
};

const renderPageLinks = () => {
  const totalPages = Math.ceil(channels.length / PAGE_SIZE);
  const links = [];
  const maxLinks = 9;
  const half = Math.floor(maxLinks / 2);
  let start = Math.max(0, currentPage - half);
  let end = Math.min(totalPages, start + maxLinks);
  if (end - start < maxLinks) {
    start = Math.max(0, end - maxLinks);
  }
  for (let i = start; i < end; i += 1) {
    const active = i === currentPage ? "active" : "";
    links.push(`<button class="page-link ${active}" data-page="${i}">${i + 1}</button>`);
  }
  pageLinks.innerHTML = links.join("");
};

const buildSelect = (field, index, options, selected, disabled = false) => {
  const opts = options
    .map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`)
    .join("");
  return `<select data-index="${index}" data-field="${field}" ${disabled ? "disabled" : ""}>${opts}</select>`;
};

const buildToneSelect = (field, index, type, selected, disabled = false) => {
  let options = [];
  if (type === "CTCSS") {
    options = CTCSS_TONES.map((tone) => tone.toFixed(1));
  } else if (type === "DCS" || type === "DCS-R") {
    options = DTCS_CODES.map(String);
  }
  const opts = options
    .map((value) => `<option value="${value}" ${String(value) === String(selected) ? "selected" : ""}>${value}</option>`)
    .join("");
  const disabledAttr = options.length === 0 || disabled ? "disabled" : "";
  return `<select data-index="${index}" data-field="${field}" ${disabledAttr}>${opts}</select>`;
};

// TK11 tone select - uses DCS-N and DCS-I instead of DCS and DCS-R
const buildToneSelectTK11 = (field, index, type, selected, disabled = false) => {
  let options = [];
  if (type === "CTCSS") {
    options = CTCSS_TONES.map((tone) => tone.toFixed(1));
  } else if (type === "DCS-N" || type === "DCS-I") {
    options = DTCS_CODES.map(String);
  }
  const opts = options
    .map((value) => `<option value="${value}" ${String(value) === String(selected) ? "selected" : ""}>${value}</option>`)
    .join("");
  const disabledAttr = options.length === 0 || disabled ? "disabled" : "";
  return `<select data-index="${index}" data-field="${field}" ${disabledAttr}>${opts}</select>`;
};

// Update table header based on radio type
const updateTableHeader = (isTK11) => {
  const thead = document.querySelector('#channelTable thead tr');
  if (!thead) return;
  const isIJV = currentK5Profile === 'ijv_vx3';
  
  if (isTK11) {
    thead.innerHTML = `
      <th>#</th>
      <th>Name</th>
      <th>RX Freq</th>
      <th>Duplex</th>
      <th>Offset</th>
      <th>Mode</th>
      <th>BW</th>
      <th>Power</th>
      <th>RX Type</th>
      <th>RX Tone</th>
      <th>TX Type</th>
      <th>TX Tone</th>
      <th>Squelch</th>
      <th>Encrypt</th>
      <th>Step</th>
      <th>PTT ID</th>
      <th>Scan List</th>
    `;
  } else if (isIJV) {
    // IJV firmware - extended columns
    thead.innerHTML = `
      <th>#</th>
      <th>Name</th>
      <th>RX Freq</th>
      <th>Shift</th>
      <th>Offset</th>
      <th>Power</th>
      <th>Mode</th>
      <th>BW</th>
      <th>RX Type</th>
      <th>RX Tone</th>
      <th>TX Type</th>
      <th>TX Tone</th>
      <th>Step</th>
      <th>Squelch</th>
      <th>AGC</th>
      <th>Compander</th>
      <th>PTT ID</th>
      <th>Scrambler</th>
      <th>Dig Code</th>
      <th>Rev</th>
      <th>Busy</th>
      <th>TX Lock</th>
      <th>Scan</th>
      <th>Band</th>
      <th>Group</th>
    `;
  } else {
    // K5 Default
    thead.innerHTML = `
      <th>#</th>
      <th>Name</th>
      <th>RX Freq</th>
      <th>Duplex</th>
      <th>Offset</th>
      <th>Power</th>
      <th>Mode</th>
      <th>RX Type</th>
      <th>RX Tone</th>
      <th>TX Type</th>
      <th>TX Tone</th>
      <th>Step</th>
      <th>Rev</th>
      <th>Busy</th>
      <th>TX Lock</th>
      <th>PTT ID</th>
      <th>Scan List</th>
    `;
  }
};

if (channelBody) channelBody.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  const index = Number.parseInt(target.dataset.index, 10);
  const field = target.dataset.field;
  if (Number.isNaN(index) || !field) return;

  const channel = channels[index];
  if (!channel) return;

  if (target instanceof HTMLInputElement && target.type === "checkbox") {
    channel[field] = target.checked;
  } else if (field === "rxFreq") {
    channel.rxFreqHz = parseFreq(target.value);
    updateDuplexFromOffset(channel);
  } else if (field === "duplex") {
    channel.duplex = target.value;
    updateDuplexFromOffset(channel);
  } else if (field === "offset") {
    const offset = Number.parseFloat(target.value);
    channel.offsetHz = Number.isNaN(offset) ? 0 : Math.round(offset * 1_000_000);
    updateDuplexFromOffset(channel);
  } else if (field === "step") {
    channel.step = Number.parseFloat(target.value);
  } else if (field === "scanlist") {
    // Handle both K5 and TK11 scanlist formats
    const isTK11 = getSelectedRadio() === 'TK11';
    if (isTK11) {
      if (target.value === 'None') {
        channel.scanlist = 0;
      } else if (target.value === 'All') {
        channel.scanlist = 33;
      } else {
        channel.scanlist = parseInt(target.value) || 0;
      }
    } else {
      channel.scanlist = SCANLIST_LIST.indexOf(target.value);
    }
  } else if (field === "bw") {
    channel.bw = target.value;
  } else if (field === "squelch") {
    channel.squelch = parseInt(target.value) || 0;
  } else if (field === "encrypt") {
    channel.encrypt = target.value;
  } else {
    channel[field] = target.value;
  }

  if (field === "rxToneType" && channel.rxToneType !== "CTCSS") {
    channel.rxTone = channel.rxToneType.startsWith("DCS") ? DTCS_CODES[0] : "";
  }
  if (field === "rxToneType" && channel.rxToneType === "CTCSS") {
    channel.rxTone = CTCSS_TONES[0].toFixed(1);
  }
  if (field === "txToneType" && channel.txToneType !== "CTCSS") {
    channel.txTone = channel.txToneType.startsWith("DCS") ? DTCS_CODES[0] : "";
  }
  if (field === "txToneType" && channel.txToneType === "CTCSS") {
    channel.txTone = CTCSS_TONES[0].toFixed(1);
  }

  if (field === "rxToneType" || field === "txToneType") {
    renderTable();
  }
});

const readChannels = async () => {
  if (!isConnected) {
    setStatus("Connect the radio on Home page first.", "error");
    return;
  }
  if (!claim("channels")) {
    setStatus("Another tool is using the serial connection.", "error");
    return;
  }
  const port = getPort();
  if (!port) {
    setStatus("Serial port unavailable.", "error");
    release("channels");
    return;
  }
  
  const radio = getSelectedRadio();
  const channelCount = getChannelCount();
  
  disableActions(true);
  setEditEnabled(false);
  setProgress(0, true);
  setStatus(`Reading channels from ${radio}...`);
  showModal(`Reading channels (${radio})`, "Keep the radio powered on.");
  
  try {
    if (radio === 'TK11') {
      // TK11: Read using TK11 protocol
      await tk11Init(port);
      
      const channelCount = TK11_PROFILE.CHANNELS_COUNT;  // 999
      const channelSize = TK11_PROFILE.CHANNEL_SIZE;     // 64 bytes per channel
      const totalChannelBytes = channelCount * channelSize;  // 999 * 64 = 63,936 bytes
      const blockSize = TK11_MAX_CHUNK_SIZE; // 512 bytes
      
      // Calculate total blocks: channels + channel_usage flags
      const channelBlocks = Math.ceil(totalChannelBytes / blockSize);
      const usageFlagsSize = channelCount;  // 999 bytes (1 byte per channel)
      const usageBlocks = Math.ceil(usageFlagsSize / blockSize);
      const totalBlocks = channelBlocks + usageBlocks;
      
      console.log(`TK11: Reading ${channelCount} channels (${totalChannelBytes} bytes) + ${usageFlagsSize} usage flags`);
      
      // Read channel data from 0x00000
      const channelBytes = new Uint8Array(totalChannelBytes);
      for (let i = 0; i < channelBlocks; i++) {
        const offset = i * blockSize;
        const remaining = totalChannelBytes - offset;
        const readSize = Math.min(blockSize, remaining);
        
        const data = await tk11Read(port, TK11_PROFILE.ADDR.CHANNELS + offset, readSize);
        channelBytes.set(data.slice(0, readSize), offset);
        
        setProgress(((i + 1) / totalBlocks) * 90, true);
      }
      
      // Read channel usage flags from 0x11000
      const usageFlags = new Uint8Array(usageFlagsSize);
      for (let i = 0; i < usageBlocks; i++) {
        const offset = i * blockSize;
        const remaining = usageFlagsSize - offset;
        const readSize = Math.min(blockSize, remaining);
        
        const data = await tk11Read(port, TK11_PROFILE.ADDR.CHANNELS_USAGE + offset, readSize);
        usageFlags.set(data.slice(0, readSize), offset);
        
        setProgress(90 + ((i + 1) / usageBlocks) * 10, true);
      }
      
      console.log('TK11: Decoding channels with usage flags...');
      channels = decodeTK11Channels(channelBytes, usageFlags);
    } else {
      // K5/K1: Read using EEPROM protocol
      await eepromInit(port);

      const totalReads = 3;
      let progressStep = 0;
      const updateProgress = () => {
        progressStep += 1;
        setProgress((progressStep / totalReads) * 100, true);
      };

      const profile = getK5Profile();
      const channelCount = profile.channelCount;
      
      if (currentK5Profile === 'ijv_vx3') {
        // IJV firmware: 999 channels at 0x2000, 32 bytes each
        const totalBytes = channelCount * 32;
        const BLOCK_SIZE = 256;
        const totalBlocks = Math.ceil(totalBytes / BLOCK_SIZE);
        const channelBytes = new Uint8Array(totalBytes);
        
        for (let i = 0; i < totalBlocks; i++) {
          const offset = i * BLOCK_SIZE;
          const readSize = Math.min(BLOCK_SIZE, totalBytes - offset);
          const blockData = await readRange(0x2000 + offset, readSize);
          channelBytes.set(blockData, offset);
          setProgress(((i + 1) / totalBlocks) * 100, true);
          // Allow browser to update UI every 10 blocks
          if (i % 10 === 0) {
            await new Promise(r => setTimeout(r, 0));
          }
        }
        
        channels = decodeIJVChannels(channelBytes, channelCount);
      } else {
        // Default K5: 200 channels
        const channelBytes = await readRange(0x0000, channelCount * 16);
        updateProgress();
        const attrBytes = await readRange(0x0d60, channelCount);
        updateProgress();
        const nameBytes = await readRange(0x0f50, channelCount * 16);
        updateProgress();
        channels = decodeChannels(channelBytes, nameBytes, attrBytes);
      }
    }
    
    currentPage = 0;
    setEditEnabled(true);
    renderTable();
    updatePaginationControls();
    setStatus(`${channels.length} channels loaded.`);
    setProgress(100, true);
    setTimeout(() => {
      setProgress(0, false);
      hideModal();
    }, 800);
  } catch (error) {
    setStatus(`Read failed: ${error.message}`, "error");
    setProgress(0, false);
    setEditEnabled(false);
    hideModal();
  } finally {
    disableActions(false);
    release("channels");
  }
};

const writeChannels = async () => {
  if (!isConnected) {
    setStatus("Connect the radio on Home page first.", "error");
    return;
  }
  if (!claim("channels")) {
    setStatus("Another tool is using the serial connection.", "error");
    return;
  }
  if (!canEdit) {
    setStatus("Read from the radio before editing.", "error");
    release("channels");
    return;
  }
  const port = getPort();
  if (!port) {
    setStatus("Serial port unavailable.", "error");
    release("channels");
    return;
  }
  
  const radio = getSelectedRadio();
  
  disableActions(true);
  setProgress(0, true);
  setStatus(`Writing channels to ${radio}...`);
  showModal(`Writing channels (${radio})`, "Keep the radio powered on.");
  
  try {
    if (radio === 'TK11') {
      // TK11: Write using TK11 protocol
      await tk11Init(port);
      
      // Encode channels and get both channel data and usage flags
      const { channelBytes, usageFlags } = encodeTK11Channels();
      const blockSize = TK11_MAX_CHUNK_SIZE;
      
      // Calculate total blocks for progress
      const channelBlocks = Math.ceil(channelBytes.length / blockSize);
      const usageBlocks = Math.ceil(usageFlags.length / blockSize);
      const totalBlocks = channelBlocks + usageBlocks;
      
      console.log(`TK11: Writing ${channelBytes.length} channel bytes + ${usageFlags.length} usage flags`);
      
      // Write channel data to 0x00000
      for (let i = 0; i < channelBlocks; i++) {
        const offset = i * blockSize;
        const remaining = channelBytes.length - offset;
        const writeSize = Math.min(blockSize, remaining);
        
        const chunk = channelBytes.slice(offset, offset + writeSize);
        await tk11Write(port, TK11_PROFILE.ADDR.CHANNELS + offset, chunk);
        
        setProgress(((i + 1) / totalBlocks) * 90, true);
      }
      
      // Write usage flags to 0x11000
      for (let i = 0; i < usageBlocks; i++) {
        const offset = i * blockSize;
        const remaining = usageFlags.length - offset;
        const writeSize = Math.min(blockSize, remaining);
        
        const chunk = usageFlags.slice(offset, offset + writeSize);
        await tk11Write(port, TK11_PROFILE.ADDR.CHANNELS_USAGE + offset, chunk);
        
        setProgress(90 + ((i + 1) / usageBlocks) * 10, true);
      }
      
      console.log('TK11: Rebooting radio...');
      await tk11Reboot(port);
    } else {
      // K5/K1: Write using EEPROM protocol
      await eepromInit(port);

      if (currentK5Profile === 'ijv_vx3') {
        // IJV firmware: 999 channels at 0x2000, 32 bytes each
        const channelBytes = encodeIJVChannels();
        const totalBytes = channelBytes.length;
        const BLOCK_SIZE = 256;
        const totalBlocks = Math.ceil(totalBytes / BLOCK_SIZE);
        
        for (let i = 0; i < totalBlocks; i++) {
          const offset = i * BLOCK_SIZE;
          const writeSize = Math.min(BLOCK_SIZE, totalBytes - offset);
          const chunk = channelBytes.slice(offset, offset + writeSize);
          await writeRange(0x2000 + offset, chunk);
          setProgress(((i + 1) / totalBlocks) * 100, true);
          // Allow browser to update UI every 10 blocks
          if (i % 10 === 0) {
            await new Promise(r => setTimeout(r, 0));
          }
        }
      } else {
        // Default K5: 200 channels
        const { channelBytes, nameBytes, attrBytes } = encodeChannels();
        const totalWrites = 3;
        let progressStep = 0;
        const updateProgress = () => {
          progressStep += 1;
          setProgress((progressStep / totalWrites) * 100, true);
        };

        await writeRange(0x0000, channelBytes);
        updateProgress();
        await writeRange(0x0d60, attrBytes);
        updateProgress();
        await writeRange(0x0f50, nameBytes);
        updateProgress();
      }

      await eepromReboot(port);
    }
    
    setStatus("Channels written successfully.");
    setProgress(100, true);
    setTimeout(() => {
      setProgress(0, false);
      hideModal();
    }, 800);
  } catch (error) {
    setStatus(`Write failed: ${error.message}`, "error");
    setProgress(0, false);
    hideModal();
  } finally {
    disableActions(false);
    release("channels");
  }
};

const exportCsv = () => {
  if (!canEdit) {
    setStatus("Read from the radio before exporting.", "error");
    return;
  }
  const headers = [
    "number",
    "name",
    "frequency_mhz",
    "duplex",
    "offset_mhz",
    "power",
    "mode",
    "rx_tone_type",
    "rx_tone",
    "tx_tone_type",
    "tx_tone",
    "step",
    "reverse",
    "busy",
    "tx_lock",
    "pttid",
    "scanlist",
  ];
  const rows = channels.map((channel) => [
    channel.number,
    channel.name,
    formatFreq(channel.rxFreqHz),
    channel.duplex,
    formatOffset(channel.offsetHz),
    channel.power,
    channel.mode,
    channel.rxToneType,
    channel.rxTone,
    channel.txToneType,
    channel.txTone,
    channel.step,
    channel.reverse ? "1" : "0",
    channel.busy ? "1" : "0",
    channel.txLock ? "1" : "0",
    channel.pttid,
    SCANLIST_LIST[channel.scanlist] ?? "None",
  ]);
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "uv-k5-channels.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const importCsv = () => {
  if (!canEdit) {
    setStatus("Read from the radio before importing.", "error");
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    const dataLines = lines.slice(1);
    dataLines.forEach((line, idx) => {
      const columns = line.split(",");
      if (columns.length < 10) return;
      const channel = channels[idx];
      if (!channel) return;
    channel.name = columns[1] ?? "";
      channel.rxFreqHz = parseFreq(columns[2]);
      channel.duplex = columns[3] ?? "";
      channel.offsetHz = Math.round((Number.parseFloat(columns[4]) || 0) * 1_000_000);
      channel.power = columns[5] ?? "USER";
      channel.mode = columns[6] ?? "FM";
      channel.rxToneType = columns[7] ?? "None";
      channel.rxTone = columns[8] ?? "";
      channel.txToneType = columns[9] ?? "None";
      channel.txTone = columns[10] ?? "";
      channel.step = Number.parseFloat(columns[11]) || STEPS[0];
      channel.reverse = columns[12] === "1";
      channel.busy = columns[13] === "1";
      channel.txLock = columns[14] === "1";
      channel.pttid = columns[15] ?? "OFF";
      channel.scanlist = Math.max(0, SCANLIST_LIST.indexOf(columns[16]));
      updateDuplexFromOffset(channel);
    });
    renderTable();
    setStatus("CSV imported.");
  };
  input.click();
};

if (prevPageBtn) {
  prevPageBtn.addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage -= 1;
      renderTable();
    }
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener("click", () => {
    const maxPage = Math.floor((channels.length - 1) / PAGE_SIZE);
    if (currentPage < maxPage) {
      currentPage += 1;
      renderTable();
    }
  });
}

if (pageLinks) {
  pageLinks.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const page = Number.parseInt(target.dataset.page, 10);
    if (Number.isNaN(page)) return;
    currentPage = page;
    renderTable();
  });
}

if (readChannelsBtn) readChannelsBtn.addEventListener("click", readChannels);
if (writeChannelsBtn) writeChannelsBtn.addEventListener("click", writeChannels);
if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCsv);
if (importCsvBtn) importCsvBtn.addEventListener("click", importCsv);

// View mode toggle
if (viewPagesBtn) {
  viewPagesBtn.addEventListener("click", () => {
    viewMode = "pages";
    viewPagesBtn.classList.add("active");
    viewAllBtn.classList.remove("active");
    renderTable();
  });
}
if (viewAllBtn) {
  viewAllBtn.addEventListener("click", () => {
    viewMode = "all";
    viewAllBtn.classList.add("active");
    viewPagesBtn.classList.remove("active");
    renderTable();
  });
}

subscribe((state) => {
  isConnected = state.connected;
  if (connectionDot) {
    connectionDot.dataset.status = state.connected ? "connected" : "disconnected";
  }
  if (connectionLabel) {
    connectionLabel.textContent = state.connected ? "Connected" : "Disconnected";
  }
  if (firmwareEl) {
    firmwareEl.textContent = state.firmwareVersion || "-";
  }
  if (!state.connected) {
    setEditEnabled(false);
  }
  updateActionState();
});

// Channel Profile selector
const channelProfileSelect = document.getElementById('channelProfileSelect');
if (channelProfileSelect) {
  channelProfileSelect.addEventListener('change', (e) => {
    currentK5Profile = e.target.value;
    console.log('Profile value selected:', currentK5Profile);
    const profile = getK5Profile();
    console.log('Profile object:', profile);
    if (!profile) {
      console.error('Profile not found for:', currentK5Profile);
      return;
    }
    console.log('Switched to channel profile:', profile.name);
    
    // Reinitialize channels array with correct count
    const newCount = profile.channelCount;
    channels = Array.from({ length: newCount }, (_, index) => buildEmptyChannel(index + 1));
    
    // Reset state
    currentPage = 0;
    canEdit = false;
    
    // Update pagination info
    const pageInfoEl = document.getElementById('pageInfo');
    if (pageInfoEl) {
      pageInfoEl.textContent = `1-${Math.min(PAGE_SIZE, newCount)} of ${newCount}`;
    }
    
    // Update page links
    updatePaginationControls();
    
    // Re-render table with correct structure and header
    const isTK11 = getSelectedRadio() === 'TK11';
    updateTableHeader(isTK11);
    renderTable();
    
    setStatus(`Profile changed to ${profile.name}. Read channels to load data.`);
  });
}

setEditEnabled(false);
setStatus("Idle.");
setProgress(0, false);
hideModal();
