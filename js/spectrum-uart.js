// =====================================================
// SPECTRUM UART v12.20 - Complete Implementation
// For MCFW v1.35.1D firmware
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

    // ===== 70 PRESETS (from spectrum.h - EXACT) =====
    const PRESETS = [
        {name: "17m Ham Band", start: 18.06800, end: 18.89999, mod: "USB"},
        {name: "15m Broadcast", start: 18.90000, end: 20.99999, mod: "AM"},
        {name: "15m Ham Band", start: 21.00000, end: 21.44999, mod: "USB"},
        {name: "13m Broadcast", start: 21.45000, end: 24.88999, mod: "AM"},
        {name: "12m Ham Band", start: 24.89000, end: 25.66999, mod: "USB"},
        {name: "11m Broadcast", start: 25.67000, end: 26.97499, mod: "AM"},
        {name: "CB", start: 26.97500, end: 27.99999, mod: "FM"},
        {name: "10m Ham Band", start: 28.00000, end: 49.99999, mod: "USB"},
        {name: "6m Ham Band", start: 50.00000, end: 54.49999, mod: "USB"},
        {name: "Volmet Aviation", start: 54.50000, end: 77.49999, mod: "AM"},
        {name: "Time Signals", start: 77.50000, end: 87.49999, mod: "AM"},
        {name: "FM Broadcast EU", start: 87.50000, end: 117.99999, mod: "FM"},
        {name: "Airband Tower", start: 118.00000, end: 120.99999, mod: "AM"},
        {name: "Air Band Voice", start: 118.00000, end: 120.99999, mod: "AM"},
        {name: "Airband Ground", start: 121.00000, end: 126.99999, mod: "AM"},
        {name: "Airband ATIS", start: 127.00000, end: 137.99999, mod: "AM"},
        {name: "FEMA", start: 138.00000, end: 138.99999, mod: "FM"},
        {name: "MARS", start: 139.00000, end: 143.99999, mod: "USB"},
        {name: "2m Ham Band", start: 144.00000, end: 144.29999, mod: "FM"},
        {name: "YSF/WIRES-X", start: 144.00000, end: 144.29999, mod: "FM"},
        {name: "RSGB Test", start: 144.30000, end: 144.99999, mod: "FM"},
        {name: "D-Star", start: 145.00000, end: 145.79999, mod: "FM"},
        {name: "ISS Packet", start: 145.80000, end: 146.51999, mod: "FM"},
        {name: "ARRL Test", start: 146.52000, end: 147.99999, mod: "FM"},
        {name: "CAP", start: 148.00000, end: 151.74999, mod: "FM"},
        {name: "Railway", start: 151.75000, end: 151.99999, mod: "FM"},
        {name: "Taxi USA/Bus", start: 152.00000, end: 153.99999, mod: "FM"},
        {name: "USA Fire", start: 154.00000, end: 154.99999, mod: "FM"},
        {name: "USA EMS", start: 155.00000, end: 155.99999, mod: "FM"},
        {name: "USA Police", start: 155.00000, end: 155.99999, mod: "FM"},
        {name: "Marine Intl", start: 156.00000, end: 156.79999, mod: "FM"},
        {name: "Sea", start: 156.00000, end: 156.79999, mod: "FM"},
        {name: "Marine VHF CH16", start: 156.80000, end: 159.99999, mod: "FM"},
        {name: "Marine USA", start: 160.00000, end: 160.99999, mod: "FM"},
        {name: "Weather Canada", start: 161.00000, end: 162.39999, mod: "FM"},
        {name: "EAS", start: 162.40000, end: 164.99999, mod: "FM"},
        {name: "NOAA Weather", start: 162.40000, end: 164.99999, mod: "FM"},
        {name: "Taxi UK", start: 165.00000, end: 167.99999, mod: "FM"},
        {name: "UK Emergency", start: 165.00000, end: 167.99999, mod: "FM"},
        {name: "ROB - Bombeiros", start: 168.00000, end: 221.99999, mod: "FM"},
        {name: "1.25m Ham", start: 222.00000, end: 224.99999, mod: "FM"},
        {name: "Military Air", start: 225.00000, end: 242.99999, mod: "AM"},
        {name: "Satcom", start: 243.00000, end: 254.99999, mod: "FM"},
        {name: "Satcom II", start: 255.00000, end: 300.01249, mod: "FM"},
        {name: "River1", start: 300.01250, end: 336.01249, mod: "FM"},
        {name: "River2", start: 336.01250, end: 429.99999, mod: "FM"},
        {name: "70cm Ham Band L", start: 430.00000, end: 433.04999, mod: "FM"},
        {name: "DMR Europe", start: 430.00000, end: 433.04999, mod: "FM"},
        {name: "ISM 433 MHz", start: 433.05000, end: 435.99999, mod: "FM"},
        {name: "LPD/LoRa 433", start: 433.05000, end: 435.99999, mod: "FM"},
        {name: "CubeSats", start: 436.00000, end: 437.79999, mod: "FM"},
        {name: "ISS Voice", start: 437.80000, end: 437.99999, mod: "FM"},
        {name: "70cm Ham Band H", start: 438.00000, end: 439.99999, mod: "FM"},
        {name: "MOV/SMT", start: 440.00000, end: 446.00624, mod: "FM"},
        {name: "PMR446", start: 446.00625, end: 446.19999, mod: "FM"},
        {name: "MOV/SMT 2", start: 446.20000, end: 449.99999, mod: "FM"},
        {name: "Business Radio", start: 450.00000, end: 457.62499, mod: "FM"},
        {name: "CP - C.Portugal", start: 457.62500, end: 462.56249, mod: "FM"},
        {name: "FRS/GMRS 462", start: 462.56250, end: 467.56249, mod: "FM"},
        {name: "FRS/GMRS 467", start: 467.56250, end: 469.99999, mod: "FM"},
        {name: "Industrial", start: 470.00000, end: 863.99999, mod: "FM"},
        {name: "LoRa WAN", start: 864.00000, end: 867.99999, mod: "FM"},
        {name: "ISM 868 MHz EU", start: 868.00000, end: 868.09999, mod: "FM"},
        {name: "LoRa 868 MHz", start: 868.10000, end: 889.99999, mod: "FM"},
        {name: "GSM900 UP", start: 890.00000, end: 901.99999, mod: "FM"},
        {name: "33cm Ham", start: 902.00000, end: 934.99999, mod: "FM"},
        {name: "ISM 915 MHz", start: 902.00000, end: 934.99999, mod: "FM"},
        {name: "GSM900 DOWN", start: 935.00000, end: 1079.99999, mod: "FM"},
        {name: "Aeronautical Nav", start: 1080.00000, end: 1239.99999, mod: "AM"},
        {name: "23cm Ham Band", start: 1240.00000, end: 1300.00000, mod: "FM"}
    ];


    // ===== CONNECTION FUNCTIONS =====
    async function connect() {
        try {
            port = await navigator.serial.requestPort();
            const baudSelect = document.getElementById('spectrumBaudRate');
            const baud = baudSelect ? parseInt(baudSelect.value) : 38400;
            await port.open({ baudRate: baud });
            
            writer = port.writable.getWriter();
            reader = port.readable.getReader();
            
            isConnected = true;
            updateConnectionUI(true);
            
            // Start reading
            readLoop();
            
            // Start status polling every 2 seconds
            statusInterval = setInterval(() => {
                if (isConnected) sendCommand('STATUS');
            }, 2000);
            
            // Initial status request
            setTimeout(() => sendCommand('STATUS'), 500);
            
            logUART('INFO', 'Connected at ' + baud + ' baud');
            
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
            if (reader) { 
                await reader.cancel();
                reader.releaseLock(); 
                reader = null; 
            }
            if (writer) { 
                writer.releaseLock(); 
                writer = null; 
            }
            if (port) { 
                await port.close(); 
                port = null; 
            }
        } catch (e) {
            console.error('Disconnect error:', e);
        }
        updateConnectionUI(false);
        logUART('INFO', 'Disconnected');
    }

    function toggleConnection() {
        if (isConnected) {
            disconnect();
        } else {
            connect();
        }
    }

    function updateConnectionUI(connected) {
        const indicator = document.getElementById('spectrumStatusIndicator');
        const text = document.getElementById('spectrumStatusText');
        const btn = document.getElementById('spectrumConnectBtn');
        
        if (indicator) indicator.classList.toggle('connected', connected);
        if (text) text.textContent = connected ? 'Connected' : 'Disconnected';
        if (btn) {
            btn.textContent = connected ? '🔌 Disconnect' : '🔌 Connect';
            btn.className = 'btn ' + (connected ? 'btn-disconnect' : 'btn-connect');
        }
    }

    // ===== READ LOOP =====
    async function readLoop() {
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (isConnected && reader) {
            try {
                const { value, done } = await reader.read();
                if (done) break;
                
                const text = decoder.decode(value).replace(/[^\x20-\x7E\r\n]/g, '');
                buffer += text;
                
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.trim()) {
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
        
        const fullCmd = 'SPEC:' + cmd + ']';
        try {
            const encoder = new TextEncoder();
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
            const th = parseInt(line.substring(line.indexOf('SPEC:TH,') + 8));
            if (!isNaN(th)) {
                currentThreshold = th;
                const thDbm = (th / 2) - 160;
                logUART('RX', 'Threshold: ' + th + ' raw (' + thDbm.toFixed(1) + ' dBm)');
            }
        }
    }

    function parseStatus(line) {
        const idx = line.indexOf('SPEC:ST,');
        if (idx === -1) return;
        
        const parts = line.substring(idx + 8).split(',');
        let mode = -1, freq = 0, rssi = 0, mod = '---', ch = '', tone = '';
        
        // SPEC:ST,mode,freq,rssi,mod,TONE (5 fields, NO channel)
        if (parts.length >= 1) mode = parseInt(parts[0]) || 0;
        if (parts.length >= 2) freq = parseInt(parts[1]) || 0;
        if (parts.length >= 3) rssi = parseInt(parts[2]) || 0;
        if (parts.length >= 4) mod = parts[3] || '---';
        if (parts.length >= 5) tone = parts[4] || '';  // Tone is 5th field (index 4)
        
        currentTone = tone || "N";
        
        // If STATUS has a valid tone, update recent log entries with "N" tone
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
        const idx = line.indexOf('SPEC:PK,');
        if (idx === -1) return;
        
        const parts = line.substring(idx + 8).split(',');
        if (parts.length >= 3) {
            const freq = parseInt(parts[0]) || 0;
            const rssi = parseInt(parts[1]) || 0;
            const mod = parts[2] || '';
            
            if (freq > 0) {
                const freqMHz = freq / 100000;
                const rssiDbm = (rssi / 2) - 160;
                addToLog(freqMHz, rssiDbm, mod, 'PEAK');
            }
        }
    }

    function parseMode(line) {
        const idx = line.indexOf('SPEC:M=');
        if (idx === -1) return;
        
        const mode = parseInt(line.substring(idx + 7));
        if (!isNaN(mode) && mode >= 0 && mode <= 4) {
            currentMode = mode;
            updateModeButtons(mode);
            if (mode === 4) {
                setTimeout(function() { sendCommand('PROFSTAT'); }, 100);
            }
        }
    }

    function parseTriggerFreq(line) {
        const idx = line.indexOf('SPEC:TR,');
        if (idx === -1) return;
        
        const data = line.substring(idx + 8);
        const parts = data.split(',');
        if (parts.length < 2) return;
        
        const freq = parseInt(parts[0]);
        const rssiDbm = parseInt(parts[1]);
        let tone = parts.length >= 3 ? parts[2].trim() : 'N';
        if (tone === 'N' && currentTone !== 'N') tone = currentTone;
        
        if (isNaN(freq) || isNaN(rssiDbm)) return;
        
        const freqMHz = freq / 100000;
        
        const now = Date.now();
        const freqChanged = Math.abs(freq - lastLoggedFreq) > 1000;
        const timePassed = now - lastLoggedTime > 3000;
        
        if (freqChanged || timePassed) {
            addToLog(freqMHz, rssiDbm, '---', 'TRIG ' + tone);
            lastLoggedFreq = freq;
            lastLoggedTime = now;
        }
    }

    function parseTriggerChannel(line) {
        const match = line.match(/M:(\d+),FREQ:(\d+),RSSI:(-?\d+)/);
        if (!match) return;
        
        const ch = parseInt(match[1]);
        const freq = parseInt(match[2]);
        const rssiDbm = parseInt(match[3]);
        
        const freqMHz = freq / 100000;
        
        const now = Date.now();
        const freqChanged = Math.abs(freq - lastLoggedFreq) > 1000;
        const timePassed = now - lastLoggedTime > 3000;
        
        if (freqChanged || timePassed) {
            addToLog(freqMHz, rssiDbm, '---', 'CH' + ch);
            lastLoggedFreq = freq;
            lastLoggedTime = now;
        }
    }

    function parseChannel(line) {
        const idx = line.indexOf('SPEC:C,');
        if (idx === -1) return;
        
        const parts = line.substring(idx + 7).split(',');
        if (parts.length < 4) return;
        
        const chNum = parts[0];
        const chName = parts[1];
        const rssi = parseInt(parts[2]) || 0;
        const tone = parts[3];
        
        let chDisplay = 'CH ' + chNum;
        if (chName && chName !== '-') chDisplay += ' (' + chName + ')';
        
        const chEl = document.getElementById('channelValue');
        if (chEl) chEl.textContent = chDisplay;
    }

    function parseFreqIn(line) {
        const idx = line.indexOf('SPEC:FI,');
        if (idx === -1) return;
        
        const parts = line.substring(idx + 8).split(',');
        const min = parseInt(parts[0]) || 0;
        const max = parseInt(parts[1]) || 0;
        
        const display = document.getElementById('freqInputDisplay');
        if (display) {
            display.textContent = 'Range: ' + (min/100000).toFixed(3) + ' - ' + (max/100000).toFixed(3) + ' MHz';
        }
    }

    function parseFreqKey(line) {
        const idx = line.indexOf('SPEC:FK,');
        if (idx === -1) return;
        
        const parts = line.substring(idx + 8).split(',');
        const str = parts[0] || '';
        
        const display = document.getElementById('freqInputDisplay');
        if (display) display.textContent = str || '0.00000';
    }

    function parseFreqOk(line) {
        const idx = line.indexOf('SPEC:FO,');
        if (idx === -1) return;
        
        const freq = parseInt(line.substring(idx + 8)) || 0;
        const display = document.getElementById('freqInputDisplay');
        if (display) {
            display.textContent = '✓ ' + (freq/100000).toFixed(5) + ' MHz';
            display.style.color = '#4caf50';
            setTimeout(function() { display.textContent = '0.00000'; display.style.color = ''; }, 2000);
        }
    }

    function parseFreqErr(line) {
        const display = document.getElementById('freqInputDisplay');
        if (display) {
            display.textContent = '✗ Out of range';
            display.style.color = '#f44336';
            setTimeout(function() { display.textContent = '0.00000'; display.style.color = ''; }, 2000);
        }
    }

    function parseFreqCancel() {
        const display = document.getElementById('freqInputDisplay');
        if (display) {
            display.textContent = 'Cancelled';
            display.style.color = '#ff9800';
            setTimeout(function() { display.textContent = '0.00000'; display.style.color = ''; }, 2000);
        }
    }

    function parseProfStatus(line) {
        const idx = line.indexOf('SPEC:PS,');
        if (idx === -1) return;
        
        const data = line.substring(idx + 8);
        let smooth = '--', autotrig = '--', horizon = '--', bandled = '--';
        let mountain = '--', heli = '--', sugar = '--';
        
        const matches = data.match(/SMOOTH=(\d),AUTO=(\d),HORIZ=(\d),LED=(\d),MOUNT=(\d),HELI=(\d),SUGAR=(\d)/);
        if (matches) {
            smooth = matches[1] === '1' ? 'ON' : 'OFF';
            autotrig = matches[2] === '1' ? 'ON' : 'OFF';
            horizon = matches[3] === '1' ? 'ON' : 'OFF';
            bandled = matches[4] === '1' ? 'ON' : 'OFF';
            mountain = matches[5] === '1' ? 'ON' : 'OFF';
            heli = matches[6] === '1' ? 'ON' : 'OFF';
            sugar = matches[7] === '1' ? 'ON' : 'OFF';
        }
        
        const proStatus = document.getElementById('proStatus');
        if (proStatus) {
            var onColor = '#4caf50';
            var offColor = '#f44336';
            proStatus.innerHTML = 
                '<span style="color:' + (smooth==='ON'?onColor:offColor) + '">Smooth:' + smooth + '</span> | ' +
                '<span style="color:' + (autotrig==='ON'?onColor:offColor) + '">AutoTrig:' + autotrig + '</span> | ' +
                '<span style="color:' + (horizon==='ON'?onColor:offColor) + '">Horizon:' + horizon + '</span> | ' +
                '<span style="color:' + (bandled==='ON'?onColor:offColor) + '">BandLED:' + bandled + '</span> | ' +
                '<span style="color:' + (mountain==='ON'?onColor:offColor) + '">Mountain:' + mountain + '</span> | ' +
                '<span style="color:' + (heli==='ON'?onColor:offColor) + '">Heli:' + heli + '</span> | ' +
                '<span style="color:' + (sugar==='ON'?onColor:offColor) + '">Sugar:' + sugar + '</span>';
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
        
        if (freqEl && freq > 0) {
            var freqMHz = freq / 100000;
            freqEl.textContent = freqMHz.toFixed(5) + ' MHz';
        }
        
        if (rssiEl && rssi > 0) {
            var rssiDbm = (rssi / 2) - 160;
            rssiEl.textContent = rssiDbm.toFixed(1) + ' dBm';
            rssiEl.style.color = rssiDbm > -90 ? '#4caf50' : rssiDbm > -110 ? '#ff9800' : '#f44336';
        }
        
        if (modEl) modEl.textContent = mod || '---';
        
        var chToneText = '---';
        if (ch && ch !== 'N') {
            chToneText = ch;
            if (tone && tone !== 'N' && tone !== ch) chToneText += ' / ' + tone;
        } else if (tone && tone !== 'N') {
            chToneText = tone;
        }
        if (chEl) chEl.textContent = chToneText;
    }

    function updateModeButtons(mode) {
        for (var i = 0; i <= 4; i++) {
            var btn = document.getElementById('modeBtn' + i);
            if (btn) {
                if (i === mode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        }
    }

    // ===== LOGGING =====
    function addToLog(freq, rssi, mod, extra) {
        var now = new Date();
        var entry = {
            time: now.toLocaleTimeString(),
            date: now.toLocaleDateString(),
            freq: freq.toFixed(5),
            rssi: rssi.toFixed(1),
            mod: mod,
            extra: extra || "",
            ctcss: (extra && extra.startsWith("TRIG ")) ? extra.substring(5) : "N"
        };
        
        peakLog.unshift(entry);
        if (peakLog.length > 500) peakLog.pop();
        updateLogDisplay();
    }

    function updateLogDisplay() {
        var container = document.getElementById('logContainer');
        if (!container) return;
        
        if (peakLog.length === 0) {
            container.innerHTML = '<div class="log-empty">No peaks logged yet</div>';
        } else {
            var html = '';
            var count = Math.min(peakLog.length, 100);
            for (var i = 0; i < count; i++) {
                var e = peakLog[i];
                html += '<div class="log-entry">' +
                    '<span class="log-time">' + e.time + '</span>' +
                    '<span class="log-freq">' + e.freq + ' MHz</span>' +
                    '<span class="log-rssi">' + e.rssi + ' dBm</span>' +
                    '<span class="log-mod">' + e.mod + '</span>' +
                    '<span class="log-ctcss">' + (e.ctcss || 'N') + '</span>' +
                    '<span class="log-extra">' + (e.extra ? '🎯' : '') + '</span>' +
                    '</div>';
            }
            container.innerHTML = html;
        }
    }

    function exportLog(format) {
        if (peakLog.length === 0) {
            alert('No data to export');
            return;
        }
        
        var content, filename, type;
        if (format === 'json') {
            content = JSON.stringify(peakLog, null, 2);
            filename = 'spectrum_log_' + Date.now() + '.json';
            type = 'application/json';
        } else {
            var header = 'Time,Frequency (MHz),RSSI (dBm),Modulation,CTCSS/DCS\n';
            var rows = [];
            for (var i = 0; i < peakLog.length; i++) {
                var e = peakLog[i];
                rows.push(e.time + ',' + e.freq + ',' + e.rssi + ',' + e.mod + ',' + (e.ctcss || 'N'));
            }
            content = header + rows.join('\n');
            filename = 'spectrum_log_' + Date.now() + '.csv';
            type = 'text/csv';
        }
        
        var blob = new Blob([content], { type: type });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function clearLog() {
        if (confirm('Clear all logged peaks?')) {
            peakLog = [];
            updateLogDisplay();
        }
    }

    // ===== UART LOG =====
    function logUART(type, msg) {
        var log = document.getElementById('uartLog');
        if (!log) return;
        
        var time = new Date().toLocaleTimeString();
        var className = type === 'TX' ? 'uart-tx' : (type === 'ERR' ? 'uart-err' : 'uart-rx');
        var entry = document.createElement('div');
        entry.className = className;
        entry.textContent = '[' + time + '] ' + type + ': ' + msg;
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
        
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.remove('active');
        }
        for (var j = 0; j < contents.length; j++) {
            contents[j].classList.remove('active');
        }
        
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

    // ===== PRESETS =====
    function initPresets() {
        var grid = document.getElementById('presetsGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        for (var idx = 0; idx < PRESETS.length; idx++) {
            (function(i) {
                var p = PRESETS[i];
                var btn = document.createElement('button');
                btn.className = 'preset-btn';
                btn.innerHTML = '<span class="preset-name">' + p.name + '</span><span class="preset-freq">' + p.start.toFixed(3) + '-' + p.end.toFixed(3) + ' ' + p.mod + '</span>';
                btn.onclick = function() { sendCommand('BAND=' + i); };
                grid.appendChild(btn);
            })(idx);
        }
    }

    // ===== INITIALIZATION =====
    function init() {
        initPresets();
        
        var tabs = document.querySelectorAll('.spectrum-tab');
        for (var i = 0; i < tabs.length; i++) {
            (function(tab) {
                tab.addEventListener('click', function() {
                    var tabName = tab.getAttribute('data-tab');
                    if (tabName) showTab(tabName);
                });
            })(tabs[i]);
        }
        
        var connectBtn = document.getElementById('spectrumConnectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', toggleConnection);
        }
        
        var manualInput = document.getElementById('manualCmd');
        if (manualInput) {
            manualInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') sendManual();
            });
        }
        
        updateLogDisplay();
        
        console.log('Spectrum UART v12.20 initialized');
    }

    // ===== EXPOSE TO WINDOW =====
    window.spectrumConnect = connect;
    window.spectrumDisconnect = disconnect;
    window.spectrumToggleConnection = toggleConnection;
    window.spectrumSendCommand = sendCommand;
    window.spectrumSetMode = setMode;
    window.spectrumShowTab = showTab;
    window.spectrumSendKey = sendKey;
    window.spectrumSendManual = sendManual;
    window.spectrumExportLog = exportLog;
    window.spectrumClearLog = clearLog;
    window.spectrumInit = init;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

})();
