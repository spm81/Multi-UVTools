/**
 * RT-880 Flash / Monitor / SPI Backup UI
 * Protocol based on https://github.com/nicsure/RT880-FWFlasher
 * 
 * Flash: 115200 baud - Erase + Write firmware
 * Monitor: 115200 baud - Serial monitor (text/hex)
 * SPI Backup: 230400 baud - Read full 4MB SPI flash
 */

(function() {
    'use strict';

    // State
    let port = null;
    let reader = null;
    let writer = null;
    let isConnected = false;
    let abortRequested = false;
    let firmware = null;
    let firmwareName = '';

    // Constants
    const FLASH_SIZE = 4 * 1024 * 1024; // 4MB SPI flash
    const BLOCK_SIZE = 1024;

    // Preloaded firmwares
    const PRELOADED_FIRMWARES = [
        { name: 'RT-880 V1.15 (2025-06-12)', url: 'https://github.com/nicsure/RT880-FWFlasher/raw/master/RT-880-V1.15_250612.bin' }
    ];

    // DOM Elements
    const getEl = id => document.getElementById(id);

    // Current log target
    let currentLogEl = 'rt880Log';

    // Logging
    function logRt880(msg, type = 'info') {
        const logEl = getEl(currentLogEl);
        if (!logEl) return;
        const time = new Date().toLocaleTimeString('pt-PT');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<span class="log-time">[${time}]</span> ${msg}`;
        logEl.appendChild(entry);
        logEl.scrollTop = logEl.scrollHeight;
    }

    // Clear log
    function clearLog(logId) {
        currentLogEl = logId || 'rt880Log';
        const logEl = getEl(currentLogEl);
        if (logEl) logEl.innerHTML = '';
    }

    // Construct packet with checksum
    function constructPacket(type, address, data) {
        const packet = new Uint8Array(data.length + 4);
        packet[0] = type;
        packet[1] = (address >> 8) & 0xFF;
        packet[2] = address & 0xFF;
        
        for (let i = 0; i < data.length; i++) {
            packet[3 + i] = data[i];
        }
        
        // Checksum: start with 0x52, add all bytes before checksum
        let cs = 0x52;
        for (let i = 0; i < packet.length - 1; i++) {
            cs = (cs + packet[i]) & 0xFF;
        }
        packet[packet.length - 1] = cs;
        
        return packet;
    }

    // Read single byte with timeout
    async function readByte(timeoutMs = 20000) {
        if (!reader) return -1;
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        );
        
        try {
            const result = await Promise.race([
                reader.read(),
                timeoutPromise
            ]);
            
            if (result.done) return -1;
            if (result.value && result.value.length > 0) {
                return result.value[0];
            }
            return -1;
        } catch (e) {
            if (e.message === 'Timeout') return -2;
            return -1;
        }
    }

    // Read multiple bytes
    async function readBytes(count, timeoutMs = 20000) {
        const buffer = [];
        for (let i = 0; i < count; i++) {
            const b = await readByte(timeoutMs);
            if (b < 0) return null;
            buffer.push(b);
        }
        return new Uint8Array(buffer);
    }

    // Write data
    async function writeData(data) {
        if (!writer) return false;
        try {
            await writer.write(data);
            return true;
        } catch (e) {
            logRt880(`Write error: ${e.message}`, 'error');
            return false;
        }
    }

    // Wait for ACK (0x06)
    async function getAck() {
        const b = await readByte();
        if (b === 0x06) return true;
        if (b === -1) logRt880('COM Port read error', 'error');
        else if (b === -2) logRt880('COM Port timeout', 'error');
        else logRt880(`Bad ACK: 0x${b.toString(16).padStart(2, '0')}`, 'error');
        return false;
    }

    // Open serial port
    async function openPort(baudRate) {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none' });
            
            reader = port.readable.getReader();
            writer = port.writable.getWriter();
            isConnected = true;
            
            return true;
        } catch (e) {
            logRt880(`Cannot open port: ${e.message}`, 'error');
            return false;
        }
    }

    // Close port
    async function closePort() {
        try {
            if (reader) {
                await reader.cancel().catch(() => {});
                reader.releaseLock();
                reader = null;
            }
            if (writer) {
                await writer.close().catch(() => {});
                writer.releaseLock();
                writer = null;
            }
            if (port) {
                await port.close().catch(() => {});
                port = null;
            }
        } catch (e) {}
        isConnected = false;
    }

    // Current progress mode
    let progressMode = 'flash';

    // Update progress bar
    function updateProgress(current, total) {
        const pct = Math.round((current / total) * 100);
        const barId = progressMode === 'spi' ? 'rt880SpiProgress' : 'rt880Progress';
        const textId = progressMode === 'spi' ? 'rt880SpiProgressText' : 'rt880ProgressText';
        const bar = getEl(barId);
        const text = getEl(textId);
        if (bar) bar.style.width = `${pct}%`;
        if (text) text.textContent = `${pct}%`;
    }

    // === FLASH FIRMWARE ===
    async function flashFirmware() {
        if (!firmware) {
            logRt880('No firmware loaded', 'error');
            return;
        }

        clearLog('rt880Log');
        progressMode = 'flash';
        logRt880(`Starting flash: ${firmwareName}`);
        logRt880(`Firmware size: ${firmware.length} bytes`);
        logRt880('');
        logRt880('⚠️ Put radio in bootloader mode:');
        logRt880('   Hold PTT + Power ON');
        logRt880('');

        abortRequested = false;
        updateProgress(0, 100);
        setBusy(true);

        if (!await openPort(115200)) {
            setBusy(false);
            return;
        }

        try {
            // Pad firmware to multiple of 1024 bytes
            const paddedLen = Math.ceil(firmware.length / BLOCK_SIZE) * BLOCK_SIZE;
            const paddedFirmware = new Uint8Array(paddedLen);
            paddedFirmware.set(firmware);

            logRt880('Erasing flash...');
            
            // Erase command 1
            let packet = constructPacket(0x39, 0x3305, new Uint8Array([0x10]));
            if (!await writeData(packet)) return;
            if (!await getAck()) return;
            
            // Erase command 2
            if (!await writeData(packet)) return;
            if (!await getAck()) return;
            
            // Erase confirm
            packet = constructPacket(0x39, 0x3305, new Uint8Array([0x55]));
            if (!await writeData(packet)) return;
            if (!await getAck()) return;

            logRt880('Flash erased, writing firmware...');
            
            const totalBlocks = paddedLen / BLOCK_SIZE;
            
            for (let i = 0; i < paddedLen; i += BLOCK_SIZE) {
                if (abortRequested) {
                    logRt880('Flash aborted by user', 'error');
                    return;
                }

                const blockData = paddedFirmware.slice(i, i + BLOCK_SIZE);
                packet = constructPacket(0x57, i, blockData);
                
                if (!await writeData(packet)) return;
                if (!await getAck()) return;
                
                const blockNum = (i / BLOCK_SIZE) + 1;
                updateProgress(blockNum, totalBlocks);
                
                if (blockNum % 10 === 0 || blockNum === totalBlocks) {
                    logRt880(`Block ${blockNum}/${totalBlocks} (0x${i.toString(16).padStart(6, '0')})`);
                }
            }

            // Final ACK
            if (!await getAck()) return;
            
            logRt880('');
            logRt880('✅ Firmware flash completed successfully!', 'success');
            logRt880('Turn off the radio and turn it back on.');

        } catch (e) {
            logRt880(`Flash error: ${e.message}`, 'error');
        } finally {
            await closePort();
            setBusy(false);
        }
    }

    // === SERIAL MONITOR ===
    let monitorRunning = false;

    async function startMonitor() {
        if (monitorRunning) return;

        clearLog();
        logRt880('Starting serial monitor at 115200 baud...');
        logRt880('Press Stop to end monitoring.');
        logRt880('---');

        abortRequested = false;
        setBusy(true, 'monitor');
        
        if (!await openPort(115200)) {
            setBusy(false);
            return;
        }

        monitorRunning = true;
        const textMode = getEl('rt880MonitorTextMode')?.checked ?? true;
        const monitorOutput = getEl('rt880MonitorOutput');
        if (monitorOutput) monitorOutput.textContent = '';

        try {
            while (!abortRequested && isConnected) {
                const b = await readByte(1000);
                if (b === -1) break;
                if (b === -2) continue; // Timeout, keep waiting
                
                if (monitorOutput) {
                    if (textMode) {
                        if (b === 0) {
                            monitorOutput.textContent += '\n';
                        } else if (b >= 32 && b <= 126) {
                            monitorOutput.textContent += String.fromCharCode(b);
                        } else {
                            monitorOutput.textContent += '.';
                        }
                    } else {
                        monitorOutput.textContent += b.toString(16).padStart(2, '0').toUpperCase() + ' ';
                    }
                    monitorOutput.scrollTop = monitorOutput.scrollHeight;
                }
            }
        } catch (e) {
            if (!abortRequested) {
                logRt880(`Monitor error: ${e.message}`, 'error');
            }
        } finally {
            monitorRunning = false;
            await closePort();
            setBusy(false);
            logRt880('---');
            logRt880('Monitor stopped.');
        }
    }

    function stopMonitor() {
        abortRequested = true;
    }

    // === SPI BACKUP ===
    async function startSpiBackup() {
        clearLog('rt880SpiLog');
        progressMode = 'spi';
        logRt880('Starting SPI Backup at 230400 baud...');
        logRt880(`Total size: ${FLASH_SIZE / 1024 / 1024}MB (${FLASH_SIZE / BLOCK_SIZE} blocks)`);
        logRt880('');
        logRt880('⚠️ Flash special firmware to radio that sends SPI data.');
        logRt880('   Or use custom bootloader with SPI dump feature.');
        logRt880('');

        abortRequested = false;
        updateProgress(0, 100);
        setBusy(true);

        if (!await openPort(230400)) {
            setBusy(false);
            return;
        }

        const spiData = new Uint8Array(FLASH_SIZE);
        let addr = 0;

        try {
            logRt880('Waiting for radio to send SPI data...');

            while (addr < FLASH_SIZE && !abortRequested) {
                // Look for header: 0xAA 0x30
                let b = await readByte(5000);
                if (b === -2) continue; // Timeout, keep waiting
                if (b === -1) break;
                if (b !== 0xAA) continue;

                b = await readByte();
                if (b !== 0x30) continue;

                // Read 4-byte address (little endian)
                const addrBytes = await readBytes(4);
                if (!addrBytes) break;
                
                let raddr = addrBytes[0] | (addrBytes[1] << 8) | (addrBytes[2] << 16) | (addrBytes[3] << 24);
                
                // Verify address matches expected
                if (raddr !== addr) continue;

                // Calculate checksum from address bytes
                let cs = addrBytes.reduce((sum, b) => (sum + b) & 0xFF, 0);

                // Read 1024 bytes of data
                const blockData = await readBytes(BLOCK_SIZE);
                if (!blockData) break;

                // Add data to checksum
                cs = blockData.reduce((sum, b) => (sum + b) & 0xFF, cs);

                // Read checksum byte
                const rcs = await readByte();
                if (rcs < 0) break;

                // Read trailer 0x55
                b = await readByte();
                if (b !== 0x55) continue;

                // Verify checksum
                if (cs !== rcs) {
                    logRt880(`Checksum error at 0x${raddr.toString(16).padStart(8, '0')}`, 'error');
                    continue;
                }

                // Store data
                spiData.set(blockData, addr);
                addr += BLOCK_SIZE;

                updateProgress(addr, FLASH_SIZE);
                
                const blockNum = addr / BLOCK_SIZE;
                if (blockNum % 100 === 0) {
                    logRt880(`Block ${blockNum}/${FLASH_SIZE / BLOCK_SIZE} (0x${raddr.toString(16).padStart(8, '0')})`);
                }
            }

            if (addr >= FLASH_SIZE) {
                logRt880('');
                logRt880('✅ SPI Backup completed!', 'success');
                
                // Save file
                const blob = new Blob([spiData], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `RT880_SPI_Backup_${new Date().toISOString().slice(0,10)}.880spi`;
                a.click();
                URL.revokeObjectURL(url);
                
                logRt880('File saved: RT880_SPI_Backup_*.880spi');
            } else if (abortRequested) {
                logRt880('SPI Backup aborted by user', 'error');
            } else {
                logRt880(`SPI Backup incomplete: ${addr / BLOCK_SIZE}/${FLASH_SIZE / BLOCK_SIZE} blocks`, 'error');
            }

        } catch (e) {
            logRt880(`SPI Backup error: ${e.message}`, 'error');
        } finally {
            await closePort();
            setBusy(false);
        }
    }

    // === FIRMWARE LOADING ===
    function populateFirmwareSelect() {
        const select = getEl('rt880FirmwareSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Select Firmware --</option>';
        PRELOADED_FIRMWARES.forEach((fw, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = fw.name;
            select.appendChild(opt);
        });
    }

    async function loadPreloadedFirmware() {
        const select = getEl('rt880FirmwareSelect');
        if (!select || select.value === '') return;
        
        const fw = PRELOADED_FIRMWARES[parseInt(select.value)];
        if (!fw) return;
        
        logRt880(`Loading: ${fw.name}...`);
        
        try {
            const response = await fetch(fw.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            firmware = new Uint8Array(await response.arrayBuffer());
            firmwareName = fw.name;
            
            logRt880(`Firmware loaded: ${firmwareName} (${firmware.length} bytes)`, 'success');
            getEl('rt880FlashBtn')?.removeAttribute('disabled');
        } catch (e) {
            logRt880(`Failed to load firmware: ${e.message}`, 'error');
        }
    }

    async function loadFirmwareFromUrl() {
        const input = getEl('rt880FirmwareUrl');
        if (!input || !input.value.trim()) return;
        
        const url = input.value.trim();
        logRt880(`Loading from URL: ${url}...`);
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            firmware = new Uint8Array(await response.arrayBuffer());
            firmwareName = url.split('/').pop() || 'firmware.bin';
            
            logRt880(`Firmware loaded: ${firmwareName} (${firmware.length} bytes)`, 'success');
            getEl('rt880FlashBtn')?.removeAttribute('disabled');
        } catch (e) {
            logRt880(`Failed to load firmware: ${e.message}`, 'error');
        }
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = () => {
            firmware = new Uint8Array(reader.result);
            firmwareName = file.name;
            logRt880(`Firmware loaded: ${firmwareName} (${firmware.length} bytes)`, 'success');
            getEl('rt880FlashBtn')?.removeAttribute('disabled');
        };
        reader.onerror = () => {
            logRt880('Failed to read firmware file', 'error');
        };
        reader.readAsArrayBuffer(file);
    }

    // === UI STATE ===
    function setBusy(busy, mode = 'flash') {
        const flashBtn = getEl('rt880FlashBtn');
        const abortBtn = getEl('rt880AbortBtn');
        const monitorBtn = getEl('rt880MonitorBtn');
        const monitorStopBtn = getEl('rt880MonitorStopBtn');
        const spiBtn = getEl('rt880SpiBtn');
        const fileInput = getEl('rt880FileInput');
        const fwSelect = getEl('rt880FirmwareSelect');
        const urlInput = getEl('rt880FirmwareUrl');
        const urlBtn = getEl('rt880LoadUrlBtn');

        if (flashBtn) flashBtn.disabled = busy;
        if (spiBtn) spiBtn.disabled = busy;
        if (fileInput) fileInput.disabled = busy;
        if (fwSelect) fwSelect.disabled = busy;
        if (urlInput) urlInput.disabled = busy;
        if (urlBtn) urlBtn.disabled = busy;

        if (mode === 'monitor') {
            if (monitorBtn) monitorBtn.disabled = busy;
            if (monitorStopBtn) monitorStopBtn.disabled = !busy;
        } else {
            if (monitorBtn) monitorBtn.disabled = busy;
            if (monitorStopBtn) monitorStopBtn.disabled = true;
            if (abortBtn) abortBtn.disabled = !busy;
        }
    }

    function abort() {
        abortRequested = true;
        closePort();
    }

    // === TABS ===
    function showTab(tabId) {
        document.querySelectorAll('.rt880-tab-content').forEach(el => {
            el.classList.remove('active');
        });
        document.querySelectorAll('.rt880-tab-btn').forEach(el => {
            el.classList.remove('active');
        });
        
        const content = getEl(tabId);
        if (content) content.classList.add('active');
        
        document.querySelectorAll(`.rt880-tab-btn[data-tab="${tabId}"]`).forEach(el => {
            el.classList.add('active');
        });
    }

    // === INIT ===
    function init() {
        logRt880('RT-880 Tools ready.');
        logRt880('Functions: Flash | Monitor | SPI Backup');
        
        populateFirmwareSelect();
        setBusy(false);

        // Event listeners
        const fileInput = getEl('rt880FileInput');
        if (fileInput) fileInput.addEventListener('change', handleFileSelect);
        
        const fwSelect = getEl('rt880FirmwareSelect');
        if (fwSelect) fwSelect.addEventListener('change', loadPreloadedFirmware);
        
        // Tab switching
        document.querySelectorAll('.rt880-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => showTab(btn.dataset.tab));
        });
    }

    // Export functions
    window.rt880Init = init;
    window.rt880Flash = flashFirmware;
    window.rt880Abort = abort;
    window.rt880StartMonitor = startMonitor;
    window.rt880StopMonitor = stopMonitor;
    window.rt880StartSpiBackup = startSpiBackup;
    window.rt880LoadUrl = loadFirmwareFromUrl;
    window.rt880ShowTab = showTab;

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }
})();
