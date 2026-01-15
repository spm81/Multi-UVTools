/**
 * Matoz MCFW V0.34.0.C Firmware Profile
 * Based on: MCFW_V0.34.0.C_CHIRP_DRIVER_ModVer2.py
 * Memory at 0x0E70+ (similar to Stock with additional features)
 */

export const MATOZ_PROFILE = {
    name: "Matoz MCFW",
    id: "matoz",
    
    // Memory addresses
    addresses: {
        settings_e70: 0x0E70,  // Main settings
        settings_e90: 0x0E90,  // Keys/Beep
        settings_ea0: 0x0EA0,  // Keypad/language
        settings_ea8: 0x0EA8,  // Alarm/roger
        logo: 0x0EB0,          // Logo lines (32 bytes)
        dtmf: 0x0ED0,          // DTMF settings
        scanlist: 0x0F18,      // Scanlist settings
        settings_f40: 0x0F40   // TX locks
    },
    
    // Lists specific to Matoz firmware
    lists: {
        CH_DISP: ["Frequency", "Channel No", "Channel Name"],
        BAT_SAVE: ["OFF", "1:1", "1:2", "1:3", "1:4"],
        CROSSBAND: ["Off", "Band A", "Band B"],
        SCAN_RESUME: ["TIME", "CARRIER", "SEARCH"],
        WELCOME: ["Full Screen", "Welcome Info", "Voltage"],
        KEYPAD_TONE: ["Off", "Chinese", "English"],
        LANGUAGE: ["Chinese", "English"],
        ALARM_MODE: ["SITE", "TONE"],
        END_TALK: ["Off", "ROGER", "MDC"],
        RTE: ["Off", "100ms", "200ms", "300ms", "400ms", "500ms", "600ms", "700ms", "800ms", "900ms"],
        FLOCK: ["Off", "FCC", "CE", "GB", "430", "438"],
        SQUELCH: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        MIC_GAIN: ["0", "1", "2", "3", "4"],
        VOX: ["OFF", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        BACKLIGHT: ["OFF", "5s", "10s", "15s", "20s", "1m", "2m", "4m", "ON"],
        KEY_ACTION: [
            "None", "Flashlight", "Power", "Monitor", "Scan", "VOX",
            "Alarm", "FM Radio", "1750Hz", "Lock Keypad", "Switch VFO",
            "Switch Demodul", "Switch Bandwidth"
        ]
    },
    
    // Generate talk time list
    generateTalkTimeList() {
        const list = [];
        for (let m = 0; m <= 15; m++) {
            list.push(`${m} min`);
        }
        return list;
    },
    
    // Read settings from EEPROM blocks
    readSettings(blocks) {
        const settings = {};
        
        // Block 0x0E70 (16 bytes)
        const e70 = blocks.e70;
        settings.call_channel = e70[0];
        settings.squelch = e70[1];
        settings.max_talk_time = e70[2];
        settings.noaa_autoscan = e70[3];
        settings.key_lock = e70[4];
        settings.vox_switch = e70[5];
        settings.vox_level = e70[6];
        settings.mic_gain = e70[7];
        settings.channel_display_mode = e70[9];
        settings.crossband = e70[10];
        settings.battery_save = e70[11];
        settings.dual_watch = e70[12];
        settings.backlight_auto_mode = e70[13];
        settings.tail_note_elimination = e70[14];
        settings.vfo_open = e70[15];
        
        // Block 0x0E90 (16 bytes)
        const e90 = blocks.e90;
        settings.beep_control = e90[0];
        settings.key1_shortpress = e90[1];
        settings.key1_longpress = e90[2];
        settings.key2_shortpress = e90[3];
        settings.key2_longpress = e90[4];
        settings.scan_resume_mode = e90[5];
        settings.auto_keypad_lock = e90[6];
        settings.power_on_dispmode = e90[7];
        
        // Block 0x0EA0 (8 bytes)
        const ea0 = blocks.ea0;
        settings.keypad_tone = ea0[0];
        settings.language = ea0[1];
        
        // Block 0x0EA8 (8 bytes)
        const ea8 = blocks.ea8;
        settings.alarm_mode = ea8[0];
        settings.reminding_of_end_talk = ea8[1];
        settings.repeater_tail_elimination = ea8[2];
        
        // Block 0x0F40 (8 bytes)
        const f40 = blocks.f40;
        settings.flock = f40[0];
        settings.tx_350 = f40[1];
        settings.tx_200 = f40[3];
        settings.tx_500 = f40[4];
        settings.all_tx = f40[5];
        settings.screen = f40[6];
        
        // Logo (32 bytes)
        if (blocks.logo) {
            const decoder = new TextDecoder();
            settings.logo_line1 = decoder.decode(blocks.logo.slice(0, 16)).split("\x00")[0];
            settings.logo_line2 = decoder.decode(blocks.logo.slice(16, 32)).split("\x00")[0];
        }
        
        return settings;
    },
    
    // Write settings to EEPROM blocks
    writeSettings(blocks, settings) {
        // Block 0x0E70
        const e70 = blocks.e70;
        e70[0] = settings.call_channel;
        e70[1] = settings.squelch;
        e70[2] = settings.max_talk_time;
        e70[3] = settings.noaa_autoscan;
        e70[4] = settings.key_lock;
        e70[5] = settings.vox_switch;
        e70[6] = settings.vox_level;
        e70[7] = settings.mic_gain;
        e70[9] = settings.channel_display_mode;
        e70[10] = settings.crossband;
        e70[11] = settings.battery_save;
        e70[12] = settings.dual_watch;
        e70[13] = settings.backlight_auto_mode;
        e70[14] = settings.tail_note_elimination;
        e70[15] = settings.vfo_open;
        
        // Block 0x0E90
        const e90 = blocks.e90;
        e90[0] = settings.beep_control;
        e90[1] = settings.key1_shortpress;
        e90[2] = settings.key1_longpress;
        e90[3] = settings.key2_shortpress;
        e90[4] = settings.key2_longpress;
        e90[5] = settings.scan_resume_mode;
        e90[6] = settings.auto_keypad_lock;
        e90[7] = settings.power_on_dispmode;
        
        // Block 0x0EA0
        const ea0 = blocks.ea0;
        ea0[0] = settings.keypad_tone;
        ea0[1] = settings.language;
        
        // Block 0x0EA8
        const ea8 = blocks.ea8;
        ea8[0] = settings.alarm_mode;
        ea8[1] = settings.reminding_of_end_talk;
        ea8[2] = settings.repeater_tail_elimination;
        
        // Block 0x0F40
        const f40 = blocks.f40;
        f40[0] = settings.flock;
        f40[1] = settings.tx_350;
        f40[3] = settings.tx_200;
        f40[4] = settings.tx_500;
        f40[5] = settings.all_tx;
        f40[6] = settings.screen;
        
        // Logo
        if (blocks.logo && settings.logo_line1 !== undefined) {
            const encoder = new TextEncoder();
            const line1 = encoder.encode(settings.logo_line1.padEnd(16, "\x00").slice(0, 16));
            const line2 = encoder.encode(settings.logo_line2.padEnd(16, "\x00").slice(0, 16));
            blocks.logo.set(line1, 0);
            blocks.logo.set(line2, 16);
        }
        
        return blocks;
    },
    
    // Generate HTML for settings form
    generateHTML() {
        return `
        <div class="settings-group">
            <h3>Display</h3>
            <div class="settings-grid">
                <label for="matoz_channel_display_mode">Channel Display</label>
                <select id="matoz_channel_display_mode"></select>
                
                <label for="matoz_backlight_auto_mode">Backlight Time</label>
                <select id="matoz_backlight_auto_mode"></select>
                
                <label for="matoz_power_on_dispmode">Power On Display</label>
                <select id="matoz_power_on_dispmode"></select>
                
                <label for="matoz_language">Language</label>
                <select id="matoz_language"></select>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>Audio</h3>
            <div class="settings-grid">
                <label for="matoz_mic_gain">Mic Gain</label>
                <select id="matoz_mic_gain"></select>
                
                <label for="matoz_beep_control">Beep</label>
                <input type="checkbox" id="matoz_beep_control">
                
                <label for="matoz_keypad_tone">Keypad Tone</label>
                <select id="matoz_keypad_tone"></select>
                
                <label for="matoz_vox_switch">VOX</label>
                <input type="checkbox" id="matoz_vox_switch">
                
                <label for="matoz_vox_level">VOX Level</label>
                <select id="matoz_vox_level"></select>
                
                <label for="matoz_tail_note_elimination">Tail Elimination</label>
                <input type="checkbox" id="matoz_tail_note_elimination">
                
                <label for="matoz_repeater_tail_elimination">Repeater Tail Elim.</label>
                <select id="matoz_repeater_tail_elimination"></select>
                
                <label for="matoz_reminding_of_end_talk">End Talk Reminder</label>
                <select id="matoz_reminding_of_end_talk"></select>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>TX/RX Settings</h3>
            <div class="settings-grid">
                <label for="matoz_squelch">Squelch</label>
                <select id="matoz_squelch"></select>
                
                <label for="matoz_max_talk_time">Max Talk Time</label>
                <select id="matoz_max_talk_time"></select>
                
                <label for="matoz_crossband">Crossband</label>
                <select id="matoz_crossband"></select>
                
                <label for="matoz_dual_watch">Dual Watch</label>
                <select id="matoz_dual_watch"></select>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>Keys</h3>
            <div class="settings-grid">
                <label for="matoz_key1_shortpress">Key 1 Short</label>
                <select id="matoz_key1_shortpress"></select>
                
                <label for="matoz_key1_longpress">Key 1 Long</label>
                <select id="matoz_key1_longpress"></select>
                
                <label for="matoz_key2_shortpress">Key 2 Short</label>
                <select id="matoz_key2_shortpress"></select>
                
                <label for="matoz_key2_longpress">Key 2 Long</label>
                <select id="matoz_key2_longpress"></select>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>Scan & Save</h3>
            <div class="settings-grid">
                <label for="matoz_scan_resume_mode">Scan Resume</label>
                <select id="matoz_scan_resume_mode"></select>
                
                <label for="matoz_battery_save">Battery Save</label>
                <select id="matoz_battery_save"></select>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>Other</h3>
            <div class="settings-grid">
                <label for="matoz_alarm_mode">Alarm Mode</label>
                <select id="matoz_alarm_mode"></select>
                
                <label for="matoz_key_lock">Key Lock</label>
                <input type="checkbox" id="matoz_key_lock">
                
                <label for="matoz_auto_keypad_lock">Auto Keypad Lock</label>
                <input type="checkbox" id="matoz_auto_keypad_lock">
                
                <label for="matoz_vfo_open">VFO Open</label>
                <input type="checkbox" id="matoz_vfo_open">
                
                <label for="matoz_noaa_autoscan">NOAA Autoscan</label>
                <input type="checkbox" id="matoz_noaa_autoscan">
            </div>
        </div>
        
        <div class="settings-group">
            <h3>TX Locks</h3>
            <div class="settings-grid">
                <label for="matoz_flock">Frequency Lock</label>
                <select id="matoz_flock"></select>
                
                <label for="matoz_tx_350">TX 350MHz</label>
                <input type="checkbox" id="matoz_tx_350">
                
                <label for="matoz_tx_200">TX 200MHz</label>
                <input type="checkbox" id="matoz_tx_200">
                
                <label for="matoz_tx_500">TX 500MHz</label>
                <input type="checkbox" id="matoz_tx_500">
                
                <label for="matoz_all_tx">All TX</label>
                <input type="checkbox" id="matoz_all_tx">
            </div>
        </div>
        
        <div class="settings-group">
            <h3>Welcome Message</h3>
            <div class="settings-grid">
                <label for="matoz_logo_line1">Line 1</label>
                <input type="text" id="matoz_logo_line1" maxlength="16">
                
                <label for="matoz_logo_line2">Line 2</label>
                <input type="text" id="matoz_logo_line2" maxlength="16">
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
        
        fillSelect("matoz_squelch", this.lists.SQUELCH);
        fillSelect("matoz_mic_gain", this.lists.MIC_GAIN);
        fillSelect("matoz_vox_level", this.lists.VOX);
        fillSelect("matoz_channel_display_mode", this.lists.CH_DISP);
        fillSelect("matoz_backlight_auto_mode", this.lists.BACKLIGHT);
        fillSelect("matoz_battery_save", this.lists.BAT_SAVE);
        fillSelect("matoz_crossband", this.lists.CROSSBAND);
        fillSelect("matoz_dual_watch", this.lists.CROSSBAND);
        fillSelect("matoz_scan_resume_mode", this.lists.SCAN_RESUME);
        fillSelect("matoz_power_on_dispmode", this.lists.WELCOME);
        fillSelect("matoz_keypad_tone", this.lists.KEYPAD_TONE);
        fillSelect("matoz_language", this.lists.LANGUAGE);
        fillSelect("matoz_alarm_mode", this.lists.ALARM_MODE);
        fillSelect("matoz_reminding_of_end_talk", this.lists.END_TALK);
        fillSelect("matoz_repeater_tail_elimination", this.lists.RTE);
        fillSelect("matoz_flock", this.lists.FLOCK);
        fillSelect("matoz_max_talk_time", this.generateTalkTimeList());
        fillSelect("matoz_key1_shortpress", this.lists.KEY_ACTION);
        fillSelect("matoz_key1_longpress", this.lists.KEY_ACTION);
        fillSelect("matoz_key2_shortpress", this.lists.KEY_ACTION);
        fillSelect("matoz_key2_longpress", this.lists.KEY_ACTION);
    },
    
    // Update form from settings
    updateForm(settings) {
        for (const [name, value] of Object.entries(settings)) {
            const el = document.getElementById(`matoz_${name}`);
            if (!el) continue;
            
            if (el.type === "checkbox") {
                el.checked = !!value;
            } else if (el.tagName === "SELECT" || el.tagName === "INPUT") {
                el.value = value;
            }
        }
    },
    
    // Get settings from form
    getFormSettings() {
        const settings = {};
        const fields = [
            "call_channel", "squelch", "max_talk_time", "noaa_autoscan",
            "key_lock", "vox_switch", "vox_level", "mic_gain",
            "channel_display_mode", "crossband", "battery_save", "dual_watch",
            "backlight_auto_mode", "tail_note_elimination", "vfo_open",
            "beep_control", "key1_shortpress", "key1_longpress",
            "key2_shortpress", "key2_longpress", "scan_resume_mode",
            "auto_keypad_lock", "power_on_dispmode", "keypad_tone", "language",
            "alarm_mode", "reminding_of_end_talk", "repeater_tail_elimination",
            "flock", "tx_350", "tx_200", "tx_500", "all_tx",
            "logo_line1", "logo_line2"
        ];
        
        for (const name of fields) {
            const el = document.getElementById(`matoz_${name}`);
            if (!el) continue;
            
            if (el.type === "checkbox") {
                settings[name] = el.checked ? 1 : 0;
            } else if (el.type === "text") {
                settings[name] = el.value;
            } else {
                settings[name] = parseInt(el.value, 10) || 0;
            }
        }
        
        return settings;
    }
};
