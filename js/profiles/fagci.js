/**
 * Fagci R3b0rn Firmware Profile
 * Based on: k5-fagci-r3b0rn-nightly-n_241111-chirp-module.py
 * Memory starts at 0x0000 - completely different from stock/matoz/ijv profiles
 */

export const FAGCI_PROFILE = {
    name: "Fagci R3b0rn",
    id: "fagci",
    
    // Memory addresses - FAGCI uses its own unique address layout starting at 0x0000
    addresses: {
        settings: 0x0000,     // Main settings (21 bytes / 0x15)
        vfo: 0x0015,          // VFO settings (2 VFOs, 12 bytes each)
        presets: 0x002D,      // Presets (40 presets)
        channels: 0x052F      // Channels memory start
    },
    
    // Settings size constants
    SETTINGS_SIZE: 0x15,      // 21 bytes
    VFO_SIZE: 0x0C,           // 12 bytes per VFO
    PRESET_SIZE: 0x1E,        // 30 bytes per preset
    
    // Lists specific to Fagci R3b0rn firmware
    lists: {
        SQUELCH: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
        VOX: ["OFF", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
        SCRAMBLER: ["OFF", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
        MIC_GAIN: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
        BAT_SAVE: ["OFF", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
        BACKLIGHT: ["OFF", "5s", "10s", "20s", "1m", "2m", "4m", "8m", "ON", "9", "10", "11", "12", "13", "14", "15"],
        TX_TIME: ["OFF", "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "10m", "11m", "12m", "13m", "14m", "15m"],
        SCANLIST: ["1", "2", "3", "4", "5", "6", "7", "8"],
        CH_DISPLAY: ["Frequency", "Channel No", "Name", "Both"],
        SCAN_MODE: ["Time", "Carrier", "Search", "3"],
        ROGER: ["OFF", "Roger", "MDC", "Both"],
        BATTERY_STYLE: ["Percent", "Voltage", "Icon", "Hidden"],
        BATTERY_TYPE: ["1600mAh", "2200mAh", "3000mAh", "Custom"],
        SQL_TIMEOUT: ["OFF", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
        BL_ON_SQL: ["OFF", "RX", "TX", "Both"],
        ACTIVE_VFO: ["VFO A", "VFO B", "Both", "Mem"],
        APP_LIST: [
            "CH", "1 VFO pro", "Preset", "1 VFO", "2 VFO",
            "Analyzer", "ABOUT", "Spectrum", "Presets", "Messenger",
            "VFO config", "Preset config", "Settings", "1 VFO", "2 VFO"
        ],
        MODULATION: ["FM", "AM", "LSB", "USB", "BYP", "RAW", "WFM", "Preset"],
        POWER: ["ULow", "Low", "Mid", "High"],
        BANDWIDTH: ["Wide", "Narrow"],
        SQUELCH_TYPE: ["RSSI", "Noise", "RSSI+Noise"],
        RADIO: ["BK4819", "BK1080", "SI4732"]
    },
    
    // Generate step list
    generateStepList() {
        return [
            "0.01k", "0.05k", "0.1k", "0.25k", "0.5k", "1k", "1.25k", "2.5k",
            "5k", "6.25k", "8.33k", "10k", "12.5k", "15k", "20k", "25k",
            "30k", "50k", "100k", "125k", "200k", "250k", "500k"
        ];
    },
    
    // Parse settings from raw EEPROM data
    parseSettings(data) {
        const view = new DataView(data.buffer);
        const settings = {};
        
        // Byte 0: checkbyte (5 bits) | eepromType (3 bits)
        const byte0 = data[0];
        settings.checkbyte = byte0 & 0x1F;
        settings.eeprom_type = (byte0 >> 5) & 0x07;
        
        // Byte 1: scrambler (4 bits) | squelch (4 bits)
        const byte1 = data[1];
        settings.scrambler = byte1 & 0x0F;
        settings.squelch = (byte1 >> 4) & 0x0F;
        
        // Byte 2: vox (4 bits) | batsave (4 bits)
        const byte2 = data[2];
        settings.vox = byte2 & 0x0F;
        settings.battery_save = (byte2 >> 4) & 0x0F;
        
        // Byte 3: txTime (4 bits) | backlight (4 bits)
        const byte3 = data[3];
        settings.tx_time = byte3 & 0x0F;
        settings.backlight = (byte3 >> 4) & 0x0F;
        
        // Byte 4: currentScanlist (4 bits) | micGain (4 bits)
        const byte4 = data[4];
        settings.current_scanlist = byte4 & 0x0F;
        settings.mic_gain = (byte4 >> 4) & 0x0F;
        
        // Byte 5: chDisplayMode (2 bits) | scanmode (2 bits) | roger (2 bits) | reserved (2 bits)
        const byte5 = data[5];
        settings.ch_display_mode = byte5 & 0x03;
        settings.scan_mode = (byte5 >> 2) & 0x03;
        settings.roger = (byte5 >> 4) & 0x03;
        
        // Byte 6: flags
        const byte6 = data[6];
        settings.dtmf_decode = (byte6 & 0x01) !== 0;
        settings.repeater_ste = (byte6 & 0x02) !== 0;
        settings.ste = (byte6 & 0x04) !== 0;
        settings.busy_channel_lock = (byte6 & 0x08) !== 0;
        settings.keylock = (byte6 & 0x10) !== 0;
        settings.beep = (byte6 & 0x20) !== 0;
        settings.crossband = (byte6 & 0x40) !== 0;
        settings.dual_watch = (byte6 & 0x80) !== 0;
        
        // Byte 7: contrast (4 bits) | brightness (4 bits)
        const byte7 = data[7];
        settings.contrast = (byte7 & 0x0F) - 8; // -8 to +7
        settings.brightness = (byte7 >> 4) & 0x0F;
        
        // Byte 8: mainApp
        settings.main_app = data[8];
        
        // Byte 9: presetsCount
        settings.presets_count = data[9];
        
        // Byte 10: activePreset
        settings.active_preset = data[10];
        
        // Bytes 11-12: battery settings (16 bits)
        const byte11_12 = view.getUint16(11, true);
        settings.battery_style = byte11_12 & 0x03;
        settings.battery_type = (byte11_12 >> 2) & 0x03;
        settings.battery_calibration = (byte11_12 >> 4) & 0x0FFF;
        
        // Byte 13: sqClosedTimeout (4 bits) | sqOpenedTimeout (4 bits)
        const byte13 = data[13];
        settings.sq_closed_timeout = byte13 & 0x0F;
        settings.sq_opened_timeout = (byte13 >> 4) & 0x0F;
        
        // Byte 14: backlightOnSquelch (2 bits) | reserved (3 bits) | si4732PowerOff (1 bit) | noListen (1 bit) | bound_240_280 (1 bit)
        const byte14 = data[14];
        settings.backlight_on_squelch = byte14 & 0x03;
        settings.si4732_power_off = (byte14 & 0x20) !== 0;
        settings.no_listen = (byte14 & 0x40) !== 0;
        settings.bound_240_280 = (byte14 & 0x80) !== 0;
        
        // Byte 15: scanTimeout
        settings.scan_timeout = data[15];
        
        // Byte 16: activeVFO (2 bits) | skipGarbageFrequencies (1 bit) | sqlCloseTime (2 bits) | sqlOpenTime (3 bits)
        const byte16 = data[16];
        settings.active_vfo = byte16 & 0x03;
        settings.skip_garbage_frequencies = (byte16 & 0x04) !== 0;
        settings.sql_close_time = (byte16 >> 3) & 0x03;
        settings.sql_open_time = (byte16 >> 5) & 0x07;
        
        // Bytes 17-20: upconverter (27 bits from 32-bit value)
        if (data.length >= 21) {
            const upconverter = view.getUint32(17, true);
            settings.upconverter = upconverter & 0x07FFFFFF;
        }
        
        return settings;
    },
    
    // Read settings from EEPROM blocks
    readSettings(blocks) {
        if (blocks.settings) {
            return this.parseSettings(blocks.settings);
        }
        return {};
    },
    
    // Write settings to EEPROM blocks
    writeSettings(blocks, settings) {
        const data = blocks.settings;
        if (!data) return blocks;
        
        const view = new DataView(data.buffer);
        
        // Byte 0: checkbyte | eepromType
        data[0] = (settings.checkbyte & 0x1F) | ((settings.eeprom_type & 0x07) << 5);
        
        // Byte 1: scrambler | squelch
        data[1] = (settings.scrambler & 0x0F) | ((settings.squelch & 0x0F) << 4);
        
        // Byte 2: vox | batsave
        data[2] = (settings.vox & 0x0F) | ((settings.battery_save & 0x0F) << 4);
        
        // Byte 3: txTime | backlight
        data[3] = (settings.tx_time & 0x0F) | ((settings.backlight & 0x0F) << 4);
        
        // Byte 4: currentScanlist | micGain
        data[4] = (settings.current_scanlist & 0x0F) | ((settings.mic_gain & 0x0F) << 4);
        
        // Byte 5: chDisplayMode | scanmode | roger | reserved
        data[5] = (settings.ch_display_mode & 0x03) | 
                  ((settings.scan_mode & 0x03) << 2) | 
                  ((settings.roger & 0x03) << 4);
        
        // Byte 6: flags
        data[6] = (settings.dtmf_decode ? 0x01 : 0) |
                  (settings.repeater_ste ? 0x02 : 0) |
                  (settings.ste ? 0x04 : 0) |
                  (settings.busy_channel_lock ? 0x08 : 0) |
                  (settings.keylock ? 0x10 : 0) |
                  (settings.beep ? 0x20 : 0) |
                  (settings.crossband ? 0x40 : 0) |
                  (settings.dual_watch ? 0x80 : 0);
        
        // Byte 7: contrast | brightness
        data[7] = ((settings.contrast + 8) & 0x0F) | ((settings.brightness & 0x0F) << 4);
        
        // Byte 8: mainApp
        data[8] = settings.main_app & 0xFF;
        
        // Byte 9: presetsCount
        data[9] = settings.presets_count & 0xFF;
        
        // Byte 10: activePreset
        data[10] = settings.active_preset & 0xFF;
        
        // Bytes 11-12: battery settings
        const batteryValue = (settings.battery_style & 0x03) |
                            ((settings.battery_type & 0x03) << 2) |
                            ((settings.battery_calibration & 0x0FFF) << 4);
        view.setUint16(11, batteryValue, true);
        
        // Byte 13: sqClosedTimeout | sqOpenedTimeout
        data[13] = (settings.sq_closed_timeout & 0x0F) | ((settings.sq_opened_timeout & 0x0F) << 4);
        
        // Byte 14: backlightOnSquelch | flags
        data[14] = (settings.backlight_on_squelch & 0x03) |
                   (settings.si4732_power_off ? 0x20 : 0) |
                   (settings.no_listen ? 0x40 : 0) |
                   (settings.bound_240_280 ? 0x80 : 0);
        
        // Byte 15: scanTimeout
        data[15] = settings.scan_timeout & 0xFF;
        
        // Byte 16: activeVFO | skipGarbageFrequencies | sqlCloseTime | sqlOpenTime
        data[16] = (settings.active_vfo & 0x03) |
                   (settings.skip_garbage_frequencies ? 0x04 : 0) |
                   ((settings.sql_close_time & 0x03) << 3) |
                   ((settings.sql_open_time & 0x07) << 5);
        
        // Bytes 17-20: upconverter
        if (data.length >= 21) {
            view.setUint32(17, settings.upconverter & 0x07FFFFFF, true);
        }
        
        return blocks;
    },
    
    // Generate HTML for settings form
    generateHTML() {
        return `
        <div class="settings-group">
            <h3>Display & Battery</h3>
            <div class="settings-grid">
                <label for="fagci_ch_display_mode">Channel Display</label>
                <select id="fagci_ch_display_mode"></select>
                
                <label for="fagci_backlight">Backlight Time</label>
                <select id="fagci_backlight"></select>
                
                <label for="fagci_brightness">Brightness</label>
                <input type="range" id="fagci_brightness" min="0" max="15" value="8">
                
                <label for="fagci_contrast">Contrast</label>
                <input type="range" id="fagci_contrast" min="-8" max="7" value="0">
                
                <label for="fagci_battery_style">Battery Style</label>
                <select id="fagci_battery_style"></select>
                
                <label for="fagci_battery_type">Battery Type</label>
                <select id="fagci_battery_type"></select>
                
                <label for="fagci_battery_save">Battery Save</label>
                <select id="fagci_battery_save"></select>
                
                <label for="fagci_backlight_on_squelch">Backlight on SQL</label>
                <select id="fagci_backlight_on_squelch"></select>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>Audio</h3>
            <div class="settings-grid">
                <label for="fagci_squelch">Squelch</label>
                <select id="fagci_squelch"></select>
                
                <label for="fagci_mic_gain">Mic Gain</label>
                <select id="fagci_mic_gain"></select>
                
                <label for="fagci_vox">VOX Level</label>
                <select id="fagci_vox"></select>
                
                <label for="fagci_beep">Beep</label>
                <input type="checkbox" id="fagci_beep">
                
                <label for="fagci_ste">Squelch Tail Elim.</label>
                <input type="checkbox" id="fagci_ste">
                
                <label for="fagci_repeater_ste">Repeater STE</label>
                <input type="checkbox" id="fagci_repeater_ste">
                
                <label for="fagci_roger">Roger Beep</label>
                <select id="fagci_roger"></select>
                
                <label for="fagci_scrambler">Scrambler</label>
                <select id="fagci_scrambler"></select>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>TX/RX Settings</h3>
            <div class="settings-grid">
                <label for="fagci_tx_time">Max TX Time</label>
                <select id="fagci_tx_time"></select>
                
                <label for="fagci_crossband">Crossband</label>
                <input type="checkbox" id="fagci_crossband">
                
                <label for="fagci_dual_watch">Dual Watch</label>
                <input type="checkbox" id="fagci_dual_watch">
                
                <label for="fagci_busy_channel_lock">Busy Channel Lock</label>
                <input type="checkbox" id="fagci_busy_channel_lock">
                
                <label for="fagci_dtmf_decode">DTMF Decode</label>
                <input type="checkbox" id="fagci_dtmf_decode">
                
                <label for="fagci_active_vfo">Active VFO</label>
                <select id="fagci_active_vfo"></select>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>Scan</h3>
            <div class="settings-grid">
                <label for="fagci_scan_mode">Scan Mode</label>
                <select id="fagci_scan_mode"></select>
                
                <label for="fagci_current_scanlist">Current Scanlist</label>
                <select id="fagci_current_scanlist"></select>
                
                <label for="fagci_scan_timeout">Scan Timeout</label>
                <input type="number" id="fagci_scan_timeout" min="0" max="255">
                
                <label for="fagci_skip_garbage_frequencies">Skip Garbage Freqs</label>
                <input type="checkbox" id="fagci_skip_garbage_frequencies">
            </div>
        </div>
        
        <div class="settings-group">
            <h3>SQL Timing</h3>
            <div class="settings-grid">
                <label for="fagci_sq_closed_timeout">SQL Closed Timeout</label>
                <select id="fagci_sq_closed_timeout"></select>
                
                <label for="fagci_sq_opened_timeout">SQL Opened Timeout</label>
                <select id="fagci_sq_opened_timeout"></select>
                
                <label for="fagci_sql_close_time">SQL Close Time</label>
                <input type="number" id="fagci_sql_close_time" min="0" max="3">
                
                <label for="fagci_sql_open_time">SQL Open Time</label>
                <input type="number" id="fagci_sql_open_time" min="0" max="7">
            </div>
        </div>
        
        <div class="settings-group">
            <h3>Other</h3>
            <div class="settings-grid">
                <label for="fagci_main_app">Main App</label>
                <select id="fagci_main_app"></select>
                
                <label for="fagci_keylock">Key Lock</label>
                <input type="checkbox" id="fagci_keylock">
                
                <label for="fagci_no_listen">No Listen</label>
                <input type="checkbox" id="fagci_no_listen">
                
                <label for="fagci_si4732_power_off">SI4732 Power Off</label>
                <input type="checkbox" id="fagci_si4732_power_off">
                
                <label for="fagci_bound_240_280">Bound 240-280</label>
                <input type="checkbox" id="fagci_bound_240_280">
                
                <label for="fagci_upconverter">Upconverter (Hz)</label>
                <input type="number" id="fagci_upconverter" min="0" max="134000000">
            </div>
        </div>
        `;
    },
    
    // Initialize dropdowns
    initDropdowns() {
        const fillSelect = (id, options) => {
            const select = document.getElementById(id);
            if (!select) return;
            select.innerHTML = options.map((v, i) => `<option value="${i}">${v}</option>`).join("");
        };
        
        fillSelect("fagci_squelch", this.lists.SQUELCH);
        fillSelect("fagci_mic_gain", this.lists.MIC_GAIN);
        fillSelect("fagci_vox", this.lists.VOX);
        fillSelect("fagci_scrambler", this.lists.SCRAMBLER);
        fillSelect("fagci_battery_save", this.lists.BAT_SAVE);
        fillSelect("fagci_backlight", this.lists.BACKLIGHT);
        fillSelect("fagci_tx_time", this.lists.TX_TIME);
        fillSelect("fagci_current_scanlist", this.lists.SCANLIST);
        fillSelect("fagci_ch_display_mode", this.lists.CH_DISPLAY);
        fillSelect("fagci_scan_mode", this.lists.SCAN_MODE);
        fillSelect("fagci_roger", this.lists.ROGER);
        fillSelect("fagci_battery_style", this.lists.BATTERY_STYLE);
        fillSelect("fagci_battery_type", this.lists.BATTERY_TYPE);
        fillSelect("fagci_sq_closed_timeout", this.lists.SQL_TIMEOUT);
        fillSelect("fagci_sq_opened_timeout", this.lists.SQL_TIMEOUT);
        fillSelect("fagci_backlight_on_squelch", this.lists.BL_ON_SQL);
        fillSelect("fagci_active_vfo", this.lists.ACTIVE_VFO);
        fillSelect("fagci_main_app", this.lists.APP_LIST);
    },
    
    // Update form from settings
    updateForm(settings) {
        for (const [name, value] of Object.entries(settings)) {
            const el = document.getElementById(`fagci_${name}`);
            if (!el) continue;
            
            if (el.type === "checkbox") {
                el.checked = !!value;
            } else if (el.type === "range" || el.type === "number") {
                el.value = value;
            } else if (el.tagName === "SELECT" || el.tagName === "INPUT") {
                el.value = value;
            }
        }
    },
    
    // Get settings from form
    getFormSettings() {
        const settings = {};
        const fields = [
            "squelch", "mic_gain", "vox", "scrambler", "battery_save", "backlight",
            "tx_time", "current_scanlist", "ch_display_mode", "scan_mode", "roger",
            "battery_style", "battery_type", "sq_closed_timeout", "sq_opened_timeout",
            "backlight_on_squelch", "active_vfo", "main_app", "brightness", "contrast",
            "scan_timeout", "sql_close_time", "sql_open_time", "upconverter",
            // Checkboxes
            "beep", "ste", "repeater_ste", "dtmf_decode", "crossband", "dual_watch",
            "busy_channel_lock", "keylock", "no_listen", "si4732_power_off",
            "bound_240_280", "skip_garbage_frequencies"
        ];
        
        for (const name of fields) {
            const el = document.getElementById(`fagci_${name}`);
            if (!el) continue;
            
            if (el.type === "checkbox") {
                settings[name] = el.checked;
            } else if (el.type === "text") {
                settings[name] = el.value;
            } else {
                settings[name] = parseInt(el.value, 10) || 0;
            }
        }
        
        return settings;
    },
    
    // Get required EEPROM blocks for this profile
    getRequiredBlocks() {
        return {
            settings: { start: 0x0000, size: 0x15 }  // 21 bytes for settings
        };
    }
};
