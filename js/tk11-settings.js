// tk11-settings.js
// TK11 Settings UI handlers - Full Implementation v4.0
// Based on tk11.py memory structure

import { subscribe, getPort, claim, release } from "./serial-manager.js";
import { tk11Init, tk11Read, tk11Write, tk11Reboot, TK11_MAX_CHUNK_SIZE } from "./protocol-tk11.js";
import { logoRead, logoWrite, displayLogoOnCanvas, LOGO_ADDRESS } from "./logo-editor.js";

'use strict';

// ============================================
// MEMORY ADDRESSES (from tk11.py)
// ============================================
const MemoryAddress = {
  FM: 0x12000,
  GENERAL_SETTINGS: 0x13000,
  GENERAL_2_SETTINGS: 0x14000,
  CHANNELS_IDX: 0x15000,
  SCAN_LIST: 0x16000,
  DTMF_CONTACTS: 0x1A000,
  TONE5_CONTACTS: 0x1A800,
  NOAA_DECODE_ADDRESSES: 0x22000,
  NOAA_SAME_EVENT_CONTROL: 0x22280
};

// ============================================
// CHUNK SIZES (from tk11.py)
// ============================================
const ChunkSize = {
  SETTINGS: 0xF8,          // 248 bytes - General settings block
  SETTINGS_2: 0x70,        // 112 bytes - General2 settings (device name, kill codes)
  FM: 0x48,                // 72 bytes - FM radio settings
  CHANNELS_IDX: 0x10,      // 16 bytes
  DTMF_CONTACTS: 0x180,    // 384 bytes (16 contacts x 24 bytes each)
  SCAN_LIST: 0x80,         // 128 bytes
  TONE5_CONTACTS: 0x180,   // 384 bytes (16 contacts x 24 bytes each)
  NOAA_DECODE_ADDRESSES: 0x280,  // 640 bytes (16 addresses x 40 bytes)
  NOAA_SAME_EVENTS_CONTROL: 0x80 // 128 bytes
};

// ============================================
// GENERAL SETTINGS OFFSETS (0x13000 base)
// ============================================
const GeneralOffset = {
  channel_ab: 0,
  noaa_sq: 1,
  tx_tot: 2,
  noaa_scan: 3,
  keylock: 4,
  vox_sw: 5,
  vox_lvl: 6,
  mic: 7,
  freq_mode: 8,
  channel_display_mode: 9,
  mw_sw_agc: 10,
  power_save: 11,
  dual_watch: 12,
  backlight: 13,
  call_ch: 14,       // 2 bytes (ul16)
  beep: 16,
  key_short1: 17,
  key_long1: 18,
  key_short2: 19,
  key_long2: 20,
  scan_mode: 21,
  auto_lock: 22,
  power_on_screen_mode: 23,
  alarm_mode: 24,
  roger_tone: 25,
  repeater_tail: 26,
  tail_tone: 27,
  denoise_sw: 28,
  denoise_lvl: 29,
  transpositional_sw: 30,
  transpositional_lvl: 31,
  chn_A_volume: 32,
  chn_B_volume: 33,
  key_tone_flag: 34,
  language: 35,
  noaa_same_decode: 36,
  noaa_same_event: 37,
  noaa_same_address: 38,
  unknown: 39,
  sbar: 40,
  brightness: 41,
  kill_code: 42,
  dtmf_side_tone: 43,
  dtmf_decode_rspn: 44,
  match_tot: 45,
  match_qt_mode: 46,
  match_dcs_bit: 47,
  match_threshold: 48,
  unknown_2: 49,
  cw_pitch_freq: 50,   // 2 bytes (ul16)
  unknown_3: 52,       // 4 bytes
  dtmf_separator: 56,  // 2 bytes (ul16)
  dtmf_group_code: 58, // 2 bytes (ul16)
  dtmf_reset_time: 60,
  dtmf_resv4: 61,
  dtmf_carry_time: 62,     // 2 bytes (ul16)
  dtmf_first_code_time: 64,// 2 bytes (ul16)
  dtmf_d_code_time: 66,    // 2 bytes (ul16)
  dtmf_continue_time: 68,  // 2 bytes (ul16)
  dtmf_interval_time: 70,  // 2 bytes (ul16)
  dtmf_id: 72,             // 8 bytes
  dtmf_up_code: 80,        // 16 bytes
  dtmf_down_code: 96,      // 16 bytes
  unknown_4: 112,          // 16 bytes
  tone5_separator: 128,    // 2 bytes (ul16)
  tone5_group_code: 130,   // 2 bytes (ul16)
  tone5_reset_time: 132,
  tone5_resv4: 133,
  tone5_carry_time: 134,       // 2 bytes (ul16)
  tone5_first_code_time: 136,  // 2 bytes (ul16)
  tone5_protocol: 138,
  tone5_resv1: 139,
  tone5_single_continue_time: 140,  // 2 bytes (ul16)
  tone5_single_interval_time: 142,  // 2 bytes (ul16)
  tone5_id: 144,               // 8 bytes
  tone5_up_code: 152,          // 16 bytes
  tone5_down_code: 168,        // 16 bytes
  tone5_user_freq: 184,        // 30 bytes (15 x 2 bytes each)
  tone5_revs5: 214,            // 2 bytes
  logo_string1: 216,           // 16 bytes
  logo_string2: 232            // 16 bytes (ends at 248 = 0xF8)
};

// ============================================
// GENERAL2 SETTINGS OFFSETS (0x14000 base)
// ============================================
const General2Offset = {
  unknown_5: 0,        // 48 bytes
  dtmf_kill: 48,       // 8 bytes
  dtmf_wakeup: 56,     // 8 bytes
  tone5_kill: 64,      // 8 bytes
  tone5_wakeup: 72,    // 8 bytes
  unknown_6: 80,       // 16 bytes
  device_name: 96      // 16 bytes (ends at 112 = 0x70)
};

// ============================================
// FM SETTINGS OFFSETS (0x12000 base)
// ============================================
const FMOffset = {
  vfo_frequency: 0,     // 2 bytes (ul16)
  channel_id: 2,
  memory_vfo_flag: 3,
  unknown: 4,           // 4 bytes
  frequencies: 8        // 64 bytes (32 x 2 bytes each)
};

// ============================================
// OPTIONS LISTS (from tk11.py)
// ============================================
const TOT_LIST = ["Off", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const VOX_MODE = ["Off", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const MIC_MODE = ["1", "2", "3", "4", "5", "6"];
const BACKLIGHT = ["Off", "1", "2", "3", "4", "5", "10", "15", "20", "25", "30", "Always ON"];
const BRIGHTNESS_MODE = Array.from({length: 193}, (_, i) => String(i + 8));
const SCAN_MODE = ["TO", "CO", "SE"];
const POWER_ON_MODE = ["Off", "1:1", "1:2", "1:3", "1:4"];
const ALARM_MODE = ["Local alarm", "Remote alarm"];
const RESPOND_MODE = ["OFF", "Remind", "Reply", "Remind & reply"];
const SIDE_KEY_ACTION = ['None', 'Flashlight', 'Power selection', 'Monitor', 'Scan', 'VOX', 'Alarm', 'FM radio', '1750 MHZ'];
const KEY_LOCK_MODE = ["Unlocked", "Locked"];
const BOOT_SCREEN_MODE = ["Fullscreen", "Welcome", "Battery voltage", "Picture", "None"];
const CHANNELS = ["A", "B"];
const VOLUME = ["0%", "33%", "66%", "100%"];
const CHANNEL_DISPLAY_MODE = ["Frequency", "ID", "Name"];
const REPEATER_TAIL_TONE = ["OFF", "100", "200", "300", "400", "500", "600", "700", "800", "900", "1000"];
const REMIND_END_OF_TALK = ["OFF", "Beep tone", "MDC", "User1", "User2", "User3", "User4", "User5"];
const DENOISE = ["OFF", "1", "2", "3", "4", "5", "6"];
const TRANSPOSITIONAL = ["OFF", "1", "2", "3", "4", "5"];
const MSW_LIST = ['2K', '2.5K', '3K', '3.5K', '4K', '4.5K', '5K'];
const FREQUENCY_METER_MODES = ["Normal", "Expert mode", "Auto learning mode"];
const DCS_MODES = ["23bit", "24bit"];
const DTMF_SEPARATE_CODES = ["Null", "A", "B", "C", "D", "*", "#"];
const DTMF_GROUP_CODES = ["A", "B", "C", "D", "*", "#"];
const _5TONE_PROTOCOLS = ["EIA", "EEA", "CCIR", "ZVEI1", "ZVEI2", "User"];
const _5TONE_SEPARATE_CODES = ["A", "B", "C", "D", "E"];
const _5TONE_GROUP_CODES = ["A", "B", "C", "D", "E"];

// DTMF/5TONE timing options (30-1000 in steps of 10)
const DTMF_TIMES = Array.from({length: 98}, (_, i) => String(30 + i * 10));
const _5TONE_TIMES = DTMF_TIMES;
const _5TONE_SINGLE_INTERVAL_TIMES = Array.from({length: 101}, (_, i) => String(i * 10));

// ============================================
// DATA STORAGE
// ============================================
let generalData = null;
let logoData = null;      // 0x0D6008 LOGO data
let general2Data = null;     // 0x14000 data
let fmData = null;           // 0x12000 data
let dtmfContactsData = null; // 0x1A000 data
let tone5ContactsData = null;// 0x1A800 data
let noaaAddressesData = null;// 0x22000 data
let noaaEventsData = null;   // 0x22280 data
let isConnected = false;

// ============================================
// HELPER FUNCTIONS
// ============================================

// ========== TK11 FM TABLE GENERATION ==========
function initTK11FMTable() {
  const tbody = document.getElementById('tk11FMTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  for (let i = 0; i < 32; i++) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="index-col">${i + 1}</td>
      <td>
        <input type="number" 
               id="tk11FMFreq${i}" 
               value="" 
               min="76.0" 
               max="108.0" 
               step="0.1"
               placeholder="MHz">
      </td>
      <td>
        <button class="clear-btn" data-index="${i}" title="Clear this frequency">✕</button>
      </td>
    `;
    tbody.appendChild(row);
  }
  
  // Add clear button handlers
  tbody.querySelectorAll('.clear-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.dataset.index;
      const input = document.getElementById(`tk11FMFreq${idx}`);
      if (input) input.value = '';
    });
  });
}

// ========== DTMF/5TONE TIME SELECTS INITIALIZATION ==========
function initTK11TimeSelects() {
  // Generate options for DTMF time selects (30-1000ms in steps of 10)
  const dtmfTimeIds = [
    'tk11DTMFPreLoadTime',
    'tk11DTMFFirstCodePersist',
    'tk11DTMFCodePersist',
    'tk11DTMFCodeContinue',
    'tk11DTMFCodeInterval'
  ];
  
  dtmfTimeIds.forEach(id => {
    const select = document.getElementById(id);
    if (select && select.options.length === 0) {
      for (let ms = 30; ms <= 1000; ms += 10) {
        const option = document.createElement('option');
        option.value = ms;
        option.textContent = ms;
        select.appendChild(option);
      }
    }
  });
  
  // Generate options for 5TONE time selects (30-1000ms in steps of 10)
  const tone5TimeIds = [
    'tk115TonePreLoadTime',
    'tk115ToneFirstCodePersist',
    'tk115ToneCodeContinue'
  ];
  
  tone5TimeIds.forEach(id => {
    const select = document.getElementById(id);
    if (select && select.options.length === 0) {
      for (let ms = 30; ms <= 1000; ms += 10) {
        const option = document.createElement('option');
        option.value = ms;
        option.textContent = ms;
        select.appendChild(option);
      }
    }
  });
  
  // 5TONE Code Interval uses different range (0-1000ms in steps of 10)
  const intervalSelect = document.getElementById('tk115ToneCodeInterval');
  if (intervalSelect && intervalSelect.options.length === 0) {
    for (let ms = 0; ms <= 1000; ms += 10) {
      const option = document.createElement('option');
      option.value = ms;
      option.textContent = ms;
      intervalSelect.appendChild(option);
    }
  }
}

// ========== TK11 DTMF CONTACTS TABLE GENERATION ==========
function initTK11DTMFContacts() {
  const tbody = document.getElementById('tk11DTMFTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="index-col">${i + 1}</td>
      <td><input type="text" id="tk11DTMFContact${i}Name" maxlength="8" placeholder="Name"></td>
      <td><input type="text" id="tk11DTMFContact${i}Code" maxlength="3" pattern="[0-9]*" placeholder="Code"></td>
      <td><button class="clear-btn" onclick="clearTK11DTMFContact(${i})" title="Clear">✕</button></td>
    `;
    tbody.appendChild(row);
  }
}

function clearTK11DTMFContact(index) {
  document.getElementById(`tk11DTMFContact${index}Name`).value = '';
  document.getElementById(`tk11DTMFContact${index}Code`).value = '';
}

function clearAllTK11DTMFContacts() {
  for (let i = 0; i < 16; i++) {
    clearTK11DTMFContact(i);
  }
}

// ========== TK11 5TONE CONTACTS TABLE GENERATION ==========
function initTK115ToneContacts() {
  const tbody = document.getElementById('tk115ToneTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="index-col">${i + 1}</td>
      <td><input type="text" id="tk115ToneContact${i}Name" maxlength="8" placeholder="Name"></td>
      <td><input type="text" id="tk115ToneContact${i}Code" maxlength="3" pattern="[0-9]*" placeholder="Code"></td>
      <td><button class="clear-btn" onclick="clearTK115ToneContact(${i})" title="Clear">✕</button></td>
    `;
    tbody.appendChild(row);
  }
}

function clearTK115ToneContact(index) {
  document.getElementById(`tk115ToneContact${index}Name`).value = '';
  document.getElementById(`tk115ToneContact${index}Code`).value = '';
}

function clearAllTK115ToneContacts() {
  for (let i = 0; i < 16; i++) {
    clearTK115ToneContact(i);
  }
}

// ========== TK11 5TONE USER FREQUENCIES ==========
function initTK115ToneUserFreqs() {
  const container = document.getElementById('tk115ToneUserFreqs');
  if (!container) return;
  
  container.innerHTML = '';
  for (let i = 0; i < 15; i++) {
    const div = document.createElement('div');
    div.className = 'setting-item';
    div.innerHTML = `
      <label for="tk115ToneUserFreq${i}">User Freq ${i + 1}</label>
      <input type="number" id="tk115ToneUserFreq${i}" min="350" max="3500" step="1" placeholder="Hz">
    `;
    container.appendChild(div);
  }
}

// Initialize TK11 FM table, time selects, and contact tables on page load
document.addEventListener('DOMContentLoaded', () => {
  initTK11FMTable();
  initTK11TimeSelects();
  initTK11DTMFContacts();
  initTK115ToneContacts();
  initTK115ToneUserFreqs();
  
  // Connect Clear All buttons
  const dtmfClearBtn = document.getElementById('tk11DTMFClearBtn');
  if (dtmfClearBtn) {
    dtmfClearBtn.addEventListener('click', clearAllTK11DTMFContacts);
  }
  
  const toneClearBtn = document.getElementById('tk115ToneClearBtn');
  if (toneClearBtn) {
    toneClearBtn.addEventListener('click', clearAllTK115ToneContacts);
  }
});

function getUint8(data, offset) {
  if (!data || offset >= data.length) return 0;
  return data[offset] & 0xFF;
}

function getUint16LE(data, offset) {
  if (!data || offset + 1 >= data.length) return 0;
  return data[offset] | (data[offset + 1] << 8);
}

function setUint8(data, offset, value) {
  if (!data || offset >= data.length) return;
  data[offset] = value & 0xFF;
}

function setUint16LE(data, offset, value) {
  if (!data || offset + 1 >= data.length) return;
  data[offset] = value & 0xFF;
  data[offset + 1] = (value >> 8) & 0xFF;
}

function getString(data, offset, length) {
  if (!data) return '';
  let str = '';
  for (let i = 0; i < length; i++) {
    const byte = data[offset + i];
    if (byte === 0 || byte === 0xFF) break;
    str += String.fromCharCode(byte);
  }
  return str.trim();
}

function setString(data, offset, str, length) {
  if (!data) return;
  for (let i = 0; i < length; i++) {
    if (i < str.length) {
      data[offset + i] = str.charCodeAt(i) & 0xFF;
    } else {
      data[offset + i] = 0x00;  // Pad with nulls
    }
  }
}

function getDTMFCode(data, offset, length) {
  if (!data) return '';
  let code = '';
  for (let i = 0; i < length; i++) {
    const byte = data[offset + i];
    if (byte === 0xFF) break;
    if (byte >= 0 && byte <= 9) {
      code += String(byte);
    } else if (byte === 10) {
      code += 'A';
    } else if (byte === 11) {
      code += 'B';
    } else if (byte === 12) {
      code += 'C';
    } else if (byte === 13) {
      code += 'D';
    } else if (byte === 14) {
      code += '*';
    } else if (byte === 15) {
      code += '#';
    }
  }
  return code;
}

function setDTMFCode(data, offset, code, length) {
  if (!data) return;
  for (let i = 0; i < length; i++) {
    if (i < code.length) {
      const char = code[i].toUpperCase();
      if (char >= '0' && char <= '9') {
        data[offset + i] = parseInt(char);
      } else if (char === 'A') {
        data[offset + i] = 10;
      } else if (char === 'B') {
        data[offset + i] = 11;
      } else if (char === 'C') {
        data[offset + i] = 12;
      } else if (char === 'D') {
        data[offset + i] = 13;
      } else if (char === '*') {
        data[offset + i] = 14;
      } else if (char === '#') {
        data[offset + i] = 15;
      }
    } else {
      data[offset + i] = 0xFF;  // Pad with 0xFF
    }
  }
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================
function updateConnectionStatus(connected, firmware = '-') {
  isConnected = connected;
  const dot = document.getElementById('tk11SettingsStatusDot');
  const label = document.getElementById('tk11SettingsStatusLabel');
  const fwLabel = document.getElementById('tk11SettingsFirmware');
  const readAllBtn = document.getElementById('tk11ReadAllSettingsBtn');
  const writeAllBtn = document.getElementById('tk11WriteAllSettingsBtn');

  if (dot) dot.dataset.status = connected ? 'connected' : 'disconnected';
  if (label) label.textContent = connected ? 'Connected' : 'Not connected';
  if (fwLabel) fwLabel.textContent = firmware;
  if (readAllBtn) readAllBtn.disabled = !connected;
  if (writeAllBtn) writeAllBtn.disabled = !connected;

  // Update all tab read/write buttons
  ['General', 'Buttons', 'Startup', 'Channel', 'Match', 'NOAA', 'DTMF', '5Tone', 'FM'].forEach(tab => {
    const readBtn = document.getElementById(`tk11${tab}ReadBtn`);
    const writeBtn = document.getElementById(`tk11${tab}WriteBtn`);
    if (readBtn) readBtn.disabled = !connected;
    if (writeBtn) writeBtn.disabled = !connected;
  });
}

function setProgress(percent) {
  const fill = document.getElementById('tk11SettingsFill');
  if (fill) fill.style.width = `${percent}%`;
}

function showStatus(message, isError = false) {
  const label = document.getElementById('tk11SettingsStatusLabel');
  if (label) {
    label.textContent = message;
    if (isError) {
      label.style.color = '#ff4444';
      setTimeout(() => {
        label.style.color = '';
        label.textContent = isConnected ? 'Connected' : 'Not connected';
      }, 3000);
    }
  }
}

// ============================================
// POPULATE UI FROM DATA
// ============================================
function populateGeneral() {
  if (!generalData) return;
  
  setValue('tk11TOT', getUint8(generalData, GeneralOffset.tx_tot));
  setValue('tk11VOX', getUint8(generalData, GeneralOffset.vox_lvl));
  setValue('tk11Mic', getUint8(generalData, GeneralOffset.mic));
  setValue('tk11Backlight', getUint8(generalData, GeneralOffset.backlight));
  setValue('tk11Brightness', getUint8(generalData, GeneralOffset.brightness));
  setValue('tk11ScanMode', getUint8(generalData, GeneralOffset.scan_mode));
  setValue('tk11PowerOnMode', getUint8(generalData, GeneralOffset.power_save));
  setValue('tk11Alarm', getUint8(generalData, GeneralOffset.alarm_mode));
  setValue('tk11Respond', getUint8(generalData, GeneralOffset.dtmf_decode_rspn));
  setValue('tk11CWPitch', getUint16LE(generalData, GeneralOffset.cw_pitch_freq));
  setValue('tk11Beep', getUint8(generalData, GeneralOffset.beep));
  setValue('tk11Voice', getUint8(generalData, GeneralOffset.language));
  setValue('tk11SBar', getUint8(generalData, GeneralOffset.sbar));
  setValue('tk11KillCode', getUint8(generalData, GeneralOffset.kill_code));
  setValue('tk11SideTone', getUint8(generalData, GeneralOffset.dtmf_side_tone));
  setValue('tk11MwSwAGC', getUint8(generalData, GeneralOffset.mw_sw_agc));
}

function populateButtons() {
  if (!generalData) return;
  
  setValue('tk11SideKey1Short', getUint8(generalData, GeneralOffset.key_short1));
  setValue('tk11SideKey1Long', getUint8(generalData, GeneralOffset.key_long1));
  setValue('tk11SideKey2Short', getUint8(generalData, GeneralOffset.key_short2));
  setValue('tk11SideKey2Long', getUint8(generalData, GeneralOffset.key_long2));
  setValue('tk11KeyLock', getUint8(generalData, GeneralOffset.keylock));
  setValue('tk11AutoLock', getUint8(generalData, GeneralOffset.auto_lock));
}

function populateStartup() {
  if (!generalData || !general2Data) return;
  
  setValue('tk11DeviceName', getString(general2Data, General2Offset.device_name, 16));
  setValue('tk11StartString1', getString(generalData, GeneralOffset.logo_string1, 16));
  setValue('tk11StartString2', getString(generalData, GeneralOffset.logo_string2, 16));
  setValue('tk11BootScreen', getUint8(generalData, GeneralOffset.power_on_screen_mode));
}

function populateChannel() {
  if (!generalData) return;
  
  setValue('tk11ADisplay', getUint8(generalData, GeneralOffset.channel_ab));
  setValue('tk11VolumeA', getUint8(generalData, GeneralOffset.chn_A_volume));
  setValue('tk11VolumeB', getUint8(generalData, GeneralOffset.chn_B_volume));
  setValue('tk11VFOMode', getUint8(generalData, GeneralOffset.freq_mode));
  setValue('tk11ChannelDisplayMode', getUint8(generalData, GeneralOffset.channel_display_mode));
  setValue('tk11RepeaterTail', getUint8(generalData, GeneralOffset.repeater_tail));
  setValue('tk11TailTone', getUint8(generalData, GeneralOffset.tail_tone));
  setValue('tk11MainChannel', getUint16LE(generalData, GeneralOffset.call_ch));
  setValue('tk11DualReceive', getUint8(generalData, GeneralOffset.dual_watch));
  setValue('tk11Denoise', getUint8(generalData, GeneralOffset.denoise_sw));
  setValue('tk11DenoiseLvl', getUint8(generalData, GeneralOffset.denoise_lvl));
  setValue('tk11Transpositional', getUint8(generalData, GeneralOffset.transpositional_sw));
  setValue('tk11TranspositionalLvl', getUint8(generalData, GeneralOffset.transpositional_lvl));
}

function populateMatch() {
  if (!generalData) return;
  
  setValue('tk11FreqMeterTOT', getUint8(generalData, GeneralOffset.match_tot));
  setValue('tk11FreqMeterMode', getUint8(generalData, GeneralOffset.match_qt_mode));
  setValue('tk11MatchDCS', getUint8(generalData, GeneralOffset.match_dcs_bit));
  setValue('tk11MatchThreshold', getUint8(generalData, GeneralOffset.match_threshold));
}

function populateNOAA() {
  if (!generalData) return;
  
  setValue('tk11NOAASameDecode', getUint8(generalData, GeneralOffset.noaa_same_decode));
  setValue('tk11NOAASameEvent', getUint8(generalData, GeneralOffset.noaa_same_event));
  setValue('tk11NOAASameAddress', getUint8(generalData, GeneralOffset.noaa_same_address));
  setValue('tk11NOAASQ', getUint8(generalData, GeneralOffset.noaa_sq));
  setValue('tk11NOAAScan', getUint8(generalData, GeneralOffset.noaa_scan));
}

function populateDTMF() {
  if (!generalData || !general2Data) return;
  
  // DTMF Settings
  setValue('tk11DTMFSeparateCode', getUint16LE(generalData, GeneralOffset.dtmf_separator));
  setValue('tk11DTMFGroupCode', getUint16LE(generalData, GeneralOffset.dtmf_group_code));
  setValue('tk11DTMFAutoResetTime', getUint8(generalData, GeneralOffset.dtmf_reset_time));
  setValue('tk11DTMFPreLoadTime', getUint16LE(generalData, GeneralOffset.dtmf_carry_time));
  setValue('tk11DTMFFirstCodePersist', getUint16LE(generalData, GeneralOffset.dtmf_first_code_time));
  setValue('tk11DTMFCodePersist', getUint16LE(generalData, GeneralOffset.dtmf_d_code_time));
  setValue('tk11DTMFCodeContinue', getUint16LE(generalData, GeneralOffset.dtmf_continue_time));
  setValue('tk11DTMFCodeInterval', getUint16LE(generalData, GeneralOffset.dtmf_interval_time));
  
  // DTMF Codes
  setValue('tk11DTMFLocalCode', getDTMFCode(generalData, GeneralOffset.dtmf_id, 8));
  setValue('tk11DTMFUpCode', getDTMFCode(generalData, GeneralOffset.dtmf_up_code, 16));
  setValue('tk11DTMFDownCode', getDTMFCode(generalData, GeneralOffset.dtmf_down_code, 16));
  setValue('tk11DTMFKillCode', getDTMFCode(general2Data, General2Offset.dtmf_kill, 8));
  setValue('tk11DTMFReviveCode', getDTMFCode(general2Data, General2Offset.dtmf_wakeup, 8));
  
  // DTMF Contacts
  if (dtmfContactsData) {
    for (let i = 0; i < 16; i++) {
      const offset = i * 24;  // Each contact is 24 bytes (16 name + 8 code)
      setValue(`tk11DTMFContactName${i}`, getString(dtmfContactsData, offset, 16));
      setValue(`tk11DTMFContactCode${i}`, getDTMFCode(dtmfContactsData, offset + 16, 8));
    }
  }
}

function populate5Tone() {
  if (!generalData || !general2Data) return;
  
  // 5TONE Settings
  setValue('tk115ToneProtocol', getUint8(generalData, GeneralOffset.tone5_protocol));
  setValue('tk115ToneSeparateCode', getUint16LE(generalData, GeneralOffset.tone5_separator));
  setValue('tk115ToneGroupCode', getUint16LE(generalData, GeneralOffset.tone5_group_code));
  setValue('tk115ToneAutoResetTime', getUint8(generalData, GeneralOffset.tone5_reset_time));
  setValue('tk115TonePreLoadTime', getUint16LE(generalData, GeneralOffset.tone5_carry_time));
  setValue('tk115ToneFirstCodePersist', getUint16LE(generalData, GeneralOffset.tone5_first_code_time));
  setValue('tk115ToneCodeContinue', getUint16LE(generalData, GeneralOffset.tone5_single_continue_time));
  setValue('tk115ToneCodeInterval', getUint16LE(generalData, GeneralOffset.tone5_single_interval_time));
  
  // 5TONE Codes
  setValue('tk115ToneLocalCode', getDTMFCode(generalData, GeneralOffset.tone5_id, 8));
  setValue('tk115ToneUpCode', getDTMFCode(generalData, GeneralOffset.tone5_up_code, 16));
  setValue('tk115ToneDownCode', getDTMFCode(generalData, GeneralOffset.tone5_down_code, 16));
  setValue('tk115ToneKillCode', getDTMFCode(general2Data, General2Offset.tone5_kill, 8));
  setValue('tk115ToneReviveCode', getDTMFCode(general2Data, General2Offset.tone5_wakeup, 8));
  
  // 5TONE User Frequencies
  for (let i = 0; i < 15; i++) {
    const freq = getUint16LE(generalData, GeneralOffset.tone5_user_freq + (i * 2));
    setValue(`tk115ToneUserFreq${i}`, freq);
  }
  
  // 5TONE Contacts
  if (tone5ContactsData) {
    for (let i = 0; i < 16; i++) {
      const offset = i * 24;  // Each contact is 24 bytes (16 name + 8 code)
      setValue(`tk115ToneContactName${i}`, getString(tone5ContactsData, offset, 16));
      setValue(`tk115ToneContactCode${i}`, getDTMFCode(tone5ContactsData, offset + 16, 8));
    }
  }
}

function populateFM() {
  if (!fmData) return;
  
  // FM VFO frequency (stored as value/10, displayed in MHz)
  const vfoFreq = getUint16LE(fmData, FMOffset.vfo_frequency);
  setValue('tk11FMVFO', vfoFreq ? (vfoFreq / 10).toFixed(1) : '87.5');
  setValue('tk11FMChannel', getUint8(fmData, FMOffset.channel_id) + 1);  // Display 1-32
  setValue('tk11FMMode', getUint8(fmData, FMOffset.memory_vfo_flag));
  
  // FM preset frequencies
  for (let i = 0; i < 32; i++) {
    const freq = getUint16LE(fmData, FMOffset.frequencies + (i * 2));
    setValue(`tk11FMFreq${i}`, freq ? (freq / 10).toFixed(1) : '');
  }
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  
  if (el.type === 'checkbox') {
    el.checked = !!value;
  } else {
    el.value = value;
  }
}

function getValue(id, defaultValue = 0) {
  const el = document.getElementById(id);
  if (!el) return defaultValue;
  
  if (el.type === 'checkbox') {
    return el.checked ? 1 : 0;
  } else if (el.type === 'number') {
    return parseInt(el.value) || defaultValue;
  } else {
    return el.value;
  }
}

// ============================================
// COLLECT UI DATA TO BUFFERS
// ============================================
function collectGeneral() {
  if (!generalData) return;
  
  setUint8(generalData, GeneralOffset.tx_tot, getValue('tk11TOT'));
  setUint8(generalData, GeneralOffset.vox_lvl, getValue('tk11VOX'));
  setUint8(generalData, GeneralOffset.mic, getValue('tk11Mic'));
  setUint8(generalData, GeneralOffset.backlight, getValue('tk11Backlight'));
  setUint8(generalData, GeneralOffset.brightness, getValue('tk11Brightness'));
  setUint8(generalData, GeneralOffset.scan_mode, getValue('tk11ScanMode'));
  setUint8(generalData, GeneralOffset.power_save, getValue('tk11PowerOnMode'));
  setUint8(generalData, GeneralOffset.alarm_mode, getValue('tk11Alarm'));
  setUint8(generalData, GeneralOffset.dtmf_decode_rspn, getValue('tk11Respond'));
  setUint16LE(generalData, GeneralOffset.cw_pitch_freq, getValue('tk11CWPitch'));
  setUint8(generalData, GeneralOffset.beep, getValue('tk11Beep'));
  setUint8(generalData, GeneralOffset.language, getValue('tk11Voice'));
  setUint8(generalData, GeneralOffset.sbar, getValue('tk11SBar'));
  setUint8(generalData, GeneralOffset.kill_code, getValue('tk11KillCode'));
  setUint8(generalData, GeneralOffset.dtmf_side_tone, getValue('tk11SideTone'));
  setUint8(generalData, GeneralOffset.mw_sw_agc, getValue('tk11MwSwAGC'));
}

function collectButtons() {
  if (!generalData) return;
  
  setUint8(generalData, GeneralOffset.key_short1, getValue('tk11SideKey1Short'));
  setUint8(generalData, GeneralOffset.key_long1, getValue('tk11SideKey1Long'));
  setUint8(generalData, GeneralOffset.key_short2, getValue('tk11SideKey2Short'));
  setUint8(generalData, GeneralOffset.key_long2, getValue('tk11SideKey2Long'));
  setUint8(generalData, GeneralOffset.keylock, getValue('tk11KeyLock'));
  setUint8(generalData, GeneralOffset.auto_lock, getValue('tk11AutoLock'));
}

function collectStartup() {
  if (!generalData || !general2Data) return;
  
  setString(general2Data, General2Offset.device_name, getValue('tk11DeviceName', ''), 16);
  setString(generalData, GeneralOffset.logo_string1, getValue('tk11StartString1', ''), 16);
  setString(generalData, GeneralOffset.logo_string2, getValue('tk11StartString2', ''), 16);
  setUint8(generalData, GeneralOffset.power_on_screen_mode, getValue('tk11BootScreen'));
}

function collectChannel() {
  if (!generalData) return;
  
  setUint8(generalData, GeneralOffset.channel_ab, getValue('tk11ADisplay'));
  setUint8(generalData, GeneralOffset.chn_A_volume, getValue('tk11VolumeA'));
  setUint8(generalData, GeneralOffset.chn_B_volume, getValue('tk11VolumeB'));
  setUint8(generalData, GeneralOffset.freq_mode, getValue('tk11VFOMode'));
  setUint8(generalData, GeneralOffset.channel_display_mode, getValue('tk11ChannelDisplayMode'));
  setUint8(generalData, GeneralOffset.repeater_tail, getValue('tk11RepeaterTail'));
  setUint8(generalData, GeneralOffset.tail_tone, getValue('tk11TailTone'));
  setUint16LE(generalData, GeneralOffset.call_ch, getValue('tk11MainChannel'));
  setUint8(generalData, GeneralOffset.dual_watch, getValue('tk11DualReceive'));
  setUint8(generalData, GeneralOffset.denoise_sw, getValue('tk11Denoise'));
  setUint8(generalData, GeneralOffset.denoise_lvl, getValue('tk11DenoiseLvl'));
  setUint8(generalData, GeneralOffset.transpositional_sw, getValue('tk11Transpositional'));
  setUint8(generalData, GeneralOffset.transpositional_lvl, getValue('tk11TranspositionalLvl'));
}

function collectMatch() {
  if (!generalData) return;
  
  setUint8(generalData, GeneralOffset.match_tot, getValue('tk11FreqMeterTOT'));
  setUint8(generalData, GeneralOffset.match_qt_mode, getValue('tk11FreqMeterMode'));
  setUint8(generalData, GeneralOffset.match_dcs_bit, getValue('tk11MatchDCS'));
  setUint8(generalData, GeneralOffset.match_threshold, getValue('tk11MatchThreshold'));
}

function collectNOAA() {
  if (!generalData) return;
  
  setUint8(generalData, GeneralOffset.noaa_same_decode, getValue('tk11NOAASameDecode'));
  setUint8(generalData, GeneralOffset.noaa_same_event, getValue('tk11NOAASameEvent'));
  setUint8(generalData, GeneralOffset.noaa_same_address, getValue('tk11NOAASameAddress'));
  setUint8(generalData, GeneralOffset.noaa_sq, getValue('tk11NOAASQ'));
  setUint8(generalData, GeneralOffset.noaa_scan, getValue('tk11NOAAScan'));
}

function collectDTMF() {
  if (!generalData || !general2Data) return;
  
  // DTMF Settings
  setUint16LE(generalData, GeneralOffset.dtmf_separator, getValue('tk11DTMFSeparateCode'));
  setUint16LE(generalData, GeneralOffset.dtmf_group_code, getValue('tk11DTMFGroupCode'));
  setUint8(generalData, GeneralOffset.dtmf_reset_time, getValue('tk11DTMFAutoResetTime'));
  setUint16LE(generalData, GeneralOffset.dtmf_carry_time, getValue('tk11DTMFPreLoadTime'));
  setUint16LE(generalData, GeneralOffset.dtmf_first_code_time, getValue('tk11DTMFFirstCodePersist'));
  setUint16LE(generalData, GeneralOffset.dtmf_d_code_time, getValue('tk11DTMFCodePersist'));
  setUint16LE(generalData, GeneralOffset.dtmf_continue_time, getValue('tk11DTMFCodeContinue'));
  setUint16LE(generalData, GeneralOffset.dtmf_interval_time, getValue('tk11DTMFCodeInterval'));
  
  // DTMF Codes
  setDTMFCode(generalData, GeneralOffset.dtmf_id, getValue('tk11DTMFLocalCode', ''), 8);
  setDTMFCode(generalData, GeneralOffset.dtmf_up_code, getValue('tk11DTMFUpCode', ''), 16);
  setDTMFCode(generalData, GeneralOffset.dtmf_down_code, getValue('tk11DTMFDownCode', ''), 16);
  setDTMFCode(general2Data, General2Offset.dtmf_kill, getValue('tk11DTMFKillCode', ''), 8);
  setDTMFCode(general2Data, General2Offset.dtmf_wakeup, getValue('tk11DTMFReviveCode', ''), 8);
  
  // DTMF Contacts
  if (dtmfContactsData) {
    for (let i = 0; i < 16; i++) {
      const offset = i * 24;
      setString(dtmfContactsData, offset, getValue(`tk11DTMFContactName${i}`, ''), 16);
      setDTMFCode(dtmfContactsData, offset + 16, getValue(`tk11DTMFContactCode${i}`, ''), 8);
    }
  }
}

function collect5Tone() {
  if (!generalData || !general2Data) return;
  
  // 5TONE Settings
  setUint8(generalData, GeneralOffset.tone5_protocol, getValue('tk115ToneProtocol'));
  setUint16LE(generalData, GeneralOffset.tone5_separator, getValue('tk115ToneSeparateCode'));
  setUint16LE(generalData, GeneralOffset.tone5_group_code, getValue('tk115ToneGroupCode'));
  setUint8(generalData, GeneralOffset.tone5_reset_time, getValue('tk115ToneAutoResetTime'));
  setUint16LE(generalData, GeneralOffset.tone5_carry_time, getValue('tk115TonePreLoadTime'));
  setUint16LE(generalData, GeneralOffset.tone5_first_code_time, getValue('tk115ToneFirstCodePersist'));
  setUint16LE(generalData, GeneralOffset.tone5_single_continue_time, getValue('tk115ToneCodeContinue'));
  setUint16LE(generalData, GeneralOffset.tone5_single_interval_time, getValue('tk115ToneCodeInterval'));
  
  // 5TONE Codes
  setDTMFCode(generalData, GeneralOffset.tone5_id, getValue('tk115ToneLocalCode', ''), 8);
  setDTMFCode(generalData, GeneralOffset.tone5_up_code, getValue('tk115ToneUpCode', ''), 16);
  setDTMFCode(generalData, GeneralOffset.tone5_down_code, getValue('tk115ToneDownCode', ''), 16);
  setDTMFCode(general2Data, General2Offset.tone5_kill, getValue('tk115ToneKillCode', ''), 8);
  setDTMFCode(general2Data, General2Offset.tone5_wakeup, getValue('tk115ToneReviveCode', ''), 8);
  
  // 5TONE User Frequencies
  for (let i = 0; i < 15; i++) {
    setUint16LE(generalData, GeneralOffset.tone5_user_freq + (i * 2), getValue(`tk115ToneUserFreq${i}`));
  }
  
  // 5TONE Contacts
  if (tone5ContactsData) {
    for (let i = 0; i < 16; i++) {
      const offset = i * 24;
      setString(tone5ContactsData, offset, getValue(`tk115ToneContactName${i}`, ''), 16);
      setDTMFCode(tone5ContactsData, offset + 16, getValue(`tk115ToneContactCode${i}`, ''), 8);
    }
  }
}

function collectFM() {
  if (!fmData) return;
  
  // FM VFO frequency (stored as value*10)
  const vfoFreq = parseFloat(getValue('tk11FMVFO', '87.5')) * 10;
  setUint16LE(fmData, FMOffset.vfo_frequency, Math.round(vfoFreq));
  setUint8(fmData, FMOffset.channel_id, Math.max(0, getValue('tk11FMChannel') - 1));  // Store 0-31
  setUint8(fmData, FMOffset.memory_vfo_flag, getValue('tk11FMMode'));
  
  // FM preset frequencies
  for (let i = 0; i < 32; i++) {
    const freqStr = getValue(`tk11FMFreq${i}`, '');
    const freq = freqStr ? parseFloat(freqStr) * 10 : 0;
    setUint16LE(fmData, FMOffset.frequencies + (i * 2), Math.round(freq));
  }
}

// ============================================
// READ/WRITE FUNCTIONS
// ============================================
async function readMemory(address, size) {
  const port = getPort();
  if (!port) {
    throw new Error('Not connected to radio');
  }
  await tk11Init(port);
  return await tk11Read(port, address, size);
}

async function writeMemory(address, data) {
  const port = getPort();
  if (!port) {
    throw new Error('Not connected to radio');
  }
  await tk11Init(port);
  return await tk11Write(port, address, data);
}

// Read functions for each tab
async function readGeneral() {
  showStatus('Reading General settings...');
  setProgress(0);
  
  try {
    generalData = new Uint8Array(await readMemory(MemoryAddress.GENERAL_SETTINGS, ChunkSize.SETTINGS));
    setProgress(100);
    populateGeneral();
    showStatus('General settings loaded');
    return true;
  } catch (e) {
    showStatus('Error reading General settings: ' + e.message, true);
    return false;
  }
}

async function readButtons() {
  showStatus('Reading Buttons settings...');
  setProgress(0);
  
  try {
    if (!generalData) {
      generalData = new Uint8Array(await readMemory(MemoryAddress.GENERAL_SETTINGS, ChunkSize.SETTINGS));
    }
    setProgress(100);
    populateButtons();
    showStatus('Buttons settings loaded');
    return true;
  } catch (e) {
    showStatus('Error reading Buttons settings: ' + e.message, true);
    return false;
  }
}

async function readStartup() {
  showStatus('Reading Startup settings...');
  setProgress(0);
  
  try {
    if (!generalData) {
      generalData = new Uint8Array(await readMemory(MemoryAddress.GENERAL_SETTINGS, ChunkSize.SETTINGS));
    }
    setProgress(50);
    if (!general2Data) {
      general2Data = new Uint8Array(await readMemory(MemoryAddress.GENERAL_2_SETTINGS, ChunkSize.SETTINGS_2));
    }
    setProgress(100);
    populateStartup();
    showStatus('Startup settings loaded');
    return true;
  } catch (e) {
    showStatus('Error reading Startup settings: ' + e.message, true);
    return false;
  }
}

async function readChannel() {
  showStatus('Reading Channel settings...');
  setProgress(0);
  
  try {
    if (!generalData) {
      generalData = new Uint8Array(await readMemory(MemoryAddress.GENERAL_SETTINGS, ChunkSize.SETTINGS));
    }
    setProgress(100);
    populateChannel();
    showStatus('Channel settings loaded');
    return true;
  } catch (e) {
    showStatus('Error reading Channel settings: ' + e.message, true);
    return false;
  }
}

async function readMatch() {
  showStatus('Reading Match Freq settings...');
  setProgress(0);
  
  try {
    if (!generalData) {
      generalData = new Uint8Array(await readMemory(MemoryAddress.GENERAL_SETTINGS, ChunkSize.SETTINGS));
    }
    setProgress(100);
    populateMatch();
    showStatus('Match Freq settings loaded');
    return true;
  } catch (e) {
    showStatus('Error reading Match Freq settings: ' + e.message, true);
    return false;
  }
}

async function readNOAA() {
  showStatus('Reading NOAA settings...');
  setProgress(0);
  
  try {
    if (!generalData) {
      generalData = new Uint8Array(await readMemory(MemoryAddress.GENERAL_SETTINGS, ChunkSize.SETTINGS));
    }
    setProgress(100);
    populateNOAA();
    showStatus('NOAA settings loaded');
    return true;
  } catch (e) {
    showStatus('Error reading NOAA settings: ' + e.message, true);
    return false;
  }
}

async function readDTMF() {
  showStatus('Reading DTMF settings...');
  setProgress(0);
  
  try {
    if (!generalData) {
      generalData = new Uint8Array(await readMemory(MemoryAddress.GENERAL_SETTINGS, ChunkSize.SETTINGS));
    }
    setProgress(33);
    if (!general2Data) {
      general2Data = new Uint8Array(await readMemory(MemoryAddress.GENERAL_2_SETTINGS, ChunkSize.SETTINGS_2));
    }
    setProgress(66);
    dtmfContactsData = new Uint8Array(await readMemory(MemoryAddress.DTMF_CONTACTS, ChunkSize.DTMF_CONTACTS));
    setProgress(100);
    populateDTMF();
    showStatus('DTMF settings loaded');
    return true;
  } catch (e) {
    showStatus('Error reading DTMF settings: ' + e.message, true);
    return false;
  }
}

async function read5Tone() {
  showStatus('Reading 5TONE settings...');
  setProgress(0);
  
  try {
    if (!generalData) {
      generalData = new Uint8Array(await readMemory(MemoryAddress.GENERAL_SETTINGS, ChunkSize.SETTINGS));
    }
    setProgress(33);
    if (!general2Data) {
      general2Data = new Uint8Array(await readMemory(MemoryAddress.GENERAL_2_SETTINGS, ChunkSize.SETTINGS_2));
    }
    setProgress(66);
    tone5ContactsData = new Uint8Array(await readMemory(MemoryAddress.TONE5_CONTACTS, ChunkSize.TONE5_CONTACTS));
    setProgress(100);
    populate5Tone();
    showStatus('5TONE settings loaded');
    return true;
  } catch (e) {
    showStatus('Error reading 5TONE settings: ' + e.message, true);
    return false;
  }
}

async function readFM() {
  showStatus('Reading FM settings...');
  setProgress(0);
  
  try {
    fmData = new Uint8Array(await readMemory(MemoryAddress.FM, ChunkSize.FM));
    setProgress(100);
    populateFM();
    showStatus('FM settings loaded');
    return true;
  } catch (e) {
    showStatus('Error reading FM settings: ' + e.message, true);
    return false;
  }
}

// Write functions for each tab
async function writeGeneral() {
  if (!generalData) {
    showStatus('No data to write. Read settings first.', true);
    return false;
  }
  
  showStatus('Writing General settings...');
  setProgress(0);
  
  try {
    collectGeneral();
    await writeMemory(MemoryAddress.GENERAL_SETTINGS, generalData);
    setProgress(100);
    showStatus('General settings saved');
    return true;
  } catch (e) {
    showStatus('Error writing General settings: ' + e.message, true);
    return false;
  }
}

async function writeButtons() {
  if (!generalData) {
    showStatus('No data to write. Read settings first.', true);
    return false;
  }
  
  showStatus('Writing Buttons settings...');
  setProgress(0);
  
  try {
    collectButtons();
    await writeMemory(MemoryAddress.GENERAL_SETTINGS, generalData);
    setProgress(100);
    showStatus('Buttons settings saved');
    return true;
  } catch (e) {
    showStatus('Error writing Buttons settings: ' + e.message, true);
    return false;
  }
}

async function writeStartup() {
  if (!generalData || !general2Data) {
    showStatus('No data to write. Read settings first.', true);
    return false;
  }
  
  showStatus('Writing Startup settings...');
  setProgress(0);
  
  try {
    collectStartup();
    await writeMemory(MemoryAddress.GENERAL_SETTINGS, generalData);
    setProgress(50);
    await writeMemory(MemoryAddress.GENERAL_2_SETTINGS, general2Data);
    setProgress(100);
    showStatus('Startup settings saved');
    return true;
  } catch (e) {
    showStatus('Error writing Startup settings: ' + e.message, true);
    return false;
  }
}

async function writeChannel() {
  if (!generalData) {
    showStatus('No data to write. Read settings first.', true);
    return false;
  }
  
  showStatus('Writing Channel settings...');
  setProgress(0);
  
  try {
    collectChannel();
    await writeMemory(MemoryAddress.GENERAL_SETTINGS, generalData);
    setProgress(100);
    showStatus('Channel settings saved');
    return true;
  } catch (e) {
    showStatus('Error writing Channel settings: ' + e.message, true);
    return false;
  }
}

async function writeMatch() {
  if (!generalData) {
    showStatus('No data to write. Read settings first.', true);
    return false;
  }
  
  showStatus('Writing Match Freq settings...');
  setProgress(0);
  
  try {
    collectMatch();
    await writeMemory(MemoryAddress.GENERAL_SETTINGS, generalData);
    setProgress(100);
    showStatus('Match Freq settings saved');
    return true;
  } catch (e) {
    showStatus('Error writing Match Freq settings: ' + e.message, true);
    return false;
  }
}

async function writeNOAA() {
  if (!generalData) {
    showStatus('No data to write. Read settings first.', true);
    return false;
  }
  
  showStatus('Writing NOAA settings...');
  setProgress(0);
  
  try {
    collectNOAA();
    await writeMemory(MemoryAddress.GENERAL_SETTINGS, generalData);
    setProgress(100);
    showStatus('NOAA settings saved');
    return true;
  } catch (e) {
    showStatus('Error writing NOAA settings: ' + e.message, true);
    return false;
  }
}

async function writeDTMF() {
  if (!generalData || !general2Data) {
    showStatus('No data to write. Read settings first.', true);
    return false;
  }
  
  showStatus('Writing DTMF settings...');
  setProgress(0);
  
  try {
    collectDTMF();
    await writeMemory(MemoryAddress.GENERAL_SETTINGS, generalData);
    setProgress(33);
    await writeMemory(MemoryAddress.GENERAL_2_SETTINGS, general2Data);
    setProgress(66);
    if (dtmfContactsData) {
      await writeMemory(MemoryAddress.DTMF_CONTACTS, dtmfContactsData);
    }
    setProgress(100);
    showStatus('DTMF settings saved');
    return true;
  } catch (e) {
    showStatus('Error writing DTMF settings: ' + e.message, true);
    return false;
  }
}

async function write5Tone() {
  if (!generalData || !general2Data) {
    showStatus('No data to write. Read settings first.', true);
    return false;
  }
  
  showStatus('Writing 5TONE settings...');
  setProgress(0);
  
  try {
    collect5Tone();
    await writeMemory(MemoryAddress.GENERAL_SETTINGS, generalData);
    setProgress(33);
    await writeMemory(MemoryAddress.GENERAL_2_SETTINGS, general2Data);
    setProgress(66);
    if (tone5ContactsData) {
      await writeMemory(MemoryAddress.TONE5_CONTACTS, tone5ContactsData);
    }
    setProgress(100);
    showStatus('5TONE settings saved');
    return true;
  } catch (e) {
    showStatus('Error writing 5TONE settings: ' + e.message, true);
    return false;
  }
}

async function writeFM() {
  if (!fmData) {
    showStatus('No data to write. Read settings first.', true);
    return false;
  }
  
  showStatus('Writing FM settings...');
  setProgress(0);
  
  try {
    collectFM();
    await writeMemory(MemoryAddress.FM, fmData);
    setProgress(100);
    showStatus('FM settings saved');
    return true;
  } catch (e) {
    showStatus('Error writing FM settings: ' + e.message, true);
    return false;
  }
}

// Read/Write all settings
async function readAllSettings() {
  showStatus('Reading all settings...');
  setProgress(0);
  
  try {
    // Read all memory blocks
    generalData = new Uint8Array(await readMemory(MemoryAddress.GENERAL_SETTINGS, ChunkSize.SETTINGS));
    setProgress(15);
    
    general2Data = new Uint8Array(await readMemory(MemoryAddress.GENERAL_2_SETTINGS, ChunkSize.SETTINGS_2));
    setProgress(30);
    
    fmData = new Uint8Array(await readMemory(MemoryAddress.FM, ChunkSize.FM));
    setProgress(45);
    
    dtmfContactsData = new Uint8Array(await readMemory(MemoryAddress.DTMF_CONTACTS, ChunkSize.DTMF_CONTACTS));
    setProgress(60);
    
    tone5ContactsData = new Uint8Array(await readMemory(MemoryAddress.TONE5_CONTACTS, ChunkSize.TONE5_CONTACTS));
    setProgress(75);
    
    // Read Logo
    logoData = new Uint8Array(await logoRead());
    setProgress(90);
    console.log('[TK11 Settings] Logo settings loaded');
    
    // Display logo on canvas
    displayLogoOnCanvas(logoData);
    
    // Populate all UI
    populateGeneral();
    populateButtons();
    populateStartup();
    populateChannel();
    populateMatch();
    populateNOAA();
    populateDTMF();
    populate5Tone();
    populateFM();
    
    setProgress(100);
    showStatus('All settings loaded');
    return true;
  } catch (e) {
    showStatus('Error reading settings: ' + e.message, true);
    return false;
  }
}

async function writeAllSettings() {
  if (!generalData) {
    showStatus('No data to write. Read settings first.', true);
    return false;
  }
  
  showStatus('Writing all settings...');
  setProgress(0);
  
  try {
    // Collect all UI data
    collectGeneral();
    collectButtons();
    collectStartup();
    collectChannel();
    collectMatch();
    collectNOAA();
    collectDTMF();
    collect5Tone();
    collectFM();
    
    // Write all memory blocks
    await writeMemory(MemoryAddress.GENERAL_SETTINGS, generalData);
    setProgress(20);
    
    if (general2Data) {
      await writeMemory(MemoryAddress.GENERAL_2_SETTINGS, general2Data);
    }
    setProgress(40);
    
    if (fmData) {
      await writeMemory(MemoryAddress.FM, fmData);
    }
    setProgress(60);
    
    if (dtmfContactsData) {
      await writeMemory(MemoryAddress.DTMF_CONTACTS, dtmfContactsData);
    }
    setProgress(80);
    
    if (tone5ContactsData) {
      await writeMemory(MemoryAddress.TONE5_CONTACTS, tone5ContactsData);
    }
    setProgress(90);
    
    // Write Logo if available
    if (logoData) {
      await logoWrite(logoData);
      console.log('[TK11 Settings] Logo written');
    }
    setProgress(100);
    
    showStatus('All settings saved');
    return true;
  } catch (e) {
    showStatus('Error writing settings: ' + e.message, true);
    return false;
  }
}

// ============================================
// TAB NAVIGATION
// ============================================
function initTabs() {
  const tabButtons = document.querySelectorAll('.tk11-settings-tabs .tab-btn');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      // Update active button
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update active content
      document.querySelectorAll('.tk11-settings-tabs .tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      const tabContent = document.getElementById('tab-' + tabId);
      if (tabContent) {
        tabContent.classList.add('active');
      }
    });
  });
}

// ============================================
// BUTTON HANDLERS
// ============================================
function initButtons() {
  // Read All / Write All
  const readAllBtn = document.getElementById('tk11ReadAllSettingsBtn');
  const writeAllBtn = document.getElementById('tk11WriteAllSettingsBtn');
  
  if (readAllBtn) {
    readAllBtn.addEventListener('click', readAllSettings);
  }
  if (writeAllBtn) {
    writeAllBtn.addEventListener('click', writeAllSettings);
  }
  
  // Tab-specific buttons
  const tabButtons = {
    'General': { read: readGeneral, write: writeGeneral },
    'Buttons': { read: readButtons, write: writeButtons },
    'Startup': { read: readStartup, write: writeStartup },
    'Channel': { read: readChannel, write: writeChannel },
    'Match': { read: readMatch, write: writeMatch },
    'NOAA': { read: readNOAA, write: writeNOAA },
    'DTMF': { read: readDTMF, write: writeDTMF },
    '5Tone': { read: read5Tone, write: write5Tone },
    'FM': { read: readFM, write: writeFM }
  };
  
  Object.entries(tabButtons).forEach(([tab, handlers]) => {
    const readBtn = document.getElementById(`tk11${tab}ReadBtn`);
    const writeBtn = document.getElementById(`tk11${tab}WriteBtn`);
    
    if (readBtn) {
      readBtn.addEventListener('click', handlers.read);
    }
    if (writeBtn) {
      writeBtn.addEventListener('click', handlers.write);
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================
function init() {
  initTabs();
  initButtons();
  
  // Subscribe to connection status from serial-manager (same as channels.js)
  subscribe((state) => {
    isConnected = state.connected;
    updateConnectionStatus(state.connected, state.firmwareVersion || '-');
  });
  
  console.log('TK11 Settings v4.1 initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for external use
window.tk11Settings = {
  readAllSettings,
  writeAllSettings,
  updateConnectionStatus,
  readGeneral,
  writeGeneral,
  readButtons,
  writeButtons,
  readStartup,
  writeStartup,
  readChannel,
  writeChannel,
  readMatch,
  writeMatch,
  readNOAA,
  writeNOAA,
  readDTMF,
  writeDTMF,
  read5Tone,
  write5Tone,
  readFM,
  writeFM
};

