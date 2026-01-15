/**
 * IJV X3.60 Firmware Profile
 * Based on: IJV X3.60 Settings.py CHIRP driver
 * Memory starts at 0x0000
 */

export const IJV_PROFILE = {
    name: "IJV X3.60",
    id: "ijv",
    
    // Memory addresses - IJV uses different structure starting at 0x0000
    addresses: {
        settings1: 0x0000,   // Main settings block (0x60 bytes)
        logo: 0x0150,        // Logo/welcome message
        keys: 0x0198,        // Key assignments
        channels: 0x0200,    // Channel memory
        vfo: 0x0300,         // VFO settings
        micLevel: 0x1F80,    // Mic level calibration
        volumeGain: 0x1F8E,  // Volume gain
        battCal: 0x1F48      // Battery calibration
    },
    
    // Lists specific to IJV
    lists: {
        OFF_ON: ["OFF", "ON"],
        MIC_GAIN: ["+1.1dB", "+4.0dB", "+8.0dB", "+12.0dB", "+15.1dB"],
        BACKLIGHT: ["OFF", "5s", "10s", "15s", "20s", "1m", "2m", "ON"],
        BAT_SAVE: ["OFF", "1:1", "1:2", "1:3", "1:4"],
        SCAN_RESUME: ["TIME", "CARRIER", "SEARCH"],
        CH_DISPLAY: ["Frequency", "Channel Number", "Name", "Name+Freq"],
        POWER_ON_MSG: ["FULL", "MESSAGE", "VOLTAGE", "NONE"],
        ROGER: ["OFF", "ROGER", "MDC"],
        VOICE: ["OFF", "CHINESE", "ENGLISH"],
        ALARM_MODE: ["SITE", "TONE", "CODE"],
        TX_DEV: ["WIDE", "NARROW"],
        END_TALK: ["OFF", "ROGER", "MDC"],
        RTE: ["OFF", "100ms", "200ms", "300ms", "400ms", "500ms", "600ms", "700ms", "800ms", "900ms", "1000ms"],
        BANDS_TX: ["ALL", "AMATEUR", "137-174", "400-470"],
        BACK_TYPE: ["1600mAh", "2200mAh"],
        BL_MODE: ["OFF", "TX", "RX", "TX/RX"],
        BAT_TEXT: ["NONE", "VOLTAGE", "PERCENT"],
        SIGNAL_METER: ["CLASSIC", "TINY"]
    },
    
    // Field definitions with byte offsets from settings1 (0x0000)
    fields: {
        // Block 0x0000-0x001F
        call_channel:        { offset: 0x00, size: 2, type: "u16" },
        max_talk_time:       { offset: 0x02, size: 1, type: "u8" },
        tx_dev:              { offset: 0x03, size: 1, type: "u8", list: "TX_DEV" },
        key_lock:            { offset: 0x04, size: 1, type: "u8" },
        vox_switch:          { offset: 0x05, size: 1, type: "bool" },
        vox_level:           { offset: 0x06, size: 1, type: "u8" },
        mic_gain:            { offset: 0x07, size: 1, type: "u8", list: "MIC_GAIN" },
        beep_control:        { offset: 0x08, size: 1, type: "bool" },
        channel_display_mode:{ offset: 0x09, size: 1, type: "u8", list: "CH_DISPLAY" },
        battery_save:        { offset: 0x0B, size: 1, type: "u8", list: "BAT_SAVE" },
        afc:                 { offset: 0x0C, size: 1, type: "bool" },
        backlight_auto_mode: { offset: 0x0D, size: 1, type: "u8", list: "BACKLIGHT" },
        tail_note_elimination:{ offset: 0x0E, size: 1, type: "bool" },
        vfo_lock:            { offset: 0x0F, size: 1, type: "bool" },
        
        // Block 0x0010-0x001F
        flock:               { offset: 0x10, size: 1, type: "bool" },
        scan_resume_mode:    { offset: 0x11, size: 1, type: "u8", list: "SCAN_RESUME" },
        auto_keypad_lock:    { offset: 0x12, size: 1, type: "u8" },
        power_on_dispmode:   { offset: 0x13, size: 1, type: "u8", list: "POWER_ON_MSG" },
        vfomode:             { offset: 0x14, size: 1, type: "u8" },
        beacon:              { offset: 0x16, size: 1, type: "bool" },
        // Byte 0x17 is a bitfield
        bl_mode:             { offset: 0x17, size: 1, type: "bits", bits: "1-2", list: "BL_MODE" },
        micbar:              { offset: 0x17, size: 1, type: "bits", bits: "3", asBool: true },
        bat_text:            { offset: 0x17, size: 1, type: "bits", bits: "4", list: "BAT_TEXT" },
        tx_enable:           { offset: 0x17, size: 1, type: "bits", bits: "7" },
        
        // Byte 0x1F bitfield
        signal_meter:        { offset: 0x1F, size: 1, type: "bits", bits: "5", list: "SIGNAL_METER" },
        
        // Block 0x0020-0x002F
        alarm_mode:          { offset: 0x20, size: 1, type: "u8", list: "ALARM_MODE" },
        reminding_of_end_talk:{ offset: 0x21, size: 1, type: "u8", list: "END_TALK" },
        repeater_tail_elimination:{ offset: 0x22, size: 1, type: "u8", list: "RTE" },
        bands_tx:            { offset: 0x23, size: 1, type: "u8", list: "BANDS_TX" },
        back_type:           { offset: 0x24, size: 1, type: "u8", list: "BACK_TYPE" }
    },
    
    // Read settings from EEPROM data
    readSettings(data) {
        const settings = {};
        const view = new DataView(data.buffer);
        
        // Read all simple fields
        for (const [name, field] of Object.entries(this.fields)) {
            if (field.type === "u8") {
                settings[name] = data[field.offset];
            } else if (field.type === "u16") {
                settings[name] = view.getUint16(field.offset, true); // Little-endian
            } else if (field.type === "bool") {
                settings[name] = data[field.offset] !== 0;
            } else if (field.type === "bits") {
                const byte = data[field.offset];
                const bits = field.bits.split("-").map(Number);
                if (bits.length === 1) {
                    settings[name] = (byte >> bits[0]) & 0x01;
                } else {
                    const mask = (1 << (bits[1] - bits[0] + 1)) - 1;
                    settings[name] = (byte >> bits[0]) & mask;
                }
                if (field.asBool) {
                    settings[name] = settings[name] !== 0;
                }
            }
        }
        
        return settings;
    },
    
    // Write settings to EEPROM data
    writeSettings(data, settings) {
        const view = new DataView(data.buffer);
        
        for (const [name, field] of Object.entries(this.fields)) {
            if (settings[name] === undefined) continue;
            
            if (field.type === "u8") {
                data[field.offset] = settings[name] & 0xFF;
            } else if (field.type === "u16") {
                view.setUint16(field.offset, settings[name], true);
            } else if (field.type === "bool") {
                data[field.offset] = settings[name] ? 1 : 0;
            } else if (field.type === "bits") {
                const bits = field.bits.split("-").map(Number);
                let byte = data[field.offset];
                if (bits.length === 1) {
                    const mask = 1 << bits[0];
                    byte = (byte & ~mask) | ((settings[name] ? 1 : 0) << bits[0]);
                } else {
                    const mask = ((1 << (bits[1] - bits[0] + 1)) - 1) << bits[0];
                    byte = (byte & ~mask) | ((settings[name] & ((1 << (bits[1] - bits[0] + 1)) - 1)) << bits[0]);
                }
                data[field.offset] = byte;
            }
        }
        
        return data;
    },
    
    // Generate HTML for settings form - improved layout
    generateHTML() {
        return `
        <div class="settings-group">
            <h3>📺 Display Settings</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="ijv_channel_display_mode">Channel Display</label>
                    <select id="ijv_channel_display_mode"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_backlight_auto_mode">Backlight Time</label>
                    <select id="ijv_backlight_auto_mode"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_bl_mode">Backlight TX/RX</label>
                    <select id="ijv_bl_mode"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_bat_text">Battery Text</label>
                    <select id="ijv_bat_text"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_micbar">Mic Bar</label>
                    <select id="ijv_micbar"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_signal_meter">Signal Meter</label>
                    <select id="ijv_signal_meter"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>🔊 Audio Settings</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="ijv_mic_gain">Mic Gain</label>
                    <select id="ijv_mic_gain"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_beep_control">Beep</label>
                    <select id="ijv_beep_control"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_vox_switch">VOX</label>
                    <select id="ijv_vox_switch"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_vox_level">VOX Level (0-10)</label>
                    <input type="number" id="ijv_vox_level" min="0" max="10">
                </div>
                <div class="setting-row">
                    <label for="ijv_tail_note_elimination">Tail Elimination</label>
                    <select id="ijv_tail_note_elimination"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_repeater_tail_elimination">Repeater Tail Elim.</label>
                    <select id="ijv_repeater_tail_elimination"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>📡 TX Settings</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="ijv_max_talk_time">Max Talk Time</label>
                    <input type="number" id="ijv_max_talk_time" min="0" max="255">
                </div>
                <div class="setting-row">
                    <label for="ijv_tx_dev">TX Deviation</label>
                    <select id="ijv_tx_dev"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_bands_tx">TX Bands</label>
                    <select id="ijv_bands_tx"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_reminding_of_end_talk">End Talk Reminder</label>
                    <select id="ijv_reminding_of_end_talk"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>🔍 Scan & Save</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="ijv_scan_resume_mode">Scan Resume</label>
                    <select id="ijv_scan_resume_mode"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_battery_save">Battery Save</label>
                    <select id="ijv_battery_save"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_back_type">Battery Type</label>
                    <select id="ijv_back_type"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>⚙️ Other Settings</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="ijv_power_on_dispmode">Power On Display</label>
                    <select id="ijv_power_on_dispmode"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_alarm_mode">Alarm Mode</label>
                    <select id="ijv_alarm_mode"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_auto_keypad_lock">Auto Keypad Lock (s)</label>
                    <input type="number" id="ijv_auto_keypad_lock" min="0" max="255">
                </div>
                <div class="setting-row">
                    <label for="ijv_key_lock">Key Lock</label>
                    <select id="ijv_key_lock"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_flock">Frequency Lock</label>
                    <select id="ijv_flock"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_vfo_lock">VFO Lock</label>
                    <select id="ijv_vfo_lock"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_afc">AFC</label>
                    <select id="ijv_afc"></select>
                </div>
                <div class="setting-row">
                    <label for="ijv_beacon">Beacon</label>
                    <select id="ijv_beacon"></select>
                </div>
            </div>
        </div>
        `;
    },
    
    // Initialize dropdowns after HTML is inserted
    initDropdowns() {
        const fillSelect = (id, options) => {
            const select = document.getElementById(id);
            if (!select) return;
            select.innerHTML = options.map((v, i) => `<option value="${i}">${v}</option>`).join("");
        };
        
        fillSelect("ijv_mic_gain", this.lists.MIC_GAIN);
        fillSelect("ijv_backlight_auto_mode", this.lists.BACKLIGHT);
        fillSelect("ijv_battery_save", this.lists.BAT_SAVE);
        fillSelect("ijv_scan_resume_mode", this.lists.SCAN_RESUME);
        fillSelect("ijv_channel_display_mode", this.lists.CH_DISPLAY);
        fillSelect("ijv_power_on_dispmode", this.lists.POWER_ON_MSG);
        fillSelect("ijv_alarm_mode", this.lists.ALARM_MODE);
        fillSelect("ijv_tx_dev", this.lists.TX_DEV);
        fillSelect("ijv_reminding_of_end_talk", this.lists.END_TALK);
        fillSelect("ijv_repeater_tail_elimination", this.lists.RTE);
        fillSelect("ijv_bands_tx", this.lists.BANDS_TX);
        fillSelect("ijv_back_type", this.lists.BACK_TYPE);
        fillSelect("ijv_bl_mode", this.lists.BL_MODE);
        fillSelect("ijv_bat_text", this.lists.BAT_TEXT);
        fillSelect("ijv_signal_meter", this.lists.SIGNAL_METER);
        
        // ON/OFF selects (converted from checkboxes for better UX)
        fillSelect("ijv_micbar", this.lists.OFF_ON);
        fillSelect("ijv_beep_control", this.lists.OFF_ON);
        fillSelect("ijv_vox_switch", this.lists.OFF_ON);
        fillSelect("ijv_tail_note_elimination", this.lists.OFF_ON);
        fillSelect("ijv_key_lock", this.lists.OFF_ON);
        fillSelect("ijv_flock", this.lists.OFF_ON);
        fillSelect("ijv_vfo_lock", this.lists.OFF_ON);
        fillSelect("ijv_afc", this.lists.OFF_ON);
        fillSelect("ijv_beacon", this.lists.OFF_ON);
    },
    
    // Update form from settings object
    updateForm(settings) {
        for (const [name, value] of Object.entries(settings)) {
            const el = document.getElementById(`ijv_${name}`);
            if (!el) continue;
            
            if (el.type === "checkbox") {
                el.checked = !!value;
            } else if (el.tagName === "SELECT") {
                el.value = value;
            } else {
                el.value = value;
            }
        }
    },
    
    // Get settings from form
    getFormSettings() {
        const settings = {};
        
        for (const name of Object.keys(this.fields)) {
            const el = document.getElementById(`ijv_${name}`);
            if (!el) continue;
            
            if (el.type === "checkbox") {
                settings[name] = el.checked;
            } else if (el.tagName === "SELECT") {
                settings[name] = parseInt(el.value, 10);
            } else if (el.type === "number") {
                settings[name] = parseInt(el.value, 10) || 0;
            }
        }
        
        return settings;
    }
};
