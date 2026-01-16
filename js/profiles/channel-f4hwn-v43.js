/**
 * F4HWN v4.3 Channel Profile
 * Based on: f4hwn.chirp.v4.3.py CHIRP driver
 * 
 * Channel memory layout: 16 bytes per channel
 * - freq (4 bytes): Frequency in 10 Hz units
 * - offset (4 bytes): TX offset in 10 Hz units
 * - rxcode (1 byte): RX tone code
 * - txcode (1 byte): TX tone code
 * - flags1 (1 byte): txcodeflag:4, rxcodeflag:4
 * - flags2 (1 byte): modulation:4, offsetDir:4
 * - flags3 (1 byte): __:1, txLock:1, busyChLockout:1, txpower:3, bandwidth:1, freq_reverse:1
 * - flags4 (1 byte): __:4, dtmf_pttid:3, dtmf_decode:1
 * - step (1 byte): Tuning step index
 * - scrambler (1 byte): Scrambler frequency index
 * 
 * Attributes (ch_attr): 1 byte per channel at 0x0D60
 * - is_scanlistx:3, compander:2, band:3
 */

export const F4HWN_V43_CHANNEL_PROFILE = {
    id: 'f4hwn_v43',
    name: 'F4HWN v4.3 (200 Channels)',
    
    // Memory layout
    channelCount: 200,         // 200 memory channels (214 total including VFO/specials)
    channelSize: 16,           // 16 bytes per channel
    nameSize: 16,              // 16 bytes per channel name
    attrSize: 1,               // 1 byte per channel attribute
    
    // Memory addresses
    addresses: {
        channels: 0x0000,      // Channel data: 214 * 16 = 3424 bytes (0x0D60)
        attributes: 0x0D60,    // Channel attributes: 207 bytes
        names: 0x0F50,         // Channel names: 200 * 16 = 3200 bytes
        fmFreq: 0x0E40         // FM broadcast frequencies: 20 * 2 = 40 bytes
    },
    
    // Channel structure offsets (within 16-byte block)
    offsets: {
        freq: 0,               // 4 bytes - ul32
        offset: 4,             // 4 bytes - ul32
        rxcode: 8,             // 1 byte
        txcode: 9,             // 1 byte
        flags1: 10,            // 1 byte (txcodeflag:4, rxcodeflag:4)
        flags2: 11,            // 1 byte (modulation:4, offsetDir:4)
        flags3: 12,            // 1 byte (misc flags + power + bandwidth)
        flags4: 13,            // 1 byte (dtmf flags)
        step: 14,              // 1 byte
        scrambler: 15          // 1 byte
    },
    
    // Lists from CHIRP driver
    lists: {
        // Power levels (3 bits, 0-7)
        POWER: [
            "USER (<20mW-5W)",     // 0b000
            "LOW 1 (<20mW)",       // 0b001
            "LOW 2 (125mW)",       // 0b010
            "LOW 3 (250mW)",       // 0b011
            "LOW 4 (500mW)",       // 0b100
            "LOW 5 (1W)",          // 0b101
            "MEDIUM (2W)",         // 0b110
            "HIGH (5W)"            // 0b111
        ],
        
        // Bandwidth (1 bit)
        BANDWIDTH: ["Wide (25kHz)", "Narrow (12.5kHz)"],
        
        // Modulation (4 bits, lower nibble)
        MODULATION: ["FM", "NFM", "AM", "NAM", "USB"],
        
        // Offset direction (4 bits, upper nibble of flags2)
        DUPLEX: ["", "+", "-", ""],  // 0=simplex, 1=+, 2=-, 3=off
        
        // Tone modes (4 bits each in flags1)
        TONE_MODE: ["", "Tone", "DTCS", "DTCS"],
        
        // Scrambler frequencies (8 bits)
        SCRAMBLER: [
            "OFF", "2600Hz", "2700Hz", "2800Hz", "2900Hz", "3000Hz",
            "3100Hz", "3200Hz", "3300Hz", "3400Hz", "3500Hz"
        ],
        
        // Compander (2 bits in attributes)
        COMPANDER: ["OFF", "TX", "RX", "TX/RX"],
        
        // Scanlist (3 bits in attributes)
        SCANLIST: [
            "None",
            "List [1]",
            "List [2]",
            "List [1, 2]",
            "List [3]",
            "List [1, 3]",
            "List [2, 3]",
            "All [1, 2, 3]"
        ],
        
        // PTT ID (3 bits)
        PTTID: ["OFF", "UP CODE", "DOWN CODE", "UP+DOWN CODE", "APOLLO QUINDAR"],
        
        // Steps in kHz (24 values)
        STEPS: [
            2.5, 5, 6.25, 10, 12.5, 25, 8.33, 0.01, 0.05, 0.1, 0.25, 0.5,
            1, 1.25, 9, 15, 20, 30, 50, 100, 125, 200, 250, 500
        ],
        
        // CTCSS Tones
        CTCSS: [
            67.0, 69.3, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5,
            94.8, 97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3,
            131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5, 167.9,
            171.3, 173.8, 177.3, 179.9, 183.5, 186.2, 189.9, 192.8, 196.6, 199.5,
            203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6, 241.8, 250.3, 254.1
        ],
        
        // DCS Codes
        DCS: [
            23, 25, 26, 31, 32, 36, 43, 47, 51, 53, 54, 65, 71, 72, 73, 74,
            114, 115, 116, 122, 125, 131, 132, 134, 143, 145, 152, 155, 156, 162,
            165, 172, 174, 205, 212, 223, 225, 226, 243, 244, 245, 246, 251, 252,
            255, 261, 263, 265, 266, 271, 274, 306, 311, 315, 325, 331, 332, 343,
            346, 351, 356, 364, 365, 371, 411, 412, 413, 423, 431, 432, 445, 446,
            452, 454, 455, 462, 464, 465, 466, 503, 506, 516, 523, 526, 532, 546,
            565, 606, 612, 624, 627, 631, 632, 654, 662, 664, 703, 712, 723, 731,
            732, 734, 743, 754
        ],
        
        // ON/OFF for boolean fields
        OFF_ON: ["OFF", "ON"]
    },
    
    // Table columns to display
    columns: [
        { id: 'index', label: '#', width: '40px', editable: false },
        { id: 'name', label: 'Name', width: '100px', editable: true, type: 'text', maxLength: 16 },
        { id: 'rxFreq', label: 'RX Freq', width: '100px', editable: true, type: 'frequency' },
        { id: 'duplex', label: 'Duplex', width: '60px', editable: true, type: 'select', list: 'DUPLEX' },
        { id: 'offset', label: 'Offset', width: '80px', editable: true, type: 'frequency' },
        { id: 'power', label: 'Power', width: '100px', editable: true, type: 'select', list: 'POWER' },
        { id: 'modulation', label: 'Mode', width: '60px', editable: true, type: 'select', list: 'MODULATION' },
        { id: 'bandwidth', label: 'BW', width: '80px', editable: true, type: 'select', list: 'BANDWIDTH' },
        { id: 'rxToneMode', label: 'RX Tone', width: '70px', editable: true, type: 'select', list: 'TONE_MODE' },
        { id: 'rxTone', label: 'RX Code', width: '70px', editable: true, type: 'tone' },
        { id: 'txToneMode', label: 'TX Tone', width: '70px', editable: true, type: 'select', list: 'TONE_MODE' },
        { id: 'txTone', label: 'TX Code', width: '70px', editable: true, type: 'tone' },
        { id: 'step', label: 'Step', width: '70px', editable: true, type: 'select', list: 'STEPS' },
        { id: 'scrambler', label: 'Scrambler', width: '80px', editable: true, type: 'select', list: 'SCRAMBLER' },
        { id: 'compander', label: 'Compander', width: '80px', editable: true, type: 'select', list: 'COMPANDER' },
        { id: 'reverse', label: 'Reverse', width: '60px', editable: true, type: 'select', list: 'OFF_ON' },
        { id: 'busyLock', label: 'Busy Lock', width: '70px', editable: true, type: 'select', list: 'OFF_ON' },
        { id: 'txLock', label: 'TX Lock', width: '60px', editable: true, type: 'select', list: 'OFF_ON' },
        { id: 'pttid', label: 'PTT ID', width: '90px', editable: true, type: 'select', list: 'PTTID' },
        { id: 'dtmfDecode', label: 'DTMF Dec', width: '70px', editable: true, type: 'select', list: 'OFF_ON' },
        { id: 'scanlist', label: 'Scanlist', width: '90px', editable: true, type: 'select', list: 'SCANLIST' }
    ],
    
    /**
     * Parse a single channel from EEPROM data
     * @param {Uint8Array} channelData - 16 bytes of channel data
     * @param {number} attrByte - 1 byte of attribute data
     * @param {string} name - Channel name (up to 16 chars)
     * @returns {Object} Parsed channel object
     */
    parseChannel(channelData, attrByte, name) {
        const view = new DataView(channelData.buffer, channelData.byteOffset, channelData.byteLength);
        
        // Read frequency (little-endian u32, in 10 Hz units)
        const freqRaw = view.getUint32(0, true);
        const offsetRaw = view.getUint32(4, true);
        
        // Check if channel is empty (freq = 0xFFFFFFFF or 0)
        if (freqRaw === 0xFFFFFFFF || freqRaw === 0) {
            return null; // Empty channel
        }
        
        const flags1 = channelData[10];  // txcodeflag:4, rxcodeflag:4
        const flags2 = channelData[11];  // modulation:4, offsetDir:4
        const flags3 = channelData[12];  // misc flags
        const flags4 = channelData[13];  // dtmf flags
        
        return {
            rxFreq: freqRaw / 100000,  // Convert to MHz
            offset: offsetRaw / 100000,
            rxcode: channelData[8],
            txcode: channelData[9],
            rxToneMode: (flags1 >> 4) & 0x0F,
            txToneMode: flags1 & 0x0F,
            modulation: flags2 & 0x0F,
            duplex: (flags2 >> 4) & 0x0F,
            reverse: flags3 & 0x01,
            bandwidth: (flags3 >> 1) & 0x01,
            power: (flags3 >> 2) & 0x07,
            busyLock: (flags3 >> 5) & 0x01,
            txLock: (flags3 >> 6) & 0x01,
            dtmfDecode: flags4 & 0x01,
            pttid: (flags4 >> 1) & 0x07,
            step: channelData[14],
            scrambler: channelData[15],
            // Attributes
            scanlist: attrByte & 0x07,
            compander: (attrByte >> 3) & 0x03,
            band: (attrByte >> 5) & 0x07,
            name: name.replace(/\x00/g, '').trim()
        };
    },
    
    /**
     * Encode a channel to EEPROM format
     * @param {Object} channel - Channel object
     * @returns {Object} { channelData: Uint8Array(16), attrByte: number, name: string }
     */
    encodeChannel(channel) {
        const data = new Uint8Array(16);
        const view = new DataView(data.buffer);
        
        // Frequency (little-endian u32, in 10 Hz units)
        view.setUint32(0, Math.round(channel.rxFreq * 100000), true);
        view.setUint32(4, Math.round(channel.offset * 100000), true);
        
        // Tone codes
        data[8] = channel.rxcode || 0;
        data[9] = channel.txcode || 0;
        
        // Flags1: txcodeflag:4, rxcodeflag:4
        data[10] = ((channel.rxToneMode & 0x0F) << 4) | (channel.txToneMode & 0x0F);
        
        // Flags2: modulation:4, offsetDir:4
        data[11] = ((channel.duplex & 0x0F) << 4) | (channel.modulation & 0x0F);
        
        // Flags3: __:1, txLock:1, busyChLockout:1, txpower:3, bandwidth:1, freq_reverse:1
        data[12] = (channel.reverse & 0x01) |
                   ((channel.bandwidth & 0x01) << 1) |
                   ((channel.power & 0x07) << 2) |
                   ((channel.busyLock & 0x01) << 5) |
                   ((channel.txLock & 0x01) << 6);
        
        // Flags4: __:4, dtmf_pttid:3, dtmf_decode:1
        data[13] = (channel.dtmfDecode & 0x01) | ((channel.pttid & 0x07) << 1);
        
        // Step and scrambler
        data[14] = channel.step || 0;
        data[15] = channel.scrambler || 0;
        
        // Attribute byte: is_scanlistx:3, compander:2, band:3
        const attrByte = (channel.scanlist & 0x07) |
                        ((channel.compander & 0x03) << 3) |
                        ((channel.band & 0x07) << 5);
        
        // Name (16 bytes, null-padded)
        const name = (channel.name || '').padEnd(16, '\x00').slice(0, 16);
        
        return { channelData: data, attrByte, name };
    },
    
    /**
     * Get tone value for display
     * @param {number} code - Tone code from EEPROM
     * @param {number} mode - Tone mode (0=none, 1=CTCSS, 2=DCS, 3=DCS-R)
     * @returns {string} Formatted tone value
     */
    getToneDisplay(code, mode) {
        if (mode === 0 || code === 0) return '';
        if (mode === 1) {
            // CTCSS
            return this.lists.CTCSS[code] ? `${this.lists.CTCSS[code]} Hz` : '';
        }
        if (mode === 2 || mode === 3) {
            // DCS
            const dcsCode = this.lists.DCS[code];
            if (!dcsCode) return '';
            return mode === 3 ? `D${dcsCode}I` : `D${dcsCode}N`;
        }
        return '';
    },
    
    /**
     * Get step value for display
     * @param {number} index - Step index
     * @returns {string} Formatted step value
     */
    getStepDisplay(index) {
        const step = this.lists.STEPS[index];
        if (step === undefined) return '';
        return step < 1 ? `${step * 1000} Hz` : `${step} kHz`;
    }
};
