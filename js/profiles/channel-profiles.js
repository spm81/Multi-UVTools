/**
 * Channel Profiles for K5/IJV radios
 * Defines memory structure and options for different firmware versions
 */

const CHANNEL_PROFILES = {
  // Default K5 profile - 200 channels
  'k5-default': {
    name: 'Default 200 Channels',
    description: 'Stock K5 firmware with 200 memory channels',
    channelCount: 200,
    channelSize: 16,
    channelStartAddress: 0x0000,
    nameLength: 10,
    structure: {
      // Byte layout for 16-byte channel
      name: { offset: 0, length: 10 },
      rxFreq: { offset: 10, length: 4, type: 'freq' },  // Actually split differently in K5
      // K5 has different structure - simplified here
    },
    options: {
      modulation: ['FM', 'AM', 'USB'],
      bandwidth: ['Wide', 'Narrow'],
      txPower: ['Low', 'Mid', 'High'],
      step: ['2.5 kHz', '5 kHz', '6.25 kHz', '10 kHz', '12.5 kHz', '25 kHz', '50 kHz', '100 kHz'],
      shift: ['', '+', '-'],
      compander: ['OFF', 'TX', 'RX', 'RX/TX'],
      pttId: ['OFF', 'BOT', 'EOT', 'Both'],
      scrambler: ['OFF'].concat(Array.from({length: 10}, (_, i) => `${i + 1}`))
    }
  },

  // F4HWN v4.3 firmware profile - 200 channels with full features
  'f4hwn-v43': {
    name: 'F4HWN v4.3',
    description: 'F4HWN v4.3 firmware (UV-K5v1/v3, UV-K1) with 200 channels and full features',
    channelCount: 200,
    channelSize: 16,
    channelStartAddress: 0x0000,
    attrStartAddress: 0x0D60,
    nameStartAddress: 0x0F50,
    nameLength: 16,
    structure: {
      // 16-byte channel structure based on f4hwn.chirp.v4.3.py
      freq: { offset: 0, length: 4, type: 'freq' },      // ul32 in 10 Hz units
      offset: { offset: 4, length: 4, type: 'freq' },    // ul32 in 10 Hz units
      rxcode: { offset: 8, length: 1 },
      txcode: { offset: 9, length: 1 },
      flags1: { offset: 10, length: 1, bits: {           // txcodeflag:4, rxcodeflag:4
        txToneMode: { pos: 0, size: 4 },
        rxToneMode: { pos: 4, size: 4 }
      }},
      flags2: { offset: 11, length: 1, bits: {           // modulation:4, offsetDir:4
        modulation: { pos: 0, size: 4 },
        duplex: { pos: 4, size: 4 }
      }},
      flags3: { offset: 12, length: 1, bits: {           // __:1, txLock:1, busyLock:1, power:3, bw:1, reverse:1
        reverse: { pos: 0, size: 1 },
        bandwidth: { pos: 1, size: 1 },
        power: { pos: 2, size: 3 },
        busyLock: { pos: 5, size: 1 },
        txLock: { pos: 6, size: 1 }
      }},
      flags4: { offset: 13, length: 1, bits: {           // __:4, pttid:3, dtmfDecode:1
        dtmfDecode: { pos: 0, size: 1 },
        pttid: { pos: 1, size: 3 }
      }},
      step: { offset: 14, length: 1 },
      scrambler: { offset: 15, length: 1 }
    },
    attrStructure: {
      // 1-byte attribute per channel at 0x0D60
      // is_scanlistx:3, compander:2, band:3
      scanlist: { pos: 0, size: 3 },
      compander: { pos: 3, size: 2 },
      band: { pos: 5, size: 3 }
    },
    options: {
      modulation: ['FM', 'NFM', 'AM', 'NAM', 'USB'],
      bandwidth: ['Wide (25kHz)', 'Narrow (12.5kHz)'],
      power: [
        'USER (<20mW-5W)',
        'LOW 1 (<20mW)',
        'LOW 2 (125mW)',
        'LOW 3 (250mW)',
        'LOW 4 (500mW)',
        'LOW 5 (1W)',
        'MEDIUM (2W)',
        'HIGH (5W)'
      ],
      duplex: ['', '+', '-', ''],
      toneMode: ['', 'Tone', 'DTCS', 'DTCS-R'],
      step: [
        '2.5 kHz', '5 kHz', '6.25 kHz', '10 kHz', '12.5 kHz', '25 kHz',
        '8.33 kHz', '10 Hz', '50 Hz', '100 Hz', '250 Hz', '500 Hz',
        '1 kHz', '1.25 kHz', '9 kHz', '15 kHz', '20 kHz', '30 kHz',
        '50 kHz', '100 kHz', '125 kHz', '200 kHz', '250 kHz', '500 kHz'
      ],
      scrambler: [
        'OFF', '2600Hz', '2700Hz', '2800Hz', '2900Hz', '3000Hz',
        '3100Hz', '3200Hz', '3300Hz', '3400Hz', '3500Hz'
      ],
      compander: ['OFF', 'TX', 'RX', 'TX/RX'],
      scanlist: [
        'None', 'List [1]', 'List [2]', 'List [1, 2]',
        'List [3]', 'List [1, 3]', 'List [2, 3]', 'All [1, 2, 3]'
      ],
      pttid: ['OFF', 'UP CODE', 'DOWN CODE', 'UP+DOWN CODE', 'APOLLO QUINDAR'],
      offOn: ['OFF', 'ON']
    },
    // CTCSS tones list
    ctcss: [
      67.0, 69.3, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5,
      94.8, 97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3,
      131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5, 167.9,
      171.3, 173.8, 177.3, 179.9, 183.5, 186.2, 189.9, 192.8, 196.6, 199.5,
      203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6, 241.8, 250.3, 254.1
    ],
    // DCS codes list
    dcs: [
      23, 25, 26, 31, 32, 36, 43, 47, 51, 53, 54, 65, 71, 72, 73, 74,
      114, 115, 116, 122, 125, 131, 132, 134, 143, 145, 152, 155, 156, 162,
      165, 172, 174, 205, 212, 223, 225, 226, 243, 244, 245, 246, 251, 252,
      255, 261, 263, 265, 266, 271, 274, 306, 311, 315, 325, 331, 332, 343,
      346, 351, 356, 364, 365, 371, 411, 412, 413, 423, 431, 432, 445, 446,
      452, 454, 455, 462, 464, 465, 466, 503, 506, 516, 523, 526, 532, 546,
      565, 606, 612, 624, 627, 631, 632, 654, 662, 664, 703, 712, 723, 731,
      732, 734, 743, 754
    ]
  },

  // IJV firmware profile - 999 channels
  'ijv-vx3xx': {
    name: 'IJV_vX3xx',
    description: 'IJV firmware with 999 memory channels and extended features',
    channelCount: 999,
    channelSize: 32,
    channelStartAddress: 0x2000,
    nameLength: 10,
    structure: {
      // 32-byte channel structure
      // Bytes 0-9: Name (10 chars)
      name: { offset: 0, length: 10 },
      // Bytes 10-14: Code selector (10 x 4-bit nibbles)
      codeSel: { offset: 10, length: 5 },
      // Byte 15: group:4, band:4
      groupBand: { offset: 15, length: 1 },
      // Bytes 16-19: RX Frequency (ul32)
      rxFreq: { offset: 16, length: 4, type: 'freq' },
      // Bytes 20-23: TX Offset (ul32)
      txOffset: { offset: 20, length: 4, type: 'freq' },
      // Byte 24: RX CTCSS/DCS code
      rxCode: { offset: 24, length: 1 },
      // Byte 25: TX CTCSS/DCS code
      txCode: { offset: 25, length: 1 },
      // Byte 26: tx_codetype:4, rx_codetype:4
      codeType: { offset: 26, length: 1 },
      // Byte 27: txlock:1, writeprot:1, enablescan:1, modulation:3, shift:2
      flags1: { offset: 27, length: 1, bits: {
        txlock: { pos: 7, size: 1 },
        writeprot: { pos: 6, size: 1 },
        enablescan: { pos: 5, size: 1 },
        modulation: { pos: 2, size: 3 },
        shift: { pos: 0, size: 2 }
      }},
      // Byte 28: busylock:1, txpower:2, bw:4, reverse:1
      flags2: { offset: 28, length: 1, bits: {
        busylock: { pos: 7, size: 1 },
        txpower: { pos: 5, size: 2 },
        bw: { pos: 1, size: 4 },
        reverse: { pos: 0, size: 1 }
      }},
      // Byte 29: libero:3, compander:2, agcmode:3
      flags3: { offset: 29, length: 1, bits: {
        libero: { pos: 5, size: 3 },
        compander: { pos: 3, size: 2 },
        agcmode: { pos: 0, size: 3 }
      }},
      // Byte 30: squelch:4, step:4
      squelchStep: { offset: 30, length: 1, bits: {
        squelch: { pos: 4, size: 4 },
        step: { pos: 0, size: 4 }
      }},
      // Byte 31: scrambler:1, ptt_id:4, digcode:3
      flags4: { offset: 31, length: 1, bits: {
        scrambler: { pos: 7, size: 1 },
        pttId: { pos: 3, size: 4 },
        digcode: { pos: 0, size: 3 }
      }}
    },
    options: {
      modulation: ['FM', 'AM', 'USB', 'CW', 'WFM'],
      bandwidth: [
        'W 26k', 'W 23k', 'W 20k', 'W 17k', 'W 14k',
        'W.12k', 'N 10k', 'N. 9k', 'U  7k', 'U  6k'
      ],
      txPower: ['Low', 'Mid', 'High'],
      step: [
        '10 Hz', '50 Hz', '100 Hz', '500 Hz', '1 kHz', '2.5 kHz',
        '5 kHz', '6.25 kHz', '8.33 kHz', '9 kHz', '10 kHz', '12.5 kHz',
        '20 kHz', '25 kHz', '50 kHz', '100 kHz'
      ],
      shift: ['', '-', '+', 'off'],
      compander: ['OFF', 'TX', 'RX', 'RX/TX'],
      agcMode: ['AUTO', 'MAN', 'FAST', 'NORM', 'SLOW'],
      squelch: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'NO RX'],
      pttId: [
        'OFF', 'CALL ID', 'SEL CALL', 'CODE BEGIN', 'CODE END',
        'CODE BEG+END', 'ROGER Single', 'ROGER 2Tones', 'MDC 1200', 'Apollo Quindar'
      ],
      scrambler: ['OFF'].concat(
        Array.from({length: 62}, (_, i) => `${1000 + i * 50}Hz`)
      ),
      digCode: ['OFF', 'DTMF', 'ZVEI1', 'ZVEI2', 'CCIR-1', 'CCIR-1F', 'USER'],
      band: ['1', '2', '3', '4', '5', '6', '7'],
      group: Array.from({length: 16}, (_, i) => `${i}`)
    }
  }
};

// Get current channel profile based on selection
function getChannelProfile(profileId) {
  return CHANNEL_PROFILES[profileId] || CHANNEL_PROFILES['k5-default'];
}

// Parse channel data according to profile structure
function parseChannelData(data, profile, channelIndex) {
  const channelOffset = profile.channelStartAddress + (channelIndex * profile.channelSize);
  const channelData = data.slice(channelOffset, channelOffset + profile.channelSize);
  
  if (!channelData || channelData.length < profile.channelSize) {
    return null;
  }
  
  const channel = {
    index: channelIndex + 1,
    name: '',
    rxFreq: 0,
    txOffset: 0,
    // ... other fields
  };
  
  // Parse name
  const nameBytes = channelData.slice(0, profile.nameLength);
  channel.name = String.fromCharCode(...nameBytes).replace(/\xff/g, '').replace(/\x00/g, '').trim();
  
  // Parse frequency based on profile
  if (profile.structure.rxFreq) {
    const freqOffset = profile.structure.rxFreq.offset;
    channel.rxFreq = (
      channelData[freqOffset] |
      (channelData[freqOffset + 1] << 8) |
      (channelData[freqOffset + 2] << 16) |
      (channelData[freqOffset + 3] << 24)
    ) / 100000; // Convert to MHz
  }
  
  return channel;
}

// Export for use in channels.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CHANNEL_PROFILES, getChannelProfile, parseChannelData };
}
