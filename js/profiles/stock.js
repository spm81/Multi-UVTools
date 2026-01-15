/**
 * Stock UV-K5 Firmware Profile
 * Based on: uvk5.py CHIRP driver (Quansheng original firmware)
 * Memory at 0x0E70+
 */

export const STOCK_PROFILE = {
    name: "Stock UV-K5",
    id: "stock",
    
    // Memory addresses
    addresses: {
        settings_e70: 0x0E70,  // Main settings
        settings_e90: 0x0E90,  // Beep/scan
        settings_ea0: 0x0EA0,  // Keypad/language
        settings_ea8: 0x0EA8,  // Alarm/roger
        logo: 0x0EB0,          // Logo lines (32 bytes)
        settings_f40: 0x0F40   // TX locks
    },
    
    // Lists specific to Stock firmware
    lists: {
        OFF_ON: ["OFF", "ON"],
        CH_DISP: ["Frequency", "Channel No", "Channel Name"],
        BAT_SAVE: ["OFF", "1:1", "1:2", "1:3", "1:4"],
        CROSSBAND: ["Off", "Band A", "Band B"],
        SCAN_RESUME: ["TO: Resume after 5 seconds", "CO: Resume after signal disappears", "SE: Stop after signal"],
        WELCOME: ["Full Screen", "Welcome Info", "Voltage"],
        KEYPAD_TONE: ["Off", "Chinese", "English"],
        LANGUAGE: ["Chinese", "English"],
        ALARM_MODE: ["SITE", "TONE"],
        END_TALK: ["Off", "ROGER", "MDC"],
        RTE: ["Off", "100ms", "200ms", "300ms", "400ms", "500ms", "600ms", "700ms", "800ms", "900ms"],
        FLOCK: ["Off", "FCC", "CE", "GB", "430", "438"],
        SQUELCH: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        MIC_GAIN: ["0", "1", "2", "3", "4"],
        VOX: ["OFF", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
    },
    
    // Generate talk time list (0-15 minutes)
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
        settings.vox_level = e70[6];
        settings.mic_gain = e70[7];
        settings.channel_display_mode = e70[9];
        settings.crossband = e70[10];
        settings.battery_save = e70[11];
        settings.dual_watch = e70[12];
        settings.tail_note_elimination = e70[13];
        settings.vfo_open = e70[14];
        
        // Block 0x0E90 (16 bytes)
        const e90 = blocks.e90;
        settings.beep_control = e90[0];
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
        settings.en_350 = f40[5];
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
        e70[6] = settings.vox_level;
        e70[7] = settings.mic_gain;
        e70[9] = settings.channel_display_mode;
        e70[10] = settings.crossband;
        e70[11] = settings.battery_save;
        e70[12] = settings.dual_watch;
        e70[13] = settings.tail_note_elimination;
        e70[14] = settings.vfo_open;
        
        // Block 0x0E90
        const e90 = blocks.e90;
        e90[0] = settings.beep_control;
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
        f40[5] = settings.en_350;
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
    
    // Generate HTML for settings form - improved layout
    generateHTML() {
        return `
        <div class="settings-group">
            <h3>📺 Display Settings</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="stock_channel_display_mode">Channel Display</label>
                    <select id="stock_channel_display_mode"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_power_on_dispmode">Power On Display</label>
                    <select id="stock_power_on_dispmode"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_language">Language</label>
                    <select id="stock_language"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>🔊 Audio Settings</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="stock_mic_gain">Mic Gain</label>
                    <select id="stock_mic_gain"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_beep_control">Beep</label>
                    <select id="stock_beep_control"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_keypad_tone">Keypad Tone</label>
                    <select id="stock_keypad_tone"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_vox_level">VOX Level</label>
                    <select id="stock_vox_level"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_tail_note_elimination">Tail Elimination</label>
                    <select id="stock_tail_note_elimination"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_repeater_tail_elimination">Repeater Tail Elim.</label>
                    <select id="stock_repeater_tail_elimination"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_reminding_of_end_talk">End Talk Reminder</label>
                    <select id="stock_reminding_of_end_talk"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>📡 TX/RX Settings</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="stock_squelch">Squelch Level</label>
                    <select id="stock_squelch"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_max_talk_time">Max Talk Time</label>
                    <select id="stock_max_talk_time"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_crossband">Crossband</label>
                    <select id="stock_crossband"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_dual_watch">Dual Watch</label>
                    <select id="stock_dual_watch"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>🔍 Scan & Save</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="stock_scan_resume_mode">Scan Resume Mode</label>
                    <select id="stock_scan_resume_mode"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_battery_save">Battery Save</label>
                    <select id="stock_battery_save"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>⚙️ Other Settings</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="stock_alarm_mode">Alarm Mode</label>
                    <select id="stock_alarm_mode"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_auto_keypad_lock">Auto Keypad Lock</label>
                    <select id="stock_auto_keypad_lock"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_vfo_open">VFO Open</label>
                    <select id="stock_vfo_open"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_noaa_autoscan">NOAA Autoscan</label>
                    <select id="stock_noaa_autoscan"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>🔒 TX Locks</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="stock_flock">Frequency Lock</label>
                    <select id="stock_flock"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_tx_350">TX 350MHz</label>
                    <select id="stock_tx_350"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_tx_200">TX 200MHz</label>
                    <select id="stock_tx_200"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_tx_500">TX 500MHz</label>
                    <select id="stock_tx_500"></select>
                </div>
                <div class="setting-row">
                    <label for="stock_en_350">Enable 350MHz</label>
                    <select id="stock_en_350"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>💬 Welcome Message</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="stock_logo_line1">Line 1 (max 16 chars)</label>
                    <input type="text" id="stock_logo_line1" maxlength="16" placeholder="Enter line 1">
                </div>
                <div class="setting-row">
                    <label for="stock_logo_line2">Line 2 (max 16 chars)</label>
                    <input type="text" id="stock_logo_line2" maxlength="16" placeholder="Enter line 2">
                </div>
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
        
        fillSelect("stock_squelch", this.lists.SQUELCH);
        fillSelect("stock_mic_gain", this.lists.MIC_GAIN);
        fillSelect("stock_vox_level", this.lists.VOX);
        fillSelect("stock_channel_display_mode", this.lists.CH_DISP);
        fillSelect("stock_battery_save", this.lists.BAT_SAVE);
        fillSelect("stock_crossband", this.lists.CROSSBAND);
        fillSelect("stock_dual_watch", this.lists.CROSSBAND);
        fillSelect("stock_scan_resume_mode", this.lists.SCAN_RESUME);
        fillSelect("stock_power_on_dispmode", this.lists.WELCOME);
        fillSelect("stock_keypad_tone", this.lists.KEYPAD_TONE);
        fillSelect("stock_language", this.lists.LANGUAGE);
        fillSelect("stock_alarm_mode", this.lists.ALARM_MODE);
        fillSelect("stock_reminding_of_end_talk", this.lists.END_TALK);
        fillSelect("stock_repeater_tail_elimination", this.lists.RTE);
        fillSelect("stock_flock", this.lists.FLOCK);
        fillSelect("stock_max_talk_time", this.generateTalkTimeList());
        
        // ON/OFF selects (converted from checkboxes for better UX)
        fillSelect("stock_beep_control", this.lists.OFF_ON);
        fillSelect("stock_tail_note_elimination", this.lists.OFF_ON);
        fillSelect("stock_auto_keypad_lock", this.lists.OFF_ON);
        fillSelect("stock_vfo_open", this.lists.OFF_ON);
        fillSelect("stock_noaa_autoscan", this.lists.OFF_ON);
        fillSelect("stock_tx_350", this.lists.OFF_ON);
        fillSelect("stock_tx_200", this.lists.OFF_ON);
        fillSelect("stock_tx_500", this.lists.OFF_ON);
        fillSelect("stock_en_350", this.lists.OFF_ON);
    },
    
    // Update form from settings
    updateForm(settings) {
        for (const [name, value] of Object.entries(settings)) {
            const el = document.getElementById(`stock_${name}`);
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
            "vox_level", "mic_gain", "channel_display_mode", "crossband",
            "battery_save", "dual_watch", "tail_note_elimination", "vfo_open",
            "beep_control", "scan_resume_mode", "auto_keypad_lock", "power_on_dispmode",
            "keypad_tone", "language", "alarm_mode", "reminding_of_end_talk",
            "repeater_tail_elimination", "flock", "tx_350", "tx_200", "tx_500", "en_350",
            "logo_line1", "logo_line2"
        ];
        
        for (const name of fields) {
            const el = document.getElementById(`stock_${name}`);
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
