/**
 * TK11 Radio Profile for Channel Editor - FIXED VERSION v1.3.0
 * Based on tk11.py CHIRP module and GitHub analysis
 * 
 * Memory Layout (from tk11.py MEM_FORMAT):
 * 0x00000 - 0x0FBFF: Channels (999 channels × 64 bytes = 63,936 bytes)
 * 0x11000 - 0x11400: Channel usage flags (999 bytes, flag=0xFF means empty)
 * 0x12000 - 0x12048: FM radio settings
 * 0x13000 - 0x13100: General settings
 * 0x14000 - 0x14100: General settings 2
 * 0x15000 - 0x15010: Channel index
 * 0x16000 - 0x1A000: Scan lists
 * 0x1A000 - 0x1A180: DTMF contacts
 * 0x1A800 - 0x1A980: 5Tone contacts
 * 0x22000 - 0x22280: NOAA decode addresses
 * 0x23000: Memory limit
 */

export const TK11_PROFILE = {
  name: 'TK11',
  
  // ==================== MEMORY ADDRESSES ====================
  ADDR: {
    CHANNELS:        0x00000,  // Channel data start
    CHANNELS_USAGE:  0x11000,  // Channel usage flags (0xFF = empty)
    FM:              0x12000,  // FM radio settings
    SETTINGS:        0x13000,  // General settings
    SETTINGS_2:      0x14000,  // General settings 2
    CHANNELS_IDX:    0x15000,  // Channel index
    SCAN_LIST:       0x16000,  // Scan lists
    DTMF_CONTACTS:   0x1A000,  // DTMF contacts
    TONE5_CONTACTS:  0x1A800,  // 5Tone contacts
    NOAA_ADDRESSES:  0x22000,  // NOAA decode addresses
    MEMORY_LIMIT:    0x23000,  // Memory limit
  },
  
  // ==================== CHANNEL STRUCTURE ====================
  // From tk11.py MEM_FORMAT - Each channel is 64 bytes!
  CHANNELS_COUNT: 999,
  CHANNEL_SIZE: 64,  // CRITICAL: 64 bytes per channel, NOT 48!
  FREQ_DIVISOR: 10,  // Frequencies stored as Hz/10
  
  CHANNEL: {
    RX_FREQ:         { offset: 0,  size: 4, type: 'uint32' },  // ul32 rx_freq (Hz/10)
    FREQ_DIFF:       { offset: 4,  size: 4, type: 'uint32' },  // ul32 freq_diff (Hz/10) - alias TX_OFFSET
    TX_OFFSET:       { offset: 4,  size: 4, type: 'uint32' },  // Alias for compatibility
    TX_NON_STD_1:    { offset: 8,  size: 1, type: 'uint8' },   // u8 tx_non_standard_1
    TX_NON_STD_2:    { offset: 9,  size: 1, type: 'uint8' },   // u8 tx_non_standard_2
    RX_QT_TYPE:      { offset: 10, size: 1, type: 'uint8' },   // u8 rx_qt_type
    TX_QT_TYPE:      { offset: 11, size: 1, type: 'uint8' },   // u8 tx_qt_type
    FREQ_DIR:        { offset: 12, size: 1, type: 'uint8' },   // u8 freq_dir (0='', 1='+', 2='-')
    BAND:            { offset: 13, size: 1, type: 'uint8' },   // u8 band (lower nibble=BW, upper=MSW)
    STEP:            { offset: 14, size: 1, type: 'uint8' },   // u8 step
    ENCRYPT:         { offset: 15, size: 1, type: 'uint8' },   // u8 encrypt (0-10)
    POWER:           { offset: 16, size: 1, type: 'uint8' },   // u8 power (0=Low, 1=Mid, 2=High)
    BUSY:            { offset: 17, size: 1, type: 'uint8' },   // u8 busy
    REVERSE:         { offset: 18, size: 1, type: 'uint8' },   // u8 reverse
    DTMF_DECODE:     { offset: 19, size: 1, type: 'uint8' },   // u8 dtmf_decode_flag
    PTT_ID:          { offset: 20, size: 1, type: 'uint8' },   // u8 ptt_id
    MODE:            { offset: 21, size: 1, type: 'uint8' },   // u8 mode (0=FM, 1=AM, 2=LSB, 3=USB, 4=CW, 5=NFM)
    SCAN_LIST:       { offset: 22, size: 1, type: 'uint8' },   // u8 scan_list
    SQ:              { offset: 23, size: 1, type: 'uint8' },   // u8 sq (squelch)
    NAME:            { offset: 24, size: 16, type: 'string' }, // char name[16]
    RX_QT:           { offset: 40, size: 4, type: 'uint32' },  // ul32 rx_qt
    TX_QT:           { offset: 44, size: 4, type: 'uint32' },  // ul32 tx_qt
    UNKNOWN_1:       { offset: 48, size: 8, type: 'bytes' },   // u8 unknown[8]
    TX_QT2:          { offset: 56, size: 4, type: 'uint32' },  // ul32 tx_qt2
    SIGNAL:          { offset: 60, size: 1, type: 'uint8' },   // u8 signal (0=DTMF, 1=5TONE)
    UNKNOWN_2:       { offset: 61, size: 3, type: 'bytes' },   // u8 unknown_2[3]
  },
  
  // ==================== OPTIONS ====================
  OPTIONS: {
    POWER: ['Low (1W)', 'Mid (5W)', 'High (10W)'],
    MODES: ['FM', 'AM', 'LSB', 'USB', 'CW', 'NFM'],  // Note: 5=NFM
    DUPLEX: ['', '+', '-'],
    STEPS: [2.5, 5, 6.25, 10, 12.5, 20, 25, 50, 100],
    QT_TYPES: ['None', 'CTCSS', 'DCS-N', 'DCS-I'],
    PTT_ID: ['OFF', 'Start', 'End', 'Start & End'],
    SIGNAL: ['DTMF', '5TONE'],
    MSW: ['2K', '2.5K', '3K', '3.5K', '4K', '4.5K', '5K'],
    ENCRYPT: ['Off', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    SQUELCH: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  },
  
  // Valid frequency ranges (Hz)
  FREQ_RANGES: [
    { min: 150000, max: 1800000, band: 0 },      // 0.15 MHz – 1.8 MHz
    { min: 1800000, max: 18000000, band: 1 },    // 1.8 MHz – 18 MHz
    { min: 18000000, max: 32000000, band: 2 },   // 18 MHz – 32 MHz
    { min: 32000000, max: 76000000, band: 3 },   // 32 MHz – 76 MHz
    { min: 108000000, max: 136000000, band: 4 }, // 108 MHz – 136 MHz
    { min: 136000000, max: 174000000, band: 5 }, // 136 MHz – 174 MHz
    { min: 174000000, max: 350000000, band: 6 }, // 174 MHz – 350 MHz
    { min: 350000000, max: 400000000, band: 7 }, // 350 MHz – 400 MHz
    { min: 400000000, max: 470000000, band: 8 }, // 400 MHz – 470 MHz
    { min: 470000000, max: 580000000, band: 9 }, // 470 MHz – 580 MHz
    { min: 580000000, max: 760000000, band: 10 }, // 580 MHz – 760 MHz
    { min: 760000000, max: 1000000000, band: 11 }, // 760 MHz – 1000 MHz
    { min: 1000000000, max: 1160000000, band: 12 }, // 1000 MHz – 1160 MHz
  ],
  
  // ==================== TK11-SPECIFIC CHANNEL FIELDS ====================
  // These are the fields that should appear in the Channel Editor for TK11
  CHANNEL_FIELDS: [
    'number',     // Channel number
    'name',       // Name (16 chars)
    'rxFreq',     // RX Frequency
    'txFreq',     // TX Frequency
    'duplex',     // Duplex (+, -, '')
    'offset',     // Offset
    'power',      // Power (Low/Mid/High)
    'mode',       // Mode (FM/AM/LSB/USB/CW/NFM)
    'rxTone',     // RX CTCSS/DCS
    'txTone',     // TX CTCSS/DCS
    'squelch',    // Squelch level
    'busy',       // Busy lock
    'reverse',    // Reverse
    'scanlist',   // Scan list
    'encrypt',    // Encryption
    'pttid',      // PTT ID
    'signal',     // Signal type
  ],
  
  // Fields NOT supported by TK11 (should be hidden in UI)
  UNSUPPORTED_FIELDS: [
    'txLock',     // K5 only
    'dtmfDecode', // Different implementation
    'scrambler',  // Use 'encrypt' instead
  ],
  
  // ==================== UTILITY FUNCTIONS ====================
  
  readUint32LE(buffer, offset) {
    if (offset + 4 > buffer.length) return 0;
    return buffer[offset] | (buffer[offset+1] << 8) | (buffer[offset+2] << 16) | (buffer[offset+3] << 24);
  },
  
  writeUint32LE(buffer, offset, value) {
    if (offset + 4 > buffer.length) return;
    buffer[offset] = value & 0xFF;
    buffer[offset+1] = (value >> 8) & 0xFF;
    buffer[offset+2] = (value >> 16) & 0xFF;
    buffer[offset+3] = (value >> 24) & 0xFF;
  },
  
  readUint16LE(buffer, offset) {
    if (offset + 2 > buffer.length) return 0;
    return buffer[offset] | (buffer[offset+1] << 8);
  },
  
  writeUint16LE(buffer, offset, value) {
    if (offset + 2 > buffer.length) return;
    buffer[offset] = value & 0xFF;
    buffer[offset+1] = (value >> 8) & 0xFF;
  },
  
  // Read ASCII string from buffer
  readString(buffer, offset, length) {
    let str = '';
    for (let i = 0; i < length; i++) {
      const byte = buffer[offset + i];
      if (byte === 0 || byte === 0xFF) break;
      str += String.fromCharCode(byte);
    }
    return str.trim();
  },
  
  // Write ASCII string to buffer (padded with 0x00)
  writeString(buffer, offset, length, str) {
    const bytes = new Array(length).fill(0);
    for (let i = 0; i < Math.min(str.length, length); i++) {
      bytes[i] = str.charCodeAt(i) & 0x7F;
    }
    for (let i = 0; i < length; i++) {
      buffer[offset + i] = bytes[i];
    }
  },
  
  // Get band index from frequency (Hz)
  getBandFromFreq(freqHz) {
    for (const range of this.FREQ_RANGES) {
      if (freqHz >= range.min && freqHz < range.max) {
        return range.band;
      }
    }
    // Default to VHF band
    return 5;
  },
  
  // Validate frequency (Hz)
  isValidFreq(freqHz) {
    for (const range of this.FREQ_RANGES) {
      if (freqHz >= range.min && freqHz < range.max) {
        return true;
      }
    }
    return false;
  },
  
  // Get memory blocks needed for reading
  getRequiredBlocks() {
    return [
      { 
        start: this.ADDR.CHANNELS, 
        end: this.ADDR.CHANNELS + (this.CHANNELS_COUNT * this.CHANNEL_SIZE), 
        name: 'Channels' 
      },
      { 
        start: this.ADDR.CHANNELS_USAGE, 
        end: this.ADDR.CHANNELS_USAGE + this.CHANNELS_COUNT, 
        name: 'Channel Usage Flags' 
      },
    ];
  },
  
  // Calculate total bytes needed for channels
  getChannelDataSize() {
    return this.CHANNELS_COUNT * this.CHANNEL_SIZE;  // 999 × 64 = 63,936 bytes
  },
  
  // Calculate bytes needed for channel usage flags
  getChannelUsageSize() {
    return this.CHANNELS_COUNT;  // 999 bytes (1 byte per channel)
  },
  
  // Format channel for display in table
  formatChannelRow(ch) {
    return {
      num: ch.number,
      name: ch.name || '',
      rxFreq: ch.rxFreqHz ? (ch.rxFreqHz / 1000000).toFixed(5) : '',
      txFreq: ch.txFreqHz ? (ch.txFreqHz / 1000000).toFixed(5) : '',
      duplex: ch.duplex || '',
      offset: ch.offsetHz ? (ch.offsetHz / 1000000).toFixed(3) : '',
      power: ch.power || 'Low (1W)',
      mode: ch.mode || 'FM',
      rxTone: ch.rxToneType !== 'None' ? `${ch.rxToneType}:${ch.rxTone}` : '',
      txTone: ch.txToneType !== 'None' ? `${ch.txToneType}:${ch.txTone}` : '',
      squelch: ch.squelch ?? 4,
      busy: ch.busy ? 'Yes' : '',
      reverse: ch.reverse ? 'Yes' : '',
      scanlist: ch.scanlist ?? '',
      encrypt: ch.encrypt || 'Off',
      pttid: ch.pttid || 'OFF',
      signal: ch.signal || 'DTMF',
    };
  },
};

export default TK11_PROFILE;
