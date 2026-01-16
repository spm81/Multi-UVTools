/**
 * F4HWN v4.3 Firmware Profile - COMPLETE
 * Based on: f4hwn.chirp.v4.3.py CHIRP driver
 * Memory layout matches CHIRP exactly
 * 
 * Memory Map:
 * 0x0000-0x0D60: Channels (214 channels, 16 bytes each)
 * 0x0D60-0x0E40: Channel attributes (compander, scanlist)
 * 0x0E40-0x0E70: FM frequencies
 * 0x0E70-0x0E80: Basic settings 1
 * 0x0E80-0x0E90: Screen/Channel settings
 * 0x0E90-0x0EA0: Keys/Beep settings
 * 0x0EA0-0x0EA8: Voice/S-levels
 * 0x0EA8-0x0EB0: Alarm/Roger/TX settings
 * 0x0EB0-0x0ED0: Logo lines (32 bytes)
 * 0x0ED0-0x0F18: DTMF settings
 * 0x0F18-0x0F20: Scanlist settings
 * 0x0F40-0x0F48: Extended settings
 * 0x0F50-0x1C00: Channel names (200 x 16 bytes)
 * 0x1C00-0x1E00: DTMF contacts (16 x 16 bytes)
 * 0x1E00-0x1FF0: Calibration data
 * 0x1FF0-0x1FF2: Build options
 * 0x1FF2-0x2000: F4HWN extended settings
 */

export const F4HWN_V43_PROFILE = {
    name: "F4HWN v4.3 [K5(v3) / K1]",
    id: "f4hwn_v43",
    
    // Memory addresses (from CHIRP driver)
    addresses: {
        channels: 0x0000,        // 214 channels, 16 bytes each
        ch_attr: 0x0D60,         // Channel attributes (compander, scanlist, band)
        fmfreq: 0x0E40,          // FM frequencies (20 x 2 bytes)
        settings_e70: 0x0E70,    // Basic settings 1 (16 bytes)
        settings_e80: 0x0E80,    // Screen/Channel settings (16 bytes)
        settings_e90: 0x0E90,    // Keys/Beep settings (16 bytes)
        settings_ea0: 0x0EA0,    // Voice/S-levels (8 bytes)
        settings_ea8: 0x0EA8,    // Alarm/Roger (8 bytes)
        logo: 0x0EB0,            // Logo lines (32 bytes)
        dtmf: 0x0ED0,            // DTMF settings
        scanlist: 0x0F18,        // Scanlist priority settings (8 bytes)
        settings_f40: 0x0F40,    // Extended settings (16 bytes)
        channelnames: 0x0F50,    // Channel names (200 x 16 bytes)
        dtmfcontact: 0x1C00,     // DTMF contacts (16 x 16 bytes)
        calibration: 0x1E00,     // Calibration data
        build_options: 0x1FF0,   // Build options (2 bytes)
        f4hwn_ext: 0x1FF2        // F4HWN extended settings (8 bytes)
    },
    
    // Lists from CHIRP driver f4hwn.chirp.v4.3.py (EXACT)
    lists: {
        OFF_ON: ["OFF", "ON"],
        
        // Mic gain
        MIC_GAIN: ["+1.1dB", "+4.0dB", "+8.0dB", "+12.0dB", "+15.1dB"],
        
        // Power levels
        SET_LOW: ["< 20mW", "125mW", "250mW", "500mW", "1W", "2W", "5W"],
        
        // PTT mode
        SET_PTT: ["CLASSIC", "ONEPUSH"],
        
        // TOT/EOT
        SET_TOT_EOT: ["OFF", "SOUND", "VISUAL", "ALL"],
        
        // Lock mode
        SET_LCK: ["KEYS", "KEYS+PTT"],
        
        // Meter style
        SET_MET: ["TINY", "CLASSIC"],
        
        // NFM deviation
        SET_NFM: ["NARROW", "NARROWER"],
        
        // Menu key behavior
        SET_KEY: ["MENU", "KEY_UP", "KEY_DOWN", "KEY_EXIT", "KEY_STAR"],
        
        // PTT ID
        PTTID: ["OFF", "UP CODE", "DOWN CODE", "UP+DOWN CODE", "APOLLO QUINDAR"],
        
        // Scrambler
        SCRAMBLER: ["OFF", "2600Hz", "2700Hz", "2800Hz", "2900Hz", "3000Hz",
                    "3100Hz", "3200Hz", "3300Hz", "3400Hz", "3500Hz"],
        
        // Compander
        COMPANDER: ["OFF", "TX", "RX", "TX/RX"],
        
        // RX Mode
        RXMODE: ["MAIN ONLY", "DUAL RX RESPOND", "CROSS BAND", "MAIN TX DUAL RX"],
        
        // Channel display
        CHANNELDISP: ["Frequency (FREQ)", "CHANNEL NUMBER", "NAME", "Name + Frequency (NAME + FREQ)"],
        
        // Battery save
        BATSAVE: ["OFF", "1:1", "1:2", "1:3", "1:4", "1:5"],
        
        // Battery type
        BATTYPE: ["1600 mAh K5", "2200 mAh K5", "3500 mAh K5", "1400 mAh K1", "2500 mAh K1"],
        
        // Battery text
        BAT_TXT: ["NONE", "VOLTAGE", "PERCENT"],
        
        // Backlight level
        BL_LVL: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        
        // Backlight TX/RX
        BL_TX_RX: ["OFF", "TX", "RX", "TX/RX"],
        
        // Frequency lock
        FLOCK: [
            "DEFAULT+ (137-174, 400-470)",
            "FCC HAM (144-148, 420-450)",
            "CA HAM (144-148, 430-450)",
            "CE HAM (144-146, 430-440)",
            "GB HAM (144-148, 430-440)",
            "137-174, 400-430",
            "137-174, 400-438",
            "PMR 446",
            "GMRS FRS MURS",
            "DISABLE ALL",
            "UNLOCK ALL"
        ],
        
        // Welcome mode
        WELCOME: [
            "Message line 1, Voltage, Sound (ALL)",
            "Make 2 short sounds (SOUND)",
            "User message line 1 and line 2 (MESSAGE)",
            "Battery voltage (VOLTAGE)",
            "NONE"
        ],
        
        // Voice
        VOICE: ["OFF", "Chinese", "English"],
        
        // TX VFO
        TX_VFO: ["A", "B"],
        
        // Alarm mode
        ALARMMODE: ["SITE", "TONE"],
        
        // Roger beep
        ROGER: ["OFF", "Roger beep (ROGER)", "MDC data burst (MDC)"],
        
        // Repeater tail elimination
        RTE: ["OFF", "100ms", "200ms", "300ms", "400ms",
              "500ms", "600ms", "700ms", "800ms", "900ms", "1000ms"],
        
        // VOX
        VOX: ["OFF", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        
        // Scanlist
        SCANLIST: ["None", "List [1]", "List [2]", "List [1, 2]", "List [3]",
                   "List [1, 3]", "List [2, 3]", "List [1, 2, 3]"],
        
        // Scanlist select
        SCANLIST_SELECT: [
            "LIST [0] NO LIST", "LIST [1]", "LIST [2]", "LIST [3]",
            "LISTS [1, 2, 3]", "All Channel (ALL)"
        ],
        
        // DTMF decode response
        DTMF_DECODE_RESPONSE: [
            "DO NOTHING",
            "Local ringing (RING)",
            "Replay response (REPLY)",
            "Local ringing + reply response (BOTH)"
        ],
        
        // Key actions
        KEYACTIONS: [
            "NONE",
            "FLASHLIGHT",
            "POWER",
            "MONITOR",
            "SCAN",
            "Voice detection (VOX)",
            "ALARM",
            "FM RADIO",
            "1750Hz TONE",
            "LOCK KEYPAD",
            "Main VFO (VFO A / VFO B)",
            "Frequency/memory mode (VFO / MEM)",
            "MODE",
            "Put the backlight OFF temporarily (BL_MIN_TMP_OFF)",
            "Change RxMode: *Main only,*Dual RX,*Cross Band,*TX Dual RX (RX MODE)",
            "MAIN ONLY",
            "Toggle CLASSIC to ONE PUSH ptt (PTT)",
            "WIDE / NARROW",
            "BACKLIGHT",
            "MUTE",
            "POWER HIGH",
            "REMOVE OFFSET"
        ]
    },
    
    // Generate backlight time list (from CHIRP)
    generateBacklightList() {
        const list = ["OFF"];
        for (let s = 5; s <= 55; s += 5) list.push(`${s} sec`);
        for (let m = 1; m <= 5; m++) {
            list.push(`${m} min`);
            if (m < 5) {
                for (let s = 5; s <= 55; s += 5) list.push(`${m} min : ${s} sec`);
            }
        }
        list.push("Always On (ON)");
        return list;
    },
    
    // Generate talk time list (from CHIRP)
    generateTalkTimeList() {
        const list = ["N/U", "N/U", "N/U", "N/U", "N/U"];
        for (let total = 30; total <= 900; total += 5) {
            const m = Math.floor(total / 60);
            const s = total % 60;
            if (m === 0) {
                list.push(`${s} sec`);
            } else if (s === 0) {
                list.push(`${m} min`);
            } else {
                list.push(`${m} min : ${s} sec`);
            }
        }
        return list;
    },
    
    // Generate scan resume list (from CHIRP)
    generateScanResumeList() {
        const list = ["STOP : Stop scan when a signal is received"];
        // Carrier based resume
        for (let s = 0; s <= 20; s++) {
            for (const ms of ["000ms", "250ms", "500ms", "750ms"]) {
                if (s === 0 && ms === "000ms") continue;
                if (s === 20 && ms !== "000ms") continue;
                list.push(`CARRIER ${String(s).padStart(2, "0")}s:${ms}`);
            }
        }
        // Timeout based resume
        for (let t = 5; t <= 120; t += 5) {
            const m = Math.floor(t / 60);
            const s = t % 60;
            list.push(`TIMEOUT ${String(m).padStart(2, "0")}m:${String(s).padStart(2, "0")}s`);
        }
        return list;
    },
    
    // Generate auto keypad lock list (from CHIRP)
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
    
    // Generate OFF timer list (from CHIRP)
    generateOffTimerList() {
        const list = ["OFF"];
        for (let h = 0; h < 2; h++) {
            for (let m = 1; m < 60; m++) {
                list.push(`${h}h:${String(m).padStart(2, "0")}m`);
            }
            if (h === 0) list.push("1h:00m");
        }
        list.push("2h:00m");
        return list;
    },
    
    // Read settings from EEPROM blocks
    // Memory map follows CHIRP driver exactly
    readSettings(blocks) {
        const settings = {};
        
        // ===== Block 0x0E70 (16 bytes) - Basic Settings 1 =====
        const e70 = blocks.e70;
        settings.call_channel = e70[0];
        settings.squelch = e70[1];
        settings.max_talk_time = e70[2];
        settings.noaa_autoscan = e70[3];
        settings.key_lock = (e70[4] >> 0) & 0x01;
        settings.set_menu_lock = (e70[4] >> 1) & 0x01;
        settings.set_key = (e70[4] >> 2) & 0x0F;
        settings.vox_switch = e70[5];
        settings.vox_level = e70[6];
        settings.mic_gain = e70[7];
        settings.backlight_max = e70[8] & 0x0F;
        settings.backlight_min = (e70[8] >> 4) & 0x0F;
        settings.channel_display_mode = e70[9];
        settings.crossband = e70[10];
        settings.battery_save = e70[11];
        settings.dual_watch = e70[12];
        settings.backlight_time = e70[13];
        settings.ste = (e70[14] >> 0) & 0x01;
        settings.set_nfm = (e70[14] >> 1) & 0x03;
        settings.freq_mode_allowed = e70[15];
        
        // ===== Block 0x0E80 (16 bytes) - Screen/Channel =====
        const e80 = blocks.e80;
        settings.screen_channel_a = e80[0];
        settings.mr_channel_a = e80[1];
        settings.freq_channel_a = e80[2];
        settings.screen_channel_b = e80[3];
        settings.mr_channel_b = e80[4];
        settings.freq_channel_b = e80[5];
        settings.noaa_channel_a = e80[6];
        settings.noaa_channel_b = e80[7];
        
        // ===== Block 0x0E90 (16 bytes) - Keys/Beep =====
        const e90 = blocks.e90;
        settings.button_beep = (e90[0] >> 0) & 0x01;
        settings.keyM_longpress_action = (e90[0] >> 1) & 0x7F;
        settings.key1_shortpress_action = e90[1];
        settings.key1_longpress_action = e90[2];
        settings.key2_shortpress_action = e90[3];
        settings.key2_longpress_action = e90[4];
        settings.scan_resume_mode = e90[5];
        settings.auto_keypad_lock = e90[6];
        settings.power_on_dispmode = e90[7];
        // Password is 4 bytes at e90[8-11]
        settings.password = (e90[8]) | (e90[9] << 8) | (e90[10] << 16) | (e90[11] << 24);
        
        // ===== Block 0x0EA0 (8 bytes) - Voice/S-levels =====
        const ea0 = blocks.ea0;
        settings.voice = ea0[0];
        settings.s0_level = ea0[1];
        settings.s9_level = ea0[2];
        
        // ===== Block 0x0EA8 (8 bytes) - Alarm/Roger/TX =====
        const ea8 = blocks.ea8;
        settings.alarm_mode = ea8[0];
        settings.roger_beep = ea8[1];
        settings.rp_ste = ea8[2];
        settings.tx_vfo = ea8[3];
        settings.battery_type = ea8[4];
        
        // ===== Block 0x0EB0 (32 bytes) - Logo =====
        const eb0 = blocks.eb0;
        settings.logo_line1 = this.readString(eb0, 0, 16);
        settings.logo_line2 = this.readString(eb0, 16, 16);
        
        // ===== Block 0x0ED0 - DTMF Settings =====
        if (blocks.ed0) {
            const dtmf = blocks.ed0;
            settings.dtmf_side_tone = dtmf[0];
            settings.dtmf_separate_code = String.fromCharCode(dtmf[1]);
            settings.dtmf_group_call_code = String.fromCharCode(dtmf[2]);
            settings.dtmf_decode_response = dtmf[3];
            settings.dtmf_auto_reset_time = dtmf[4];
            settings.dtmf_preload_time = dtmf[5];
            settings.dtmf_first_code_persist_time = dtmf[6];
            settings.dtmf_hash_persist_time = dtmf[7];
            settings.dtmf_code_persist_time = dtmf[8];
            settings.dtmf_code_interval_time = dtmf[9];
            settings.dtmf_permit_remote_kill = dtmf[10];
        }
        
        // ===== Block 0x0EE0 - DTMF Codes =====
        if (blocks.ee0) {
            const dtmf_codes = blocks.ee0;
            settings.dtmf_local_code = this.readString(dtmf_codes, 0, 3);
            settings.dtmf_kill_code = this.readString(dtmf_codes, 8, 5);
            settings.dtmf_revive_code = this.readString(dtmf_codes, 16, 5);
            settings.dtmf_up_code = this.readString(dtmf_codes, 24, 16);
            settings.dtmf_down_code = this.readString(dtmf_codes, 40, 16);
        }
        
        // ===== Block 0x0F18 (8 bytes) - Scanlist Priority =====
        if (blocks.f18) {
            const scanlist = blocks.f18;
            settings.scanlist_default = scanlist[0];
            settings.sl1_prior_enable = (scanlist[1] >> 0) & 0x01;
            settings.sl2_prior_enable = (scanlist[1] >> 1) & 0x01;
            settings.sl3_prior_enable = (scanlist[1] >> 2) & 0x01;
            settings.sl1_prior_ch1 = scanlist[2];
            settings.sl1_prior_ch2 = scanlist[3];
            settings.sl2_prior_ch1 = scanlist[4];
            settings.sl2_prior_ch2 = scanlist[5];
            settings.sl3_prior_ch1 = scanlist[6];
            settings.sl3_prior_ch2 = scanlist[7];
        }
        
        // ===== Block 0x0F40 (16 bytes) - Extended Settings =====
        const f40 = blocks.f40;
        settings.int_flock = f40[0];
        settings.int_350tx = f40[1];  // unused but read
        settings.int_KILLED = f40[2];
        settings.int_200tx = f40[3];  // unused but read
        settings.int_500tx = f40[4];  // unused but read
        settings.int_350en = f40[5];
        settings.int_scren = f40[6];
        // Byte 7 has multiple settings packed
        settings.bl_tx_rx = (f40[7] >> 0) & 0x03;
        settings.am_fix = (f40[7] >> 2) & 0x01;
        settings.mic_bar = (f40[7] >> 3) & 0x01;
        settings.bat_text = (f40[7] >> 4) & 0x03;
        settings.live_dtmf_decoder = (f40[7] >> 6) & 0x01;
        
        // ===== Block 0x1FF0 (2 bytes) - Build Options =====
        if (blocks.ff0) {
            const build = blocks.ff0;
            settings.build_enable_fmradio = (build[0] >> 0) & 0x01;
            settings.build_enable_noaa = (build[0] >> 1) & 0x01;
            settings.build_enable_voice = (build[0] >> 2) & 0x01;
            settings.build_enable_vox = (build[0] >> 3) & 0x01;
            settings.build_enable_alarm = (build[0] >> 4) & 0x01;
            settings.build_enable_tx1750 = (build[0] >> 5) & 0x01;
            settings.build_enable_pwron_password = (build[0] >> 6) & 0x01;
            settings.build_enable_dtmf_calling = (build[0] >> 7) & 0x01;
            
            settings.build_enable_flashlight = (build[1] >> 0) & 0x01;
            settings.build_enable_wide_rx = (build[1] >> 1) & 0x01;
            settings.build_enable_raw_demodulators = (build[1] >> 2) & 0x01;
            settings.build_enable_game = (build[1] >> 3) & 0x01;
            settings.build_enable_am_fix = (build[1] >> 4) & 0x01;
            settings.build_enable_bandscope = (build[1] >> 5) & 0x01;
            settings.build_enable_rescue_ops = (build[1] >> 6) & 0x01;
        }
        
        // ===== Block 0x1FF2 (8 bytes) - F4HWN Extended Settings =====
        if (blocks.ff2) {
            const ext = blocks.ff2;
            // Bytes 0-1 reserved
            // Byte 2-3 contain timer settings
            settings.set_off_tmr = (ext[2] >> 1) & 0x7F;
            settings.set_tmr = (ext[2] >> 0) & 0x01;
            // Byte 3 contains GUI/display settings
            settings.set_gui = (ext[3] >> 0) & 0x01;
            settings.set_met = (ext[3] >> 1) & 0x01;
            settings.set_lck = (ext[3] >> 2) & 0x01;
            settings.set_inv = (ext[3] >> 3) & 0x01;
            settings.set_contrast = (ext[3] >> 4) & 0x0F;
            // Byte 4 contains more settings
            settings.set_eot = (ext[4] >> 0) & 0x03;
            settings.set_tot = (ext[4] >> 2) & 0x03;
            settings.set_pwr = (ext[4] >> 4) & 0x07;
            settings.set_ptt = (ext[4] >> 7) & 0x01;
        }
        
        return settings;
    },
    
    // Write settings to EEPROM blocks
    writeSettings(settings, blocks) {
        // ===== Block 0x0E70 =====
        const e70 = new Uint8Array(blocks.e70);
        e70[0] = settings.call_channel ?? e70[0];
        e70[1] = settings.squelch ?? e70[1];
        e70[2] = settings.max_talk_time ?? e70[2];
        e70[3] = settings.noaa_autoscan ?? e70[3];
        e70[4] = ((settings.set_key ?? 0) << 2) |
                 ((settings.set_menu_lock ?? 0) << 1) |
                 (settings.key_lock ?? 0);
        e70[5] = settings.vox_switch ?? e70[5];
        e70[6] = settings.vox_level ?? e70[6];
        e70[7] = settings.mic_gain ?? e70[7];
        e70[8] = ((settings.backlight_min ?? 0) << 4) | (settings.backlight_max ?? 0);
        e70[9] = settings.channel_display_mode ?? e70[9];
        e70[10] = settings.crossband ?? e70[10];
        e70[11] = settings.battery_save ?? e70[11];
        e70[12] = settings.dual_watch ?? e70[12];
        e70[13] = settings.backlight_time ?? e70[13];
        e70[14] = ((settings.set_nfm ?? 0) << 1) | (settings.ste ?? 0);
        e70[15] = settings.freq_mode_allowed ?? e70[15];
        blocks.e70 = e70;
        
        // ===== Block 0x0E90 =====
        const e90 = new Uint8Array(blocks.e90);
        e90[0] = ((settings.keyM_longpress_action ?? 0) << 1) | (settings.button_beep ?? 0);
        e90[1] = settings.key1_shortpress_action ?? e90[1];
        e90[2] = settings.key1_longpress_action ?? e90[2];
        e90[3] = settings.key2_shortpress_action ?? e90[3];
        e90[4] = settings.key2_longpress_action ?? e90[4];
        e90[5] = settings.scan_resume_mode ?? e90[5];
        e90[6] = settings.auto_keypad_lock ?? e90[6];
        e90[7] = settings.power_on_dispmode ?? e90[7];
        if (settings.password !== undefined) {
            e90[8] = settings.password & 0xFF;
            e90[9] = (settings.password >> 8) & 0xFF;
            e90[10] = (settings.password >> 16) & 0xFF;
            e90[11] = (settings.password >> 24) & 0xFF;
        }
        blocks.e90 = e90;
        
        // ===== Block 0x0EA0 =====
        const ea0 = new Uint8Array(blocks.ea0);
        ea0[0] = settings.voice ?? ea0[0];
        ea0[1] = settings.s0_level ?? ea0[1];
        ea0[2] = settings.s9_level ?? ea0[2];
        blocks.ea0 = ea0;
        
        // ===== Block 0x0EA8 =====
        const ea8 = new Uint8Array(blocks.ea8);
        ea8[0] = settings.alarm_mode ?? ea8[0];
        ea8[1] = settings.roger_beep ?? ea8[1];
        ea8[2] = settings.rp_ste ?? ea8[2];
        ea8[3] = settings.tx_vfo ?? ea8[3];
        ea8[4] = settings.battery_type ?? ea8[4];
        blocks.ea8 = ea8;
        
        // ===== Block 0x0EB0 - Logo =====
        const eb0 = new Uint8Array(blocks.eb0);
        if (settings.logo_line1 !== undefined) {
            this.writeString(eb0, 0, settings.logo_line1, 16);
        }
        if (settings.logo_line2 !== undefined) {
            this.writeString(eb0, 16, settings.logo_line2, 16);
        }
        blocks.eb0 = eb0;
        
        // ===== Block 0x0F40 =====
        const f40 = new Uint8Array(blocks.f40);
        f40[0] = settings.int_flock ?? f40[0];
        f40[2] = settings.int_KILLED ?? f40[2];
        f40[5] = settings.int_350en ?? f40[5];
        f40[6] = settings.int_scren ?? f40[6];
        f40[7] = ((settings.live_dtmf_decoder ?? 0) << 6) |
                 ((settings.bat_text ?? 0) << 4) |
                 ((settings.mic_bar ?? 0) << 3) |
                 ((settings.am_fix ?? 0) << 2) |
                 (settings.bl_tx_rx ?? 0);
        blocks.f40 = f40;
        
        // ===== Block 0x1FF2 =====
        if (blocks.ff2) {
            const ext = new Uint8Array(blocks.ff2);
            ext[2] = ((settings.set_off_tmr ?? 0) << 1) | (settings.set_tmr ?? 0);
            ext[3] = ((settings.set_contrast ?? 0) << 4) |
                     ((settings.set_inv ?? 0) << 3) |
                     ((settings.set_lck ?? 0) << 2) |
                     ((settings.set_met ?? 0) << 1) |
                     (settings.set_gui ?? 0);
            ext[4] = ((settings.set_ptt ?? 0) << 7) |
                     ((settings.set_pwr ?? 0) << 4) |
                     ((settings.set_tot ?? 0) << 2) |
                     (settings.set_eot ?? 0);
            blocks.ff2 = ext;
        }
        
        return blocks;
    },
    
    // Helper: Read string from buffer
    readString(buffer, offset, length) {
        let str = "";
        for (let i = 0; i < length; i++) {
            const c = buffer[offset + i];
            if (c === 0 || c === 0xFF) break;
            str += String.fromCharCode(c);
        }
        return str.trim();
    },
    
    // Helper: Write string to buffer
    writeString(buffer, offset, str, length) {
        for (let i = 0; i < length; i++) {
            buffer[offset + i] = i < str.length ? str.charCodeAt(i) : 0xFF;
        }
    },
    
    // Settings UI configuration
    settingsUI: {
        groups: [
            {
                name: "Display",
                settings: [
                    { id: "backlight_time", label: "Backlight Time", type: "select", listFn: "generateBacklightList" },
                    { id: "backlight_max", label: "Backlight Max", type: "select", list: "BL_LVL" },
                    { id: "backlight_min", label: "Backlight Min", type: "select", list: "BL_LVL" },
                    { id: "bl_tx_rx", label: "Backlight TX/RX", type: "select", list: "BL_TX_RX" },
                    { id: "set_contrast", label: "Contrast", type: "number", min: 0, max: 15 },
                    { id: "set_inv", label: "Invert Display", type: "checkbox" },
                    { id: "set_gui", label: "GUI Style", type: "checkbox" },
                    { id: "set_met", label: "Meter Style", type: "select", list: "SET_MET" },
                    { id: "channel_display_mode", label: "Channel Display", type: "select", list: "CHANNELDISP" }
                ]
            },
            {
                name: "Audio",
                settings: [
                    { id: "mic_gain", label: "Mic Gain", type: "select", list: "MIC_GAIN" },
                    { id: "mic_bar", label: "Mic Bar", type: "checkbox" },
                    { id: "vox_switch", label: "VOX", type: "checkbox" },
                    { id: "vox_level", label: "VOX Level", type: "select", list: "VOX" },
                    { id: "voice", label: "Voice Prompt", type: "select", list: "VOICE" },
                    { id: "button_beep", label: "Button Beep", type: "checkbox" },
                    { id: "roger_beep", label: "Roger Beep", type: "select", list: "ROGER" },
                    { id: "ste", label: "Squelch Tail Elim", type: "checkbox" },
                    { id: "rp_ste", label: "Repeater Tail Elim", type: "select", list: "RTE" }
                ]
            },
            {
                name: "TX/RX",
                settings: [
                    { id: "squelch", label: "Squelch", type: "number", min: 0, max: 9 },
                    { id: "crossband", label: "RX Mode", type: "select", list: "RXMODE" },
                    { id: "dual_watch", label: "Dual Watch", type: "checkbox" },
                    { id: "tx_vfo", label: "TX VFO", type: "select", list: "TX_VFO" },
                    { id: "max_talk_time", label: "Max Talk Time", type: "select", listFn: "generateTalkTimeList" },
                    { id: "am_fix", label: "AM Fix", type: "checkbox" },
                    { id: "set_nfm", label: "NFM Mode", type: "select", list: "SET_NFM" },
                    { id: "int_flock", label: "Frequency Lock", type: "select", list: "FLOCK" }
                ]
            },
            {
                name: "Power",
                settings: [
                    { id: "battery_type", label: "Battery Type", type: "select", list: "BATTYPE" },
                    { id: "battery_save", label: "Battery Save", type: "select", list: "BATSAVE" },
                    { id: "bat_text", label: "Battery Text", type: "select", list: "BAT_TXT" },
                    { id: "set_off_tmr", label: "Auto Power Off", type: "select", listFn: "generateOffTimerList" },
                    { id: "set_pwr", label: "TX Power", type: "select", list: "SET_LOW" },
                    { id: "set_ptt", label: "PTT Mode", type: "select", list: "SET_PTT" }
                ]
            },
            {
                name: "Scan/Lock",
                settings: [
                    { id: "scan_resume_mode", label: "Scan Resume", type: "select", listFn: "generateScanResumeList" },
                    { id: "auto_keypad_lock", label: "Auto Keypad Lock", type: "select", listFn: "generateAutoKeypadList" },
                    { id: "key_lock", label: "Key Lock", type: "checkbox" },
                    { id: "set_lck", label: "Lock Mode", type: "select", list: "SET_LCK" },
                    { id: "set_menu_lock", label: "Menu Lock", type: "checkbox" },
                    { id: "set_key", label: "Menu Key", type: "select", list: "SET_KEY" }
                ]
            },
            {
                name: "Keys",
                settings: [
                    { id: "key1_shortpress_action", label: "Side Key 1 Short", type: "select", list: "KEYACTIONS" },
                    { id: "key1_longpress_action", label: "Side Key 1 Long", type: "select", list: "KEYACTIONS" },
                    { id: "key2_shortpress_action", label: "Side Key 2 Short", type: "select", list: "KEYACTIONS" },
                    { id: "key2_longpress_action", label: "Side Key 2 Long", type: "select", list: "KEYACTIONS" },
                    { id: "keyM_longpress_action", label: "Key M Long", type: "select", list: "KEYACTIONS" }
                ]
            },
            {
                name: "DTMF",
                settings: [
                    { id: "live_dtmf_decoder", label: "Live DTMF Decoder", type: "checkbox" },
                    { id: "dtmf_side_tone", label: "DTMF Side Tone", type: "checkbox" },
                    { id: "dtmf_decode_response", label: "Decode Response", type: "select", list: "DTMF_DECODE_RESPONSE" },
                    { id: "dtmf_separate_code", label: "Separate Code", type: "text", maxLength: 1 },
                    { id: "dtmf_group_call_code", label: "Group Call Code", type: "text", maxLength: 1 },
                    { id: "dtmf_local_code", label: "Local Code", type: "text", maxLength: 3 },
                    { id: "dtmf_up_code", label: "Up Code", type: "text", maxLength: 16 },
                    { id: "dtmf_down_code", label: "Down Code", type: "text", maxLength: 16 },
                    { id: "dtmf_kill_code", label: "Kill Code", type: "text", maxLength: 5 },
                    { id: "dtmf_revive_code", label: "Revive Code", type: "text", maxLength: 5 },
                    { id: "dtmf_permit_remote_kill", label: "Permit Remote Kill", type: "checkbox" }
                ]
            },
            {
                name: "Scanlist Priority",
                settings: [
                    { id: "scanlist_default", label: "Default Scanlist", type: "select", list: "SCANLIST_SELECT" },
                    { id: "sl1_prior_enable", label: "List 1 Priority", type: "checkbox" },
                    { id: "sl1_prior_ch1", label: "List 1 Priority Ch1", type: "number", min: 0, max: 199 },
                    { id: "sl1_prior_ch2", label: "List 1 Priority Ch2", type: "number", min: 0, max: 199 },
                    { id: "sl2_prior_enable", label: "List 2 Priority", type: "checkbox" },
                    { id: "sl2_prior_ch1", label: "List 2 Priority Ch1", type: "number", min: 0, max: 199 },
                    { id: "sl2_prior_ch2", label: "List 2 Priority Ch2", type: "number", min: 0, max: 199 },
                    { id: "sl3_prior_enable", label: "List 3 Priority", type: "checkbox" },
                    { id: "sl3_prior_ch1", label: "List 3 Priority Ch1", type: "number", min: 0, max: 199 },
                    { id: "sl3_prior_ch2", label: "List 3 Priority Ch2", type: "number", min: 0, max: 199 }
                ]
            },
            {
                name: "Startup",
                settings: [
                    { id: "power_on_dispmode", label: "Power On Display", type: "select", list: "WELCOME" },
                    { id: "logo_line1", label: "Logo Line 1", type: "text", maxLength: 16 },
                    { id: "logo_line2", label: "Logo Line 2", type: "text", maxLength: 16 },
                    { id: "password", label: "Password", type: "password" },
                    { id: "call_channel", label: "Call Channel", type: "number", min: 0, max: 199 }
                ]
            },
            {
                name: "Alarm",
                settings: [
                    { id: "alarm_mode", label: "Alarm Mode", type: "select", list: "ALARMMODE" },
                    { id: "noaa_autoscan", label: "NOAA Autoscan", type: "checkbox" },
                    { id: "set_tot", label: "TOT Alert", type: "select", list: "SET_TOT_EOT" },
                    { id: "set_eot", label: "EOT Alert", type: "select", list: "SET_TOT_EOT" }
                ]
            },
            {
                name: "Timing",
                settings: [
                    { id: "set_tmr", label: "Timer", type: "checkbox" },
                    { id: "dtmf_preload_time", label: "DTMF Preload Time", type: "number", min: 0, max: 100 },
                    { id: "dtmf_first_code_persist_time", label: "First Code Persist Time", type: "number", min: 0, max: 100 },
                    { id: "dtmf_hash_persist_time", label: "Hash Persist Time", type: "number", min: 0, max: 100 },
                    { id: "dtmf_code_persist_time", label: "Code Persist Time", type: "number", min: 0, max: 100 },
                    { id: "dtmf_code_interval_time", label: "Code Interval Time", type: "number", min: 0, max: 100 },
                    { id: "dtmf_auto_reset_time", label: "DTMF Auto Reset Time", type: "number", min: 0, max: 60 }
                ]
            },
            {
                name: "Internal/Hidden",
                settings: [
                    { id: "int_flock", label: "Frequency Lock", type: "select", list: "FLOCK" },
                    { id: "int_350en", label: "350MHz Enable", type: "checkbox" },
                    { id: "int_scren", label: "Scrambler Enable", type: "checkbox" },
                    { id: "int_KILLED", label: "TX Killed", type: "checkbox" },
                    { id: "freq_mode_allowed", label: "Freq Mode Allowed", type: "checkbox" }
                ]
            }
        ]
    }
};
