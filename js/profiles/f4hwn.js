/**
 * F4HWN Firmware Profile
 * Based on: f4hwn.chirp.v4.3.py CHIRP driver
 * Memory at 0x0E70+ with extended settings at 0x1FF0+
 */

export const F4HWN_PROFILE = {
    name: "F4HWN v4.3 [K5(v3) / K1]",
    id: "f4hwn",
    
    // Memory addresses
    addresses: {
        settings_e70: 0x0E70,  // Main settings
        settings_e80: 0x0E80,  // Screen/Channel
        settings_e90: 0x0E90,  // Keys/Beep
        settings_ea0: 0x0EA0,  // Voice/S-levels
        settings_ea8: 0x0EA8,  // Alarm/Roger
        logo: 0x0EB0,          // Logo lines (32 bytes)
        settings_f40: 0x0F40,  // Extended settings
        build_options: 0x1FF0, // Build options
        f4hwn_ext: 0x1FF2      // F4HWN extended settings
    },
    
    // Lists specific to F4HWN (same as Joaquim since it's a fork)
    lists: {
        OFF_ON: ["OFF", "ON"],
        MIC_GAIN: ["+1.1dB", "+4.0dB", "+8.0dB", "+12.0dB", "+15.1dB"],
        SET_LOW: ["< 20mW", "125mW", "250mW", "500mW", "1W", "2W", "5W"],
        SET_PTT: ["CLASSIC", "ONEPUSH"],
        SET_TOT_EOT: ["OFF", "SOUND", "VISUAL", "ALL"],
        SET_LCK: ["KEYS", "KEYS+PTT"],
        SET_MET: ["TINY", "CLASSIC"],
        SET_NFM: ["NARROW", "NARROWER"],
        RXMODE: ["MAIN ONLY", "DUAL RX RESPOND", "CROSS BAND", "MAIN TX DUAL RX"],
        BAT_TXT: ["NONE", "VOLTAGE", "PERCENT"],
        BAT_SAVE: ["OFF", "1:1", "1:2", "1:3", "1:4", "1:5"],
        CH_DISP: ["Frequency", "Channel Number", "Name", "Name+Freq"],
        WELCOME: ["ALL", "SOUND", "MESSAGE", "VOLTAGE", "NONE"],
        TX_VFO: ["A", "B"],
        ROGER: ["OFF", "ROGER", "MDC"],
        RTE: ["OFF", "100ms", "200ms", "300ms", "400ms", "500ms", "600ms", "700ms", "800ms", "900ms", "1000ms"],
        BAT_TYPE: ["1600mAh K5", "2200mAh K5", "3500mAh K5", "1400mAh K1", "2500mAh K1"],
        BL_TX_RX: ["OFF", "TX", "RX", "TX/RX"],
        SQUELCH: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        CONTRAST: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
        BL_MIN: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        BL_MAX: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
    },
    
    // Generate backlight time list
    generateBacklightList() {
        const list = ["OFF"];
        for (let s = 5; s <= 60; s += 5) list.push(`${s} sec`);
        for (let m = 1; m <= 5; m++) {
            list.push(`${m} min`);
            if (m < 5) for (let s = 5; s <= 55; s += 5) list.push(`${m} min : ${s} sec`);
        }
        list.push("Always On");
        return list;
    },
    
    // Generate talk time list
    generateTalkTimeList() {
        const list = [];
        for (let i = 0; i < 5; i++) list.push("N/U");
        for (let m = 0; m <= 15; m++) {
            for (let s = 0; s < 60; s += 5) {
                if (m === 0 && s < 30) continue;
                list.push(`${m}m:${String(s).padStart(2, "0")}s`);
            }
        }
        return list;
    },
    
    // Generate scan resume list
    generateScanResumeList() {
        const list = ["STOP"];
        for (let s = 0; s < 21; s++) {
            for (const ms of ["000ms", "250ms", "500ms", "750ms"]) {
                if (s === 0 && ms === "000ms") continue;
                if (s === 20 && ms !== "000ms") continue;
                list.push(`CARRIER ${String(s).padStart(2, "0")}s:${ms}`);
            }
        }
        for (let t = 5; t <= 120; t += 5) {
            const m = Math.floor(t / 60);
            const s = t % 60;
            list.push(`TIMEOUT ${String(m).padStart(2, "0")}m:${String(s).padStart(2, "0")}s`);
        }
        return list;
    },
    
    // Generate auto keypad lock list
    generateAutoKeypadList() {
        const list = ["OFF"];
        for (let m = 0; m <= 10; m++) {
            for (const s of ["00s", "15s", "30s", "45s"]) {
                if (m === 0 && s === "00s") continue;
                list.push(`${String(m).padStart(2, "0")}m:${s}`);
            }
        }
        return list;
    },
    
    // Generate OFF timer list
    // Generate OFF timer list with correct firmware values (1, 3, 5...)
    generateOffTimerList() {
        const list = [];
        let val = 1; // Starts at 1 (OFF)
        
        // Add OFF
        list.push({ value: val, text: "OFF" });
        val += 2;
        
        for (let h = 0; h < 2; h++) {
            for (let m = 1; m < 60; m++) {
                list.push({ value: val, text: `${h}h:${String(m).padStart(2, "0")}m` });
                val += 2;
            }
            if (h === 0) {
                list.push({ value: val, text: "1h:00m" });
                val += 2;
            }
        }
        list.push({ value: val, text: "2h:00m" });
        return list;
    },
    
    // Read settings from multiple EEPROM blocks
    readSettings(blocks) {
        const settings = {};
        
        // Block 0x0E70 (16 bytes)
        const e70 = blocks.e70;
        settings.call_channel = e70[0];
        settings.squelch = e70[1];
        settings.max_talk_time = e70[2];
        settings.key_lock = (e70[4] >> 0) & 0x01;
        settings.set_menu_lock = (e70[4] >> 1) & 0x01;
        settings.set_key = (e70[4] >> 2) & 0x0F;
        settings.mic_gain = e70[7];
        // Note: backlight_max is in lower nibble, backlight_min in upper nibble
        settings.backlight_max = e70[8] & 0x0F;
        settings.backlight_min = (e70[8] >> 4) & 0x0F;
        settings.channel_display_mode = e70[9];
        settings.crossband = e70[10];
        settings.battery_save = e70[11];
        settings.dual_watch = e70[12];
        settings.backlight_time = e70[13];
        settings.ste = e70[14] & 0x01;
        settings.set_nfm = (e70[14] >> 1) & 0x03;
        
        // Block 0x0E90 (16 bytes)
        const e90 = blocks.e90;
        settings.button_beep = e90[0] & 0x01;
        settings.keyM_longpress_action = (e90[0] >> 1) & 0x7F;
        settings.scan_resume_mode = e90[5];
        settings.auto_keypad_lock = e90[6];
        settings.power_on_dispmode = e90[7];
        
        // Block 0x0EA8 (8 bytes)
        const ea8 = blocks.ea8;
        settings.alarm_mode = ea8[0];
        settings.roger_beep = ea8[1];
        settings.rp_ste = ea8[2];
        settings.tx_vfo = ea8[3];
        settings.battery_type = ea8[4];
        
        // Block 0x0F40 (8 bytes)
        const f40 = blocks.f40;
        if (f40 && f40.length >= 8) {
            settings.bl_tx_rx = f40[7] & 0x03;
            settings.am_fix = (f40[7] >> 2) & 0x01;
            settings.mic_bar = (f40[7] >> 3) & 0x01;
            settings.bat_text = (f40[7] >> 4) & 0x03;
        }
        
        // Block 0x1FF2 (F4HWN extended - 8 bytes)
        const ff2 = blocks.ff2;
        if (ff2 && ff2.length >= 6) {
            settings.set_off_tmr = ff2[2] & 0x7F;
            settings.set_tmr = (ff2[2] >> 7) & 0x01;
            settings.set_gui = ff2[3] & 0x01;
            settings.set_met = (ff2[3] >> 1) & 0x01;
            settings.set_lck = (ff2[3] >> 2) & 0x01;
            settings.set_inv = (ff2[3] >> 3) & 0x01;
            settings.set_contrast = (ff2[3] >> 4) & 0x0F;
            settings.set_tot = ff2[4] & 0x0F;
            settings.set_eot = (ff2[4] >> 4) & 0x0F;
            settings.set_pwr = ff2[5] & 0x0F;
            settings.set_ptt = (ff2[5] >> 4) & 0x0F;
        }
        
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
        e70[4] = (e70[4] & 0xC0) | ((settings.set_key & 0x0F) << 2) | ((settings.set_menu_lock & 0x01) << 1) | (settings.key_lock & 0x01);
        e70[7] = settings.mic_gain;
        // Note: backlight_max is in lower nibble, backlight_min in upper nibble
        e70[8] = ((settings.backlight_min & 0x0F) << 4) | (settings.backlight_max & 0x0F);
        e70[9] = settings.channel_display_mode;
        e70[10] = settings.crossband;
        e70[11] = settings.battery_save;
        e70[12] = settings.dual_watch;
        e70[13] = settings.backlight_time;
        e70[14] = ((settings.set_nfm & 0x03) << 1) | (settings.ste & 0x01);
        
        // Block 0x0E90
        const e90 = blocks.e90;
        e90[0] = ((settings.keyM_longpress_action & 0x7F) << 1) | (settings.button_beep & 0x01);
        e90[5] = settings.scan_resume_mode;
        e90[6] = settings.auto_keypad_lock;
        e90[7] = settings.power_on_dispmode;
        
        // Block 0x0EA8
        const ea8 = blocks.ea8;
        ea8[0] = settings.alarm_mode;
        ea8[1] = settings.roger_beep;
        ea8[2] = settings.rp_ste;
        ea8[3] = settings.tx_vfo;
        ea8[4] = settings.battery_type;
        
        // Block 0x0F40
        const f40 = blocks.f40;
        if (f40 && f40.length >= 8) {
            f40[7] = (settings.bl_tx_rx & 0x03) | 
                     ((settings.am_fix & 0x01) << 2) |
                     ((settings.mic_bar & 0x01) << 3) |
                     ((settings.bat_text & 0x03) << 4);
        }
        
        // Block 0x1FF2 (F4HWN extended)
        const ff2 = blocks.ff2;
        if (ff2 && ff2.length >= 6) {
            ff2[2] = (settings.set_off_tmr & 0x7F) | ((settings.set_tmr & 0x01) << 7);
            ff2[3] = (settings.set_gui & 0x01) |
                     ((settings.set_met & 0x01) << 1) |
                     ((settings.set_lck & 0x01) << 2) |
                     ((settings.set_inv & 0x01) << 3) |
                     ((settings.set_contrast & 0x0F) << 4);
            ff2[4] = (settings.set_tot & 0x0F) | ((settings.set_eot & 0x0F) << 4);
            ff2[5] = (settings.set_pwr & 0x0F) | ((settings.set_ptt & 0x0F) << 4);
        }
        
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
                    <label for="f4hwn_channel_display_mode">Channel Display</label>
                    <select id="f4hwn_channel_display_mode"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_backlight_time">Backlight Time</label>
                    <select id="f4hwn_backlight_time"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_backlight_min">Backlight Min Level</label>
                    <select id="f4hwn_backlight_min"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_backlight_max">Backlight Max Level</label>
                    <select id="f4hwn_backlight_max"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_bl_tx_rx">Backlight TX/RX</label>
                    <select id="f4hwn_bl_tx_rx"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_bat_text">Battery Text</label>
                    <select id="f4hwn_bat_text"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_mic_bar">Mic Bar</label>
                    <select id="f4hwn_mic_bar"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_contrast">Contrast (SetCtr)</label>
                    <select id="f4hwn_set_contrast"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_inv">Invert Display (SetInv)</label>
                    <select id="f4hwn_set_inv"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_gui">GUI Style (SetGui)</label>
                    <select id="f4hwn_set_gui"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_met">Meter Style (SetMet)</label>
                    <select id="f4hwn_set_met"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>🔊 Audio Settings</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="f4hwn_mic_gain">Mic Gain</label>
                    <select id="f4hwn_mic_gain"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_button_beep">Button Beep</label>
                    <select id="f4hwn_button_beep"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_ste">Squelch Tail Elim.</label>
                    <select id="f4hwn_ste"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_rp_ste">Repeater Tail Elim.</label>
                    <select id="f4hwn_rp_ste"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_roger_beep">Roger Beep</label>
                    <select id="f4hwn_roger_beep"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>📡 TX/RX Settings</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="f4hwn_squelch">Squelch Level</label>
                    <select id="f4hwn_squelch"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_crossband">RX Mode</label>
                    <select id="f4hwn_crossband"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_max_talk_time">Max Talk Time</label>
                    <select id="f4hwn_max_talk_time"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_tx_vfo">TX VFO</label>
                    <select id="f4hwn_tx_vfo"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_pwr">Low Power Level (SetPwr)</label>
                    <select id="f4hwn_set_pwr"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_ptt">PTT Mode (SetPtt)</label>
                    <select id="f4hwn_set_ptt"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_nfm">Narrowband Mode (SetNfm)</label>
                    <select id="f4hwn_set_nfm"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_tot">TX Timeout Alert (SetTot)</label>
                    <select id="f4hwn_set_tot"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_eot">End TX Alert (SetEot)</label>
                    <select id="f4hwn_set_eot"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_am_fix">AM Fix</label>
                    <select id="f4hwn_am_fix"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>🔋 Power & Battery</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="f4hwn_battery_save">Battery Save</label>
                    <select id="f4hwn_battery_save"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_battery_type">Battery Type</label>
                    <select id="f4hwn_battery_type"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_off_tmr">Auto Power Off (SetOff)</label>
                    <select id="f4hwn_set_off_tmr"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_tmr">Show Timer (SetTmr)</label>
                    <select id="f4hwn_set_tmr"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>🔍 Scan & Lock</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="f4hwn_scan_resume_mode">Scan Resume Mode</label>
                    <select id="f4hwn_scan_resume_mode"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_auto_keypad_lock">Auto Keypad Lock</label>
                    <select id="f4hwn_auto_keypad_lock"></select>
                </div>
                <div class="setting-row">
                    <label for="f4hwn_set_lck">Lock Mode (SetLck)</label>
                    <select id="f4hwn_set_lck"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>⚙️ Other Settings</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="f4hwn_power_on_dispmode">Power On Display</label>
                    <select id="f4hwn_power_on_dispmode"></select>
                </div>
            </div>
        </div>
        
        <div class="settings-group">
            <h3>💬 Welcome Message</h3>
            <div class="settings-grid-2col">
                <div class="setting-row">
                    <label for="f4hwn_logo_line1">Line 1 (max 16 chars)</label>
                    <input type="text" id="f4hwn_logo_line1" maxlength="16" placeholder="Enter line 1">
                </div>
                <div class="setting-row">
                    <label for="f4hwn_logo_line2">Line 2 (max 16 chars)</label>
                    <input type="text" id="f4hwn_logo_line2" maxlength="16" placeholder="Enter line 2">
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
        
        fillSelect("f4hwn_mic_gain", this.lists.MIC_GAIN);
        fillSelect("f4hwn_squelch", this.lists.SQUELCH);
        fillSelect("f4hwn_channel_display_mode", this.lists.CH_DISP);
        fillSelect("f4hwn_crossband", this.lists.RXMODE);
        fillSelect("f4hwn_battery_save", this.lists.BAT_SAVE);
        fillSelect("f4hwn_power_on_dispmode", this.lists.WELCOME);
        fillSelect("f4hwn_roger_beep", this.lists.ROGER);
        fillSelect("f4hwn_rp_ste", this.lists.RTE);
        fillSelect("f4hwn_tx_vfo", this.lists.TX_VFO);
        fillSelect("f4hwn_battery_type", this.lists.BAT_TYPE);
        fillSelect("f4hwn_bl_tx_rx", this.lists.BL_TX_RX);
        fillSelect("f4hwn_bat_text", this.lists.BAT_TXT);
        fillSelect("f4hwn_backlight_min", this.lists.BL_MIN);
        fillSelect("f4hwn_backlight_max", this.lists.BL_MAX);
        fillSelect("f4hwn_set_contrast", this.lists.CONTRAST);
        fillSelect("f4hwn_set_pwr", this.lists.SET_LOW);
        fillSelect("f4hwn_set_ptt", this.lists.SET_PTT);
        fillSelect("f4hwn_set_tot", this.lists.SET_TOT_EOT);
        fillSelect("f4hwn_set_eot", this.lists.SET_TOT_EOT);
        fillSelect("f4hwn_set_lck", this.lists.SET_LCK);
        fillSelect("f4hwn_set_gui", this.lists.SET_MET);
        fillSelect("f4hwn_set_met", this.lists.SET_MET);
        fillSelect("f4hwn_set_nfm", this.lists.SET_NFM);
        
        // ON/OFF selects (converted from checkboxes for better UX)
        fillSelect("f4hwn_button_beep", this.lists.OFF_ON);
        fillSelect("f4hwn_ste", this.lists.OFF_ON);
        fillSelect("f4hwn_am_fix", this.lists.OFF_ON);
        fillSelect("f4hwn_mic_bar", this.lists.OFF_ON);
        fillSelect("f4hwn_set_inv", this.lists.OFF_ON);
        fillSelect("f4hwn_set_tmr", this.lists.OFF_ON);
        
        // Generated lists
        fillSelect("f4hwn_backlight_time", this.generateBacklightList());
        fillSelect("f4hwn_max_talk_time", this.generateTalkTimeList());
        fillSelect("f4hwn_scan_resume_mode", this.generateScanResumeList());
        fillSelect("f4hwn_auto_keypad_lock", this.generateAutoKeypadList());
        // Initialize set_off_tmr with correct firmware values (1, 3, 5...)
        const offTimerSelect = document.getElementById("f4hwn_set_off_tmr");
        if (offTimerSelect) {
            const data = this.generateOffTimerList();
            offTimerSelect.innerHTML = data.map(item => 
                `<option value="${item.value}">${item.text}</option>`
            ).join("");
        }
    },
    
    // Update form from settings
    updateForm(settings) {
        for (const [name, value] of Object.entries(settings)) {
            const el = document.getElementById(`f4hwn_${name}`);
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
            "call_channel", "squelch", "max_talk_time", "key_lock", "mic_gain",
            "backlight_min", "backlight_max", "channel_display_mode", "crossband",
            "battery_save", "dual_watch", "backlight_time", "ste", "set_nfm",
            "button_beep", "scan_resume_mode", "auto_keypad_lock", "power_on_dispmode",
            "roger_beep", "rp_ste", "tx_vfo", "battery_type",
            "bl_tx_rx", "am_fix", "mic_bar", "bat_text",
            "set_off_tmr", "set_tmr", "set_gui", "set_met", "set_lck", "set_inv",
            "set_contrast", "set_tot", "set_eot", "set_pwr", "set_ptt",
            "logo_line1", "logo_line2"
        ];
        
        for (const name of fields) {
            const el = document.getElementById(`f4hwn_${name}`);
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
