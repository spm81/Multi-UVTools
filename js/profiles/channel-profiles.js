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
