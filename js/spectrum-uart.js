// =====================================================
// SPECTRUM UART v12.30 - Complete Implementation
// For MCFW v1.35.1D firmware
// Full preset system with editor (matches spectrum.h)
// =====================================================

(function() {
    'use strict';

    // ===== STATE =====
    let port = null;
    let reader = null;
    let writer = null;
    let isConnected = false;
    let statusInterval = null;
    let peakLog = [];
    let currentTone = "N";
    let currentMode = -1;
    let freqInputBuffer = '';
    let lastLoggedFreq = 0;
    let lastLoggedTime = 0;
    let currentThreshold = 80;

    // Mode names (5 modes)
    const MODE_NAMES = ['FREQUENCY', 'CHANNEL', 'ORIGINAL', 'WATERFALL', 'PROFESSIONAL'];

    // ===== PRESET ENUMS (from spectrum.h) =====
    const STEPS_COUNT = [
        { value: 0, label: '128', name: 'STEPS_128' },
        { value: 1, label: '64',  name: 'STEPS_64' },
        { value: 2, label: '32',  name: 'STEPS_32' },
        { value: 3, label: '16',  name: 'STEPS_16' }
    ];

    const STEP_SIZES = [
        { value: 0,  label: '0.01 kHz',  name: 'S_STEP_0_01kHz',   raw: 1 },
        { value: 1,  label: '0.1 kHz',   name: 'S_STEP_0_1kHz',    raw: 10 },
        { value: 2,  label: '0.5 kHz',   name: 'S_STEP_0_5kHz',    raw: 50 },
        { value: 3,  label: '1.0 kHz',   name: 'S_STEP_1_0kHz',    raw: 100 },
        { value: 4,  label: '2.5 kHz',   name: 'S_STEP_2_5kHz',    raw: 250 },
        { value: 5,  label: '5.0 kHz',   name: 'S_STEP_5_0kHz',    raw: 500 },
        { value: 6,  label: '6.25 kHz',  name: 'S_STEP_6_25kHz',   raw: 625 },
        { value: 7,  label: '8.33 kHz',  name: 'S_STEP_8_33kHz',   raw: 833 },
        { value: 8,  label: '10.0 kHz',  name: 'S_STEP_10_0kHz',   raw: 1000 },
        { value: 9,  label: '12.5 kHz',  name: 'S_STEP_12_5kHz',   raw: 1250 },
        { value: 10, label: '15.0 kHz',  name: 'S_STEP_15_0kHz',   raw: 1500 },
        { value: 11, label: '20.0 kHz',  name: 'S_STEP_20_0kHz',   raw: 2000 },
        { value: 12, label: '25.0 kHz',  name: 'S_STEP_25_0kHz',   raw: 2500 },
        { value: 13, label: '50.0 kHz',  name: 'S_STEP_50_0kHz',   raw: 5000 },
        { value: 14, label: '100.0 kHz', name: 'S_STEP_100_0kHz',  raw: 10000 }
    ];

    const MODULATIONS = [
        { value: 0, label: 'FM',  name: 'MODULATION_FM' },
        { value: 1, label: 'AM',  name: 'MODULATION_AM' },
        { value: 2, label: 'USB', name: 'MODULATION_USB' },
        { value: 3, label: 'LSB', name: 'MODULATION_LSB' }
    ];

    const BANDWIDTHS = [
        { value: 0, label: 'Wide',     name: 'BK4819_FILTER_BW_WIDE' },
        { value: 1, label: 'Narrow',   name: 'BK4819_FILTER_BW_NARROW' },
        { value: 2, label: 'Narrower', name: 'BK4819_FILTER_BW_NARROWER' }
    ];

    // ===== 70 DEFAULT PRESETS (from spectrum.h freqPresets[] - EXACT) =====
    // Fields: name, fStart (Hz*10), fEnd (Hz*10), stepsCount, stepSize, modulation, listenBW, firmwareIndex
    const DEFAULT_PRESETS = [
        {name:"17m Ham Band",     fStart:1806800,  fEnd:1889999,   stepsCount:0, stepSize:3,  mod:2, bw:2, fwIdx:0},
        {name:"15m Broadcast",    fStart:1890000,  fEnd:2099999,   stepsCount:0, stepSize:5,  mod:1, bw:1, fwIdx:1},
        {name:"15m Ham Band",     fStart:2100000,  fEnd:2144999,   stepsCount:0, stepSize:3,  mod:2, bw:2, fwIdx:2},
        {name:"13m Broadcast",    fStart:2145000,  fEnd:2488999,   stepsCount:0, stepSize:5,  mod:1, bw:1, fwIdx:3},
        {name:"12m Ham Band",     fStart:2489000,  fEnd:2566999,   stepsCount:0, stepSize:3,  mod:2, bw:2, fwIdx:4},
        {name:"11m Broadcast",    fStart:2567000,  fEnd:2697499,   stepsCount:0, stepSize:5,  mod:1, bw:1, fwIdx:5},
        {name:"CB",               fStart:2697500,  fEnd:2799999,   stepsCount:0, stepSize:5,  mod:0, bw:1, fwIdx:6},
        {name:"10m Ham Band",     fStart:2800000,  fEnd:4999999,   stepsCount:0, stepSize:3,  mod:2, bw:2, fwIdx:7},
        {name:"6m Ham Band",      fStart:5000000,  fEnd:5449999,   stepsCount:0, stepSize:3,  mod:2, bw:2, fwIdx:8},
        {name:"Volmet Aviation",  fStart:5450000,  fEnd:7749999,   stepsCount:1, stepSize:5,  mod:1, bw:1, fwIdx:9},
        {name:"Time Signals",     fStart:7750000,  fEnd:8749999,   stepsCount:3, stepSize:5,  mod:1, bw:2, fwIdx:10},
        {name:"FM Broadcast EU",  fStart:8750000,  fEnd:11799999,  stepsCount:0, stepSize:14, mod:0, bw:0, fwIdx:11},
        {name:"Airband Tower",    fStart:11800000, fEnd:12099999,  stepsCount:0, stepSize:12, mod:1, bw:1, fwIdx:12},
        {name:"Air Band Voice",   fStart:11800000, fEnd:12099999,  stepsCount:0, stepSize:14, mod:1, bw:1, fwIdx:13},
        {name:"Airband Ground",   fStart:12100000, fEnd:12699999,  stepsCount:0, stepSize:12, mod:1, bw:1, fwIdx:14},
        {name:"Airband ATIS",     fStart:12700000, fEnd:13799999,  stepsCount:1, stepSize:12, mod:1, bw:1, fwIdx:15},
        {name:"FEMA",             fStart:13800000, fEnd:13899999,  stepsCount:0, stepSize:9,  mod:0, bw:0, fwIdx:16},
        {name:"MARS",             fStart:13900000, fEnd:14399999,  stepsCount:0, stepSize:5,  mod:2, bw:2, fwIdx:17},
        {name:"2m Ham Band",      fStart:14400000, fEnd:14429999,  stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:18},
        {name:"YSF/WIRES-X",      fStart:14400000, fEnd:14429999,  stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:19},
        {name:"RSGB Test",        fStart:14430000, fEnd:14499999,  stepsCount:3, stepSize:12, mod:0, bw:1, fwIdx:20},
        {name:"D-Star",           fStart:14500000, fEnd:14579999,  stepsCount:0, stepSize:12, mod:0, bw:1, fwIdx:21},
        {name:"ISS Packet",       fStart:14580000, fEnd:14651999,  stepsCount:3, stepSize:5,  mod:0, bw:1, fwIdx:22},
        {name:"ARRL Test",        fStart:14652000, fEnd:14799999,  stepsCount:3, stepSize:12, mod:0, bw:1, fwIdx:23},
        {name:"CAP",              fStart:14800000, fEnd:15174999,  stepsCount:0, stepSize:9,  mod:0, bw:0, fwIdx:24},
        {name:"Railway",          fStart:15175000, fEnd:15199999,  stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:25},
        {name:"Taxi USA/Bus",     fStart:15200000, fEnd:15399999,  stepsCount:0, stepSize:9,  mod:0, bw:0, fwIdx:26},
        {name:"USA Fire",         fStart:15400000, fEnd:15499999,  stepsCount:0, stepSize:9,  mod:0, bw:0, fwIdx:27},
        {name:"USA EMS",          fStart:15500000, fEnd:15599999,  stepsCount:0, stepSize:9,  mod:0, bw:0, fwIdx:28},
        {name:"USA Police",       fStart:15500000, fEnd:15599999,  stepsCount:0, stepSize:9,  mod:0, bw:0, fwIdx:29},
        {name:"Marine Intl",      fStart:15600000, fEnd:15679999,  stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:30},
        {name:"Sea",              fStart:15600000, fEnd:15679999,  stepsCount:0, stepSize:14, mod:0, bw:0, fwIdx:31},
        {name:"Marine VHF CH16",  fStart:15680000, fEnd:15999999,  stepsCount:3, stepSize:12, mod:0, bw:0, fwIdx:32},
        {name:"Marine USA",       fStart:16000000, fEnd:16099999,  stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:33},
        {name:"Weather Canada",   fStart:16100000, fEnd:16239999,  stepsCount:1, stepSize:12, mod:0, bw:1, fwIdx:34},
        {name:"EAS",              fStart:16240000, fEnd:16499999,  stepsCount:3, stepSize:5,  mod:0, bw:1, fwIdx:35},
        {name:"NOAA Weather",     fStart:16240000, fEnd:16499999,  stepsCount:3, stepSize:5,  mod:0, bw:1, fwIdx:36},
        {name:"Taxi UK",          fStart:16500000, fEnd:16799999,  stepsCount:0, stepSize:9,  mod:0, bw:0, fwIdx:37},
        {name:"UK Emergency",     fStart:16500000, fEnd:16799999,  stepsCount:0, stepSize:9,  mod:0, bw:0, fwIdx:38},
        {name:"ROB - Bombeiros",  fStart:16800000, fEnd:22199999,  stepsCount:1, stepSize:14, mod:0, bw:0, fwIdx:39},
        {name:"1.25m Ham",        fStart:22200000, fEnd:22499999,  stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:40},
        {name:"Military Air",     fStart:22500000, fEnd:24299999,  stepsCount:0, stepSize:12, mod:1, bw:0, fwIdx:41},
        {name:"Satcom",           fStart:24300000, fEnd:25499999,  stepsCount:0, stepSize:14, mod:0, bw:0, fwIdx:42},
        {name:"Satcom II",        fStart:25500000, fEnd:30001249,  stepsCount:0, stepSize:14, mod:0, bw:0, fwIdx:43},
        {name:"River1",           fStart:30001250, fEnd:33601249,  stepsCount:1, stepSize:9,  mod:0, bw:1, fwIdx:44},
        {name:"River2",           fStart:33601250, fEnd:42999999,  stepsCount:1, stepSize:9,  mod:0, bw:1, fwIdx:45},
        {name:"70cm Ham Band L",  fStart:43000000, fEnd:43304999,  stepsCount:0, stepSize:14, mod:0, bw:0, fwIdx:46},
        {name:"DMR Europe",       fStart:43000000, fEnd:43304999,  stepsCount:0, stepSize:9,  mod:0, bw:1, fwIdx:47},
        {name:"ISM 433 MHz",      fStart:43305000, fEnd:43599999,  stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:48},
        {name:"LPD/LoRa 433",     fStart:43305000, fEnd:43599999,  stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:49},
        {name:"CubeSats",         fStart:43600000, fEnd:43779999,  stepsCount:1, stepSize:5,  mod:0, bw:1, fwIdx:50},
        {name:"ISS Voice",        fStart:43780000, fEnd:43799999,  stepsCount:3, stepSize:5,  mod:0, bw:1, fwIdx:51},
        {name:"70cm Ham Band H",  fStart:43800000, fEnd:43999999,  stepsCount:0, stepSize:9,  mod:0, bw:0, fwIdx:52},
        {name:"MOV/SMT",          fStart:44000000, fEnd:44600624,  stepsCount:0, stepSize:14, mod:0, bw:0, fwIdx:53},
        {name:"PMR",              fStart:44600625, fEnd:44619999,  stepsCount:2, stepSize:6,  mod:0, bw:1, fwIdx:54},
        {name:"MOV/SMT",          fStart:44620000, fEnd:44999999,  stepsCount:1, stepSize:14, mod:0, bw:0, fwIdx:55},
        {name:"Business Radio",   fStart:45000000, fEnd:45762499,  stepsCount:0, stepSize:9,  mod:0, bw:0, fwIdx:56},
        {name:"CP - C.Portugal",  fStart:45762500, fEnd:46256249,  stepsCount:3, stepSize:12, mod:0, bw:1, fwIdx:57},
        {name:"FRS/GMRS 462",     fStart:46256250, fEnd:46756249,  stepsCount:3, stepSize:9,  mod:0, bw:1, fwIdx:58},
        {name:"FRS/GMRS 467",     fStart:46756250, fEnd:46999999,  stepsCount:3, stepSize:9,  mod:0, bw:1, fwIdx:59},
        {name:"Industrial",       fStart:47000000, fEnd:86399999,  stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:60},
        {name:"LoRa WAN",         fStart:86400000, fEnd:86799999,  stepsCount:0, stepSize:14, mod:0, bw:0, fwIdx:61},
        {name:"ISM 868 MHz EU",   fStart:86800000, fEnd:86809999,  stepsCount:2, stepSize:12, mod:0, bw:1, fwIdx:62},
        {name:"LoRa 868 MHz",     fStart:86810000, fEnd:88999999,  stepsCount:2, stepSize:12, mod:0, bw:1, fwIdx:63},
        {name:"GSM900 UP",        fStart:89000000, fEnd:90199999,  stepsCount:0, stepSize:14, mod:0, bw:0, fwIdx:64},
        {name:"33cm Ham",         fStart:90200000, fEnd:93499999,  stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:65},
        {name:"ISM 915 MHz",      fStart:90200000, fEnd:93499999,  stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:66},
        {name:"GSM900 DOWN",      fStart:93500000, fEnd:107999999, stepsCount:0, stepSize:14, mod:0, bw:0, fwIdx:67},
        {name:"Aeronautical Nav", fStart:108000000,fEnd:123999999, stepsCount:0, stepSize:12, mod:1, bw:1, fwIdx:68},
        {name:"23cm Ham Band",    fStart:124000000,fEnd:130000000, stepsCount:0, stepSize:12, mod:0, bw:0, fwIdx:69}
    ];

    // ===== ACTIVE PRESETS (mutable) =====
    let PRESETS = [];

    // ===== PRESET PERSISTENCE =====
    function loadPresets() {
        try {
            const saved = localStorage.getItem('spectrumPresets_v3');
            if (saved) {
                PRESETS = JSON.parse(saved);
                return;
            }
        } catch(e) {}
        resetPresetsToDefaults();
    }

    function resetPresetsToDefaults() {
        PRESETS = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
    }

    function savePresets() {
        try { localStorage.setItem('spectrumPresets_v3', JSON.stringify(PRESETS)); } catch(e) {}
    }

    // ===== HELPER: Format frequency =====
    function fmtFreq(val) {
        return (val / 100000).toFixed(3);
    }

    function getModLabel(v) { return (MODULATIONS[v] || MODULATIONS[0]).label; }
    function getStepsLabel(v) { return (STEPS_COUNT[v] || STEPS_COUNT[0]).label; }
    function getStepSizeLabel(v) { return (STEP_SIZES[v] || STEP_SIZES[0]).label; }
    function getBwLabel(v) { return (BANDWIDTHS[v] || BANDWIDTHS[0]).label; }

    // ===== CONNECTION =====
    async function connect() {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 38400 });

            writer = port.writable.getWriter();
            reader = port.readable.getReader();
            isConnected = true;

            updateConnectionUI(true);
            readLoop();

            statusInterval = setInterval(function() {
                if (isConnected) sendCommand('STATUS');
            }, 2000);

            setTimeout(function() { sendCommand('STATUS'); }, 500);

            logUART('INFO', 'Connected at 38400 baud');

        } catch (e) {
            console.error('Connection error:', e);
            logUART('ERR', e.message);
        }
    }

    async function disconnect() {
        isConnected = false;
        if (statusInterval) {
            clearInterval(statusInterval);
            statusInterval = null;
        }
        try {
            if (reader) { await reader.cancel(); reader.releaseLock(); reader = null; }
            if (writer) { writer.releaseLock(); writer = null; }
            if (port) { await port.close(); port = null; }
        } catch (e) {
            console.error('Disconnect error:', e);
        }
        updateConnectionUI(false);
        logUART('INFO', 'Disconnected');
    }

    function toggleConnection() {
        if (isConnected) { disconnect(); } else { connect(); }
    }

    function updateConnectionUI(connected) {
        var indicator = document.getElementById('spectrumStatusIndicator');
        var text = document.getElementById('spectrumStatusText');
        var btn = document.getElementById('spectrumConnectBtn');

        if (indicator) indicator.classList.toggle('connected', connected);
        if (text) text.textContent = connected ? 'Connected' : 'Disconnected';
        if (btn) btn.textContent = connected ? 'Disconnect' : 'Connect';
    }

    // ===== READ LOOP =====
    async function readLoop() {
        var buffer = '';
        while (isConnected && reader) {
            try {
                var result = await reader.read();
                if (result.done) break;

                var decoder = new TextDecoder();
                buffer += decoder.decode(result.value, { stream: true });

                var lines = buffer.split('\n');
                buffer = lines.pop();

                for (var li = 0; li < lines.length; li++) {
                    var line = lines[li].trim();
                    if (line) {
                        logUART('RX', line);
                        processData(line);
                    }
                }
            } catch (e) {
                if (isConnected) console.error('Read error:', e);
                break;
            }
        }
    }

    // ===== SEND COMMAND =====
    async function sendCommand(cmd) {
        if (!isConnected || !writer) {
            logUART('ERR', 'Not connected');
            return;
        }

        var fullCmd = 'SPEC:' + cmd + ']';
        try {
            var encoder = new TextEncoder();
            await writer.write(encoder.encode(fullCmd));
            logUART('TX', fullCmd);
        } catch (e) {
            logUART('ERR', e.message);
        }
    }

    // ===== PROCESS DATA =====
    function processData(line) {
        if (line.includes('SPEC:ST,')) {
            parseStatus(line);
        } else if (line.includes('SPEC:PK,')) {
            parsePeak(line);
        } else if (line.includes('SPEC:M=')) {
            parseMode(line);
        } else if (line.includes('SPEC:TR,')) {
            parseTriggerFreq(line);
        } else if (line.includes('SPEC:TC,')) {
            parseTriggerChannel(line);
        } else if (line.includes('SPEC:C,')) {
            parseChannel(line);
        } else if (line.includes('SPEC:FI,')) {
            parseFreqIn(line);
        } else if (line.includes('SPEC:FK,')) {
            parseFreqKey(line);
        } else if (line.includes('SPEC:FO,')) {
            parseFreqOk(line);
        } else if (line.includes('SPEC:FE,')) {
            parseFreqErr(line);
        } else if (line.includes('SPEC:FC')) {
            parseFreqCancel();
        } else if (line.includes('SPEC:PS,')) {
            parseProfStatus(line);
        } else if (line.includes('SPEC:TH,')) {
            var th = parseInt(line.substring(line.indexOf('SPEC:TH,') + 8));
            if (!isNaN(th)) {
                currentThreshold = th;
                var thDbm = (th / 2) - 160;
                logUART('RX', 'Threshold: ' + th + ' raw (' + thDbm.toFixed(1) + ' dBm)');
            }
        }
    }

    function parseStatus(line) {
        var idx = line.indexOf('SPEC:ST,');
        if (idx === -1) return;

        var parts = line.substring(idx + 8).split(',');
        var mode = -1, freq = 0, rssi = 0, mod = '---', ch = '', tone = '';

        if (parts.length >= 1) mode = parseInt(parts[0]) || 0;
        if (parts.length >= 2) freq = parseInt(parts[1]) || 0;
        if (parts.length >= 3) rssi = parseInt(parts[2]) || 0;
        if (parts.length >= 4) mod = parts[3] || '---';
        if (parts.length >= 5) tone = parts[4] || '';

        currentTone = tone || "N";

        if (tone && tone !== "N" && freq > 0) {
            var statusFreqMHz = (freq / 100000).toFixed(5);
            for (var i = 0; i < Math.min(peakLog.length, 10); i++) {
                var entry = peakLog[i];
                if (entry.freq === statusFreqMHz && (entry.ctcss === "N" || !entry.ctcss)) {
                    entry.ctcss = tone;
                }
            }
            updateLogDisplay();
        }

        updateDisplay(mode, freq, rssi, mod, ch, tone);

        if (mode !== currentMode) {
            currentMode = mode;
            updateModeButtons(mode);
        }
    }

    function parsePeak(line) {
        var idx = line.indexOf('SPEC:PK,');
        if (idx === -1) return;
        var parts = line.substring(idx + 8).split(',');
        if (parts.length >= 3) {
            var freq = parseInt(parts[0]) || 0;
            var rssi = parseInt(parts[1]) || 0;
            var mod = parts[2] || '';
            if (freq > 0) {
                var freqMHz = freq / 100000;
                var rssiDbm = (rssi / 2) - 160;
                addToLog(freqMHz, rssiDbm, mod, 'PEAK');
            }
        }
    }

    function parseMode(line) {
        var idx = line.indexOf('SPEC:M=');
        if (idx === -1) return;
        var mode = parseInt(line.substring(idx + 7));
        if (!isNaN(mode) && mode >= 0 && mode <= 4) {
            currentMode = mode;
            updateModeButtons(mode);
            if (mode === 4) {
                setTimeout(function() { sendCommand('PROFSTAT'); }, 100);
            }
        }
    }

    function parseTriggerFreq(line) {
        var idx = line.indexOf('SPEC:TR,');
        if (idx === -1) return;
        var data = line.substring(idx + 8);
        var parts = data.split(',');
        if (parts.length < 2) return;
        var freq = parseInt(parts[0]);
        var rssiDbm = parseInt(parts[1]);
        var tone = parts.length >= 3 ? parts[2].trim() : 'N';
        if (tone === 'N' && currentTone !== 'N') tone = currentTone;
        if (isNaN(freq) || isNaN(rssiDbm)) return;
        var freqMHz = freq / 100000;
        var now = Date.now();
        var freqChanged = Math.abs(freq - lastLoggedFreq) > 1000;
        var timePassed = now - lastLoggedTime > 3000;
        if (freqChanged || timePassed) {
            addToLog(freqMHz, rssiDbm, '---', 'TRIG ' + tone);
            lastLoggedFreq = freq;
            lastLoggedTime = now;
        }
    }

    function parseTriggerChannel(line) {
        var match = line.match(/M:(\d+),FREQ:(\d+),RSSI:(-?\d+)/);
        if (!match) return;
        var ch = parseInt(match[1]);
        var freq = parseInt(match[2]);
        var rssiDbm = parseInt(match[3]);
        var freqMHz = freq / 100000;
        var now = Date.now();
        var freqChanged = Math.abs(freq - lastLoggedFreq) > 1000;
        var timePassed = now - lastLoggedTime > 3000;
        if (freqChanged || timePassed) {
            addToLog(freqMHz, rssiDbm, '---', 'CH' + ch);
            lastLoggedFreq = freq;
            lastLoggedTime = now;
        }
    }

    function parseChannel(line) {
        var idx = line.indexOf('SPEC:C,');
        if (idx === -1) return;
        var parts = line.substring(idx + 7).split(',');
        if (parts.length < 4) return;
        var chNum = parts[0];
        var chName = parts[1];
        var rssi = parseInt(parts[2]) || 0;
        var tone = parts[3];
        var chDisplay = 'CH ' + chNum;
        if (chName && chName !== '-') chDisplay += ' (' + chName + ')';
        var chEl = document.getElementById('channelValue');
        if (chEl) chEl.textContent = chDisplay;
    }

    function parseFreqIn(line) {
        var idx = line.indexOf('SPEC:FI,');
        if (idx === -1) return;
        var parts = line.substring(idx + 8).split(',');
        var min = parseInt(parts[0]) || 0;
        var max = parseInt(parts[1]) || 0;
        var display = document.getElementById('freqInputDisplay');
        if (display) {
            display.textContent = 'Range: ' + (min/100000).toFixed(3) + ' - ' + (max/100000).toFixed(3) + ' MHz';
        }
    }

    function parseFreqKey(line) {
        var idx = line.indexOf('SPEC:FK,');
        if (idx === -1) return;
        var parts = line.substring(idx + 8).split(',');
        var str = parts[0] || '';
        var display = document.getElementById('freqInputDisplay');
        if (display) display.textContent = str || '0.00000';
    }

    function parseFreqOk(line) {
        var idx = line.indexOf('SPEC:FO,');
        if (idx === -1) return;
        var freq = parseInt(line.substring(idx + 8)) || 0;
        var display = document.getElementById('freqInputDisplay');
        if (display) {
            display.textContent = '\u2713 ' + (freq/100000).toFixed(5) + ' MHz';
            display.style.color = '#4caf50';
            setTimeout(function() { display.textContent = '0.00000'; display.style.color = ''; }, 2000);
        }
    }

    function parseFreqErr(line) {
        var display = document.getElementById('freqInputDisplay');
        if (display) {
            display.textContent = '\u2717 Out of range';
            display.style.color = '#f44336';
            setTimeout(function() { display.textContent = '0.00000'; display.style.color = ''; }, 2000);
        }
    }

    function parseFreqCancel() {
        var display = document.getElementById('freqInputDisplay');
        if (display) {
            display.textContent = 'Cancelled';
            display.style.color = '#ff9800';
            setTimeout(function() { display.textContent = '0.00000'; display.style.color = ''; }, 2000);
        }
    }

    function parseProfStatus(line) {
        var idx = line.indexOf('SPEC:PS,');
        if (idx === -1) return;
        var data = line.substring(idx + 8).trim();
        var smooth = '--', autotrig = '--', horizon = '--', bandled = '--';
        var mountain = '--', heli = '--', sugar = '--';
        if (data.length >= 7) {
            smooth = data[0] !== '0' ? 'ON' : 'OFF';
            autotrig = data[1] !== '0' ? 'ON' : 'OFF';
            horizon = data[2] !== '0' ? 'ON' : 'OFF';
            bandled = data[3] !== '0' ? 'ON' : 'OFF';
            mountain = data[4] !== '0' ? 'ON' : 'OFF';
            heli = data[5] !== '0' ? 'ON' : 'OFF';
            sugar = data[6] !== '0' ? 'ON' : 'OFF';
        }
        var proStatus = document.getElementById('proStatus');
        if (proStatus) {
            var onC = '#4caf50', offC = '#f44336';
            proStatus.innerHTML =
                '<span style="color:' + (smooth==='ON'?onC:offC) + '">Smooth:' + smooth + '</span> | ' +
                '<span style="color:' + (autotrig==='ON'?onC:offC) + '">AutoTrig:' + autotrig + '</span> | ' +
                '<span style="color:' + (horizon==='ON'?onC:offC) + '">Horizon:' + horizon + '</span> | ' +
                '<span style="color:' + (bandled==='ON'?onC:offC) + '">BandLED:' + bandled + '</span> | ' +
                '<span style="color:' + (mountain==='ON'?onC:offC) + '">Mountain:' + mountain + '</span> | ' +
                '<span style="color:' + (heli==='ON'?onC:offC) + '">Heli:' + heli + '</span> | ' +
                '<span style="color:' + (sugar==='ON'?onC:offC) + '">Sugar:' + sugar + '</span>';
        }
    }

    // ===== DISPLAY UPDATE =====
    function updateDisplay(mode, freq, rssi, mod, ch, tone) {
        var modeEl = document.getElementById('modeValue');
        var freqEl = document.getElementById('freqValue');
        var rssiEl = document.getElementById('rssiValue');
        var modEl = document.getElementById('modValue');
        var chEl = document.getElementById('channelValue');

        if (modeEl) modeEl.textContent = MODE_NAMES[mode] || ('Mode ' + mode);

        if (freqEl) {
            if (freq > 0) {
                freqEl.textContent = (freq / 100000).toFixed(5) + ' MHz';
            } else {
                freqEl.textContent = '---';
            }
        }

        if (rssiEl) {
            if (rssi > 0) {
                var rssiDbm = (rssi / 2) - 160;
                rssiEl.textContent = rssiDbm.toFixed(1) + ' dBm (' + rssi + ')';
            } else {
                rssiEl.textContent = '---';
            }
        }

        if (modEl) modEl.textContent = mod || '---';
    }

    // ===== MODE BUTTONS =====
    function updateModeButtons(activeMode) {
        var btns = document.querySelectorAll('.mode-btn');
        for (var i = 0; i < btns.length; i++) {
            var m = parseInt(btns[i].getAttribute('data-mode'));
            btns[i].classList.toggle('active', m === activeMode);
        }
    }

    // ===== LOGGING =====
    function addToLog(freqMHz, rssiDbm, mod, type) {
        var now = new Date();
        var ts = now.getHours().toString().padStart(2, '0') + ':' +
                 now.getMinutes().toString().padStart(2, '0') + ':' +
                 now.getSeconds().toString().padStart(2, '0');

        var entry = {
            time: ts,
            freq: freqMHz.toFixed(5),
            rssi: rssiDbm.toFixed(1),
            mod: mod,
            type: type,
            ctcss: currentTone
        };

        peakLog.unshift(entry);
        if (peakLog.length > 500) peakLog.pop();
        updateLogDisplay();
    }

    function updateLogDisplay() {
        var log = document.getElementById('peakLogList');
        if (!log) return;

        while (log.children.length > peakLog.length) {
            log.removeChild(log.lastChild);
        }

        for (var i = 0; i < Math.min(peakLog.length, 200); i++) {
            var e = peakLog[i];
            var row = log.children[i];
            var html = '<span class="log-time">' + e.time + '</span>' +
                       '<span class="log-freq">' + e.freq + ' MHz</span>' +
                       '<span class="log-rssi">' + e.rssi + ' dBm</span>' +
                       '<span class="log-mod">' + e.mod + '</span>' +
                       '<span class="log-type">' + e.type + '</span>' +
                       (e.ctcss && e.ctcss !== 'N' ? '<span class="log-ctcss">' + e.ctcss + '</span>' : '');
            if (!row) {
                row = document.createElement('div');
                row.className = 'log-entry';
                log.appendChild(row);
            }
            row.innerHTML = html;
        }
    }

    function clearLog() {
        peakLog = [];
        var log = document.getElementById('peakLogList');
        if (log) log.innerHTML = '';
    }

    function exportLog() {
        if (peakLog.length === 0) return;
        var csv = 'Time,Frequency (MHz),RSSI (dBm),Modulation,Type,CTCSS\\n';
        for (var i = 0; i < peakLog.length; i++) {
            var e = peakLog[i];
            csv += e.time + ',' + e.freq + ',' + e.rssi + ',' + e.mod + ',' + e.type + ',' + (e.ctcss||'') + '\\n';
        }
        var blob = new Blob([csv], { type: 'text/csv' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'spectrum_log_' + new Date().toISOString().slice(0,10) + '.csv';
        a.click();
    }

    function logUART(type, msg) {
        var log = document.getElementById('uartLog');
        if (!log) return;

        var entry = document.createElement('div');
        var className = type === 'TX' ? 'uart-tx' : (type === 'ERR' ? 'uart-err' : 'uart-rx');
        entry.className = 'uart-entry ' + className;
        entry.textContent = '[' + type + '] ' + msg;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;

        while (log.children.length > 200) {
            log.removeChild(log.firstChild);
        }
    }

    // ===== TAB SWITCHING =====
    function showTab(name) {
        var tabs = document.querySelectorAll('.spectrum-tab');
        var contents = document.querySelectorAll('.spectrum-tab-content');
        for (var i = 0; i < tabs.length; i++) { tabs[i].classList.remove('active'); }
        for (var j = 0; j < contents.length; j++) { contents[j].classList.remove('active'); }
        var tabBtn = document.querySelector('.spectrum-tab[data-tab="' + name + '"]');
        var tabContent = document.getElementById('tab-' + name);
        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');
    }

    // ===== MODE SELECTION =====
    function setMode(mode) {
        sendCommand('SETMODE=' + mode);
        if (mode === 4) {
            setTimeout(function() { sendCommand('PROFSTAT'); }, 200);
        }
    }

    // ===== FREQUENCY INPUT =====
    function sendKey(key) {
        sendCommand('KEY=' + key);
    }

    // ===== MANUAL COMMAND =====
    function sendManual() {
        var input = document.getElementById('manualCmd');
        if (!input) return;
        var cmd = input.value.trim();
        if (cmd && isConnected && writer) {
            var encoder = new TextEncoder();
            writer.write(encoder.encode(cmd));
            logUART('TX', cmd);
            input.value = '';
        }
    }

    // ===== PRESETS GRID (button display) =====
    function initPresets() {
        var grid = document.getElementById('presetsGrid');
        if (!grid) return;

        grid.innerHTML = '';
        var badge = document.getElementById('presetCountBadge');
        if (badge) badge.textContent = PRESETS.length + ' Band Presets';

        for (var idx = 0; idx < PRESETS.length; idx++) {
            (function(i) {
                var p = PRESETS[i];
                var isFirmware = (typeof p.fwIdx === 'number' && p.fwIdx >= 0);
                var btn = document.createElement('button');
                btn.className = 'preset-btn' + (isFirmware ? '' : ' preset-btn-custom');
                btn.title = p.name + ' | ' + fmtFreq(p.fStart) + '-' + fmtFreq(p.fEnd) + ' MHz' +
                    ' | ' + getModLabel(p.mod) + ' | Steps:' + getStepsLabel(p.stepsCount) +
                    ' | Step:' + getStepSizeLabel(p.stepSize) + ' | BW:' + getBwLabel(p.bw) +
                    (isFirmware ? ' | FW#' + p.fwIdx : ' | CUSTOM (reference only)');

                var badgeHtml = isFirmware ? '' : '<span class="preset-custom-badge">CUSTOM</span>';
                btn.innerHTML = '<span class="preset-name">' + p.name + '</span>' +
                    '<span class="preset-freq">' + fmtFreq(p.fStart) + '-' + fmtFreq(p.fEnd) + ' ' + getModLabel(p.mod) + '</span>' +
                    badgeHtml;

                btn.onclick = function() {
                    if (isFirmware) {
                        sendCommand('BAND=' + p.fwIdx);
                    } else {
                        // Custom preset: send individual commands to replicate ApplyPreset
                        // fStart is in firmware units (10Hz). SPEC:FREQ expects Hz, so multiply by 10
                        sendCommand('FREQ=' + (p.fStart * 10));
                        sendCommand('MOD=' + p.mod);
                        sendCommand('BW=' + p.bw);
                        logUART('TX', 'Custom preset "' + p.name + '": FREQ=' + fmtFreq(p.fStart) + ' MHz, MOD=' + getModLabel(p.mod) + ', BW=' + getBwLabel(p.bw));
                        // Highlight custom button
                        btn.style.outline = '2px solid #4caf50';
                        setTimeout(function() { btn.style.outline = ''; }, 1500);
                    }
                };
                grid.appendChild(btn);
            })(idx);
        }
    }

    // ===== PRESET EDITOR =====
    function initPresetEditor() {
        updatePresetStats();
        renderEditorList();
    }

    function updatePresetStats() {
        var total = PRESETS.length;
        var fw = 0, custom = 0;
        var mods = { FM:0, AM:0, USB:0, LSB:0 };

        for (var i = 0; i < total; i++) {
            if (typeof PRESETS[i].fwIdx === 'number' && PRESETS[i].fwIdx >= 0) fw++;
            else custom++;
            var ml = getModLabel(PRESETS[i].mod);
            if (mods.hasOwnProperty(ml)) mods[ml]++;
        }

        var el = function(id, val) {
            var e = document.getElementById(id);
            if (e) e.textContent = val;
        };
        el('peStatTotal', total);
        el('peStatFirmware', fw);
        el('peStatCustom', custom);
        el('peStatMods', 'FM:' + mods.FM + ' AM:' + mods.AM + ' USB:' + mods.USB + ' LSB:' + mods.LSB);
    }

    function renderEditorList(filter) {
        var list = document.getElementById('presetEditorList');
        if (!list) return;
        list.innerHTML = '';
        var filterLc = (filter || '').toLowerCase();

        for (var i = 0; i < PRESETS.length; i++) {
            var p = PRESETS[i];
            var searchStr = (p.name + ' ' + fmtFreq(p.fStart) + ' ' + fmtFreq(p.fEnd) + ' ' + getModLabel(p.mod)).toLowerCase();
            if (filterLc && searchStr.indexOf(filterLc) === -1) continue;

            var isFw = (typeof p.fwIdx === 'number' && p.fwIdx >= 0);
            var row = document.createElement('div');
            row.className = 'preset-editor-row' + (isFw ? ' pe-fw' : ' pe-custom');
            row.setAttribute('data-idx', i);

            row.innerHTML =
                '<span class="pe-pos">' + (i+1) + '/' + PRESETS.length + '</span>' +
                '<span class="pe-type">' + (isFw ? '<span class="pe-badge-fw" title="Firmware preset #' + p.fwIdx + '">FW#' + p.fwIdx + '</span>' : '<span class="pe-badge-custom">CUSTOM</span>') + '</span>' +
                '<span class="pe-name" title="' + p.name + '">' + p.name + '</span>' +
                '<span class="pe-freq">' + fmtFreq(p.fStart) + ' - ' + fmtFreq(p.fEnd) + '</span>' +
                '<span class="pe-detail">' + getModLabel(p.mod) + '</span>' +
                '<span class="pe-detail">' + getStepsLabel(p.stepsCount) + ' steps</span>' +
                '<span class="pe-detail">' + getStepSizeLabel(p.stepSize) + '</span>' +
                '<span class="pe-detail">' + getBwLabel(p.bw) + '</span>' +
                '<span class="pe-actions">' +
                    '<button class="pe-btn pe-up" title="Move Up" onclick="spectrumMovePreset(' + i + ',-1)">\u25B2</button>' +
                    '<button class="pe-btn pe-down" title="Move Down" onclick="spectrumMovePreset(' + i + ',1)">\u25BC</button>' +
                    '<button class="pe-btn pe-del" title="Remove" onclick="spectrumRemovePreset(' + i + ')">\u2715</button>' +
                '</span>';

            list.appendChild(row);
        }
    }

    function movePreset(idx, dir) {
        var newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= PRESETS.length) return;
        var tmp = PRESETS[idx];
        PRESETS[idx] = PRESETS[newIdx];
        PRESETS[newIdx] = tmp;
        savePresets();
        initPresets();
        renderEditorList(document.getElementById('peSearch') ? document.getElementById('peSearch').value : '');
        updatePresetStats();
    }

    function removePreset(idx) {
        if (idx < 0 || idx >= PRESETS.length) return;
        var p = PRESETS[idx];
        if (!confirm('Remove "' + p.name + '"?')) return;
        PRESETS.splice(idx, 1);
        savePresets();
        initPresets();
        renderEditorList(document.getElementById('peSearch') ? document.getElementById('peSearch').value : '');
        updatePresetStats();
    }


    // ===== AUTO-CALCULATE STEPS based on frequency range =====
    // Matches firmware patterns from spectrum.h
    var STEP_SIZES_INTERNAL = [1, 10, 50, 100, 250, 500, 625, 833, 1000, 1250, 1500, 2000, 2500, 5000, 10000];
    var STEPS_COUNTS = [128, 64, 32, 16];

    function autoCalcSteps() {
        var startEl = document.getElementById('peAddStart');
        var endEl = document.getElementById('peAddEnd');
        var stepsEl = document.getElementById('peAddSteps');
        var stepSzEl = document.getElementById('peAddStepSize');
        var modEl = document.getElementById('peAddMod');
        var bwEl = document.getElementById('peAddBW');
        if (!startEl || !endEl || !stepsEl || !stepSzEl) return;

        var s = parseFloat(startEl.value);
        var e = parseFloat(endEl.value);
        if (isNaN(s) || isNaN(e) || e <= s || s < 0.01 || e > 1340) return;

        // Convert MHz to firmware internal units (10 Hz)
        var fStart = Math.round(s * 100000);
        var fEnd = Math.round(e * 100000);
        var span = fEnd - fStart;  // in 10Hz units

        // Find best stepsCount + stepSize combo
        // Goal: stepsCount * stepSize should be close to span
        var bestSteps = 0, bestStep = 12, bestDiff = Infinity;
        for (var si = 0; si < STEPS_COUNTS.length; si++) {
            var sc = STEPS_COUNTS[si];
            var idealStep = span / sc;
            // Find closest step size
            for (var ssi = 0; ssi < STEP_SIZES_INTERNAL.length; ssi++) {
                var ss = STEP_SIZES_INTERNAL[ssi];
                var coverage = sc * ss;
                var diff = Math.abs(coverage - span);
                // Prefer coverage >= span (don't want to miss frequencies)
                if (coverage < span) diff += span * 0.1;  // penalty for under-coverage
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestSteps = si;
                    bestStep = ssi;
                }
            }
        }

        stepsEl.value = bestSteps;
        stepSzEl.value = bestStep;

        // Auto-set modulation and BW based on frequency
        if (modEl && bwEl) {
            if (s >= 87.5 && e <= 118) {
                modEl.value = 0; bwEl.value = 0;  // FM Broadcast: FM + Wide
            } else if (s >= 118 && e <= 138) {
                modEl.value = 1; bwEl.value = 1;  // Airband: AM + Narrow
            } else if (s >= 0.01 && e <= 30) {
                modEl.value = 2; bwEl.value = 2;  // HF: USB + Narrower
            } else if ((s >= 144 && e <= 148) || (s >= 430 && e <= 470)) {
                modEl.value = 0; bwEl.value = 0;  // VHF/UHF Ham: FM + Wide
            } else if (s >= 446 && e <= 446.2) {
                modEl.value = 0; bwEl.value = 1;  // PMR: FM + Narrow
            }
            // Otherwise leave user's selection
        }

        // Show coverage info
        var coverage = STEPS_COUNTS[bestSteps] * STEP_SIZES_INTERNAL[bestStep];
        var coverPct = ((coverage / span) * 100).toFixed(0);
        var infoEl = document.getElementById('peAutoInfo');
        if (infoEl) {
            infoEl.textContent = 'Span: ' + (span / 100000).toFixed(3) + ' MHz | Coverage: ' + coverPct + '%';
            infoEl.style.display = 'block';
        }
    }

    function addPreset() {
        var name = document.getElementById('peAddName');
        var start = document.getElementById('peAddStart');
        var end = document.getElementById('peAddEnd');
        var mod = document.getElementById('peAddMod');
        var steps = document.getElementById('peAddSteps');
        var stepSz = document.getElementById('peAddStepSize');
        var bw = document.getElementById('peAddBW');

        if (!name || !start || !end) return;
        var n = name.value.trim();
        var s = parseFloat(start.value);
        var e = parseFloat(end.value);

        if (!n) { alert('Name is required'); return; }
        if (isNaN(s) || isNaN(e) || s <= 0 || e <= s) { alert('Invalid frequency range'); return; }

        // Convert MHz to firmware format (Hz * 10)
        var fStart = Math.round(s * 100000);
        var fEnd = Math.round(e * 100000);

        PRESETS.push({
            name: n.substring(0, 15),
            fStart: fStart,
            fEnd: fEnd,
            stepsCount: parseInt(steps.value) || 0,
            stepSize: parseInt(stepSz.value) || 12,
            mod: parseInt(mod.value) || 0,
            bw: parseInt(bw.value) || 0,
            fwIdx: -1  // custom
        });

        savePresets();
        initPresets();
        renderEditorList();
        updatePresetStats();

        // Clear form
        name.value = '';
        start.value = '';
        end.value = '';
    }

    function exportPresets() {
        var data = JSON.stringify(PRESETS, null, 2);
        var blob = new Blob([data], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'spectrum_presets_' + new Date().toISOString().slice(0,10) + '.json';
        a.click();
    }

    function importPresets() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(ev) {
            var file = ev.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(re) {
                try {
                    var data = JSON.parse(re.target.result);
                    if (!Array.isArray(data)) { alert('Invalid format: expected array'); return; }

                    // Validate each preset
                    var valid = [];
                    for (var i = 0; i < data.length; i++) {
                        var p = data[i];
                        if (!p.name || typeof p.fStart !== 'number' || typeof p.fEnd !== 'number') {
                            alert('Invalid preset at index ' + i + ': missing name/fStart/fEnd');
                            return;
                        }
                        valid.push({
                            name: String(p.name).substring(0, 15),
                            fStart: p.fStart,
                            fEnd: p.fEnd,
                            stepsCount: (typeof p.stepsCount === 'number') ? p.stepsCount : 0,
                            stepSize: (typeof p.stepSize === 'number') ? p.stepSize : 12,
                            mod: (typeof p.mod === 'number') ? p.mod : 0,
                            bw: (typeof p.bw === 'number') ? p.bw : 0,
                            fwIdx: (typeof p.fwIdx === 'number') ? p.fwIdx : -1
                        });
                    }

                    if (confirm('Import ' + valid.length + ' presets? This will replace all current presets.')) {
                        PRESETS = valid;
                        savePresets();
                        initPresets();
                        renderEditorList();
                        updatePresetStats();
                    }
                } catch(ex) {
                    alert('Error parsing JSON: ' + ex.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function resetPresets() {
        if (!confirm('Reset all presets to the 70 firmware defaults? Custom presets will be lost.')) return;
        resetPresetsToDefaults();
        savePresets();
        initPresets();
        renderEditorList();
        updatePresetStats();
    }

    function filterEditorList() {
        var search = document.getElementById('peSearch');
        renderEditorList(search ? search.value : '');
    }

    // ===== INITIALIZATION =====
    function init() {
        loadPresets();
        initPresets();
        initPresetEditor();

        // Auto-calculate steps when frequency inputs change
        var peStart = document.getElementById('peAddStart');
        var peEnd = document.getElementById('peAddEnd');
        if (peStart) peStart.addEventListener('input', autoCalcSteps);
        if (peEnd) peEnd.addEventListener('input', autoCalcSteps);

        var tabs = document.querySelectorAll('.spectrum-tab');
        for (var i = 0; i < tabs.length; i++) {
            (function(tab) {
                tab.addEventListener('click', function() {
                    var tabName = tab.getAttribute('data-tab');
                    if (tabName) showTab(tabName);
                });
            })(tabs[i]);
        }

        var modeBtns = document.querySelectorAll('.mode-btn');
        for (var j = 0; j < modeBtns.length; j++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    var mode = parseInt(btn.getAttribute('data-mode'));
                    if (!isNaN(mode)) setMode(mode);
                });
            })(modeBtns[j]);
        }
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===== WINDOW EXPORTS =====
    window.spectrumConnect = connect;
    window.spectrumDisconnect = disconnect;
    window.spectrumToggleConnection = toggleConnection;
    window.spectrumSetMode = setMode;
    window.spectrumShowTab = showTab;
    window.spectrumInit = init;
    window.spectrumSendKey = sendKey;
    window.spectrumSendManual = sendManual;
    window.spectrumClearLog = clearLog;
    window.spectrumExportLog = exportLog;
    window.spectrumSendCommand = sendCommand;
    window.spectrumMovePreset = movePreset;
    window.spectrumRemovePreset = removePreset;
    window.spectrumAddPreset = addPreset;
    window.spectrumExportPresets = exportPresets;
    window.spectrumImportPresets = importPresets;
    window.spectrumResetPresets = resetPresets;
    window.spectrumFilterEditorList = filterEditorList;
    window.spectrumAutoCalcSteps = autoCalcSteps;

})();
