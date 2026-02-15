/**
 * RT-890 Tools UI Module for separate pages
 */

class RT890ToolsUI {
    constructor() {
        this.spi = null;
        this.backupData = null;
        this.calibFileData = null;
        this.isCalibOperation = false;
        this.elements = {};
    }
    
    init() {
        if (typeof RT890SPIFlash !== 'undefined') {
            this.spi = new RT890SPIFlash();
            this.spi.onProgress = this.handleProgress.bind(this);
            this.spi.onStatus = this.handleStatus.bind(this);
            this.spi.onError = this.handleError.bind(this);
            this.spi.onComplete = this.handleComplete.bind(this);
        }
        
        this.initElements();
        this.bindEvents();
        console.log('[RT890 Tools UI] Initialized');
    }
    
    initElements() {
        this.elements = {
            baudSelect: document.getElementById('spiBaudRate2'),
            backupBtn: document.getElementById('spiBackupBtn2'),
            restoreBtn: document.getElementById('spiRestoreBtn2'),
            cancelBtn: document.getElementById('spiCancelBtn2'),
            restoreFileInput: document.getElementById('spiRestoreFile2'),
            progressBar: document.getElementById('spiProgressBar2'),
            progressText: document.getElementById('spiProgressText2'),
            progressPct: document.getElementById('spiProgressPct2'),
            statusLog: document.getElementById('spiStatusLog2'),
            calibBaudSelect: document.getElementById('spiCalibBaudRate2'),
            dumpCalibBtn: document.getElementById('spiDumpCalibBtn2'),
            restoreCalibBtn: document.getElementById('spiRestoreCalibBtn2'),
            restoreCalibFileInput: document.getElementById('spiRestoreCalibFile2'),
            calibProgressBar: document.getElementById('spiCalibProgressBar2'),
            calibProgressText: document.getElementById('spiCalibProgressText2'),
            calibProgressPct: document.getElementById('spiCalibProgressPct2'),
            calibStatusLog: document.getElementById('spiCalibStatusLog2')
        };
    }
    
    bindEvents() {
        if (this.elements.backupBtn) this.elements.backupBtn.addEventListener('click', () => this.startBackup());
        if (this.elements.restoreBtn) this.elements.restoreBtn.addEventListener('click', () => this.startRestore());
        if (this.elements.cancelBtn) this.elements.cancelBtn.addEventListener('click', () => this.cancelOperation());
        if (this.elements.restoreFileInput) this.elements.restoreFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        if (this.elements.dumpCalibBtn) this.elements.dumpCalibBtn.addEventListener('click', () => this.startDumpCalibration());
        if (this.elements.restoreCalibBtn) this.elements.restoreCalibBtn.addEventListener('click', () => this.startRestoreCalibration());
        if (this.elements.restoreCalibFileInput) this.elements.restoreCalibFileInput.addEventListener('change', (e) => this.handleCalibFileSelect(e));
        
        if (this.elements.statusLog) {
            this.addStatus('SPI Flash Tools ready.');
            this.addStatus('⚠️ Radio must be in NORMAL MODE!');
        }
        if (this.elements.calibStatusLog) this.addCalibStatus('Calibration Tools ready.');
    }
    
    getBaudRate() { return parseInt(this.elements.baudSelect?.value) || 115200; }
    getCalibBaudRate() { return parseInt(this.elements.calibBaudSelect?.value) || 115200; }
    
    addStatus(msg) {
        if (!this.elements.statusLog) { console.log('[SPI] ' + msg); return; }
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.innerHTML = '<span style="color: #888;">[' + time + ']</span> ' + msg;
        this.elements.statusLog.appendChild(entry);
        this.elements.statusLog.scrollTop = this.elements.statusLog.scrollHeight;
    }
    
    addCalibStatus(msg) {
        if (!this.elements.calibStatusLog) { console.log('[Calib] ' + msg); return; }
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.innerHTML = '<span style="color: #888;">[' + time + ']</span> ' + msg;
        this.elements.calibStatusLog.appendChild(entry);
        this.elements.calibStatusLog.scrollTop = this.elements.calibStatusLog.scrollHeight;
    }
    
    updateProgress(pct, text) {
        if (this.elements.progressBar) this.elements.progressBar.style.width = pct + '%';
        if (this.elements.progressPct) this.elements.progressPct.textContent = pct.toFixed(0) + '%';
        if (text && this.elements.progressText) this.elements.progressText.textContent = text;
    }
    
    updateCalibProgress(pct, text) {
        if (this.elements.calibProgressBar) this.elements.calibProgressBar.style.width = pct + '%';
        if (this.elements.calibProgressPct) this.elements.calibProgressPct.textContent = pct.toFixed(0) + '%';
        if (text && this.elements.calibProgressText) this.elements.calibProgressText.textContent = text;
    }
    
    setUIState(state) {
        const busy = state === 'busy';
        if (this.elements.backupBtn) this.elements.backupBtn.disabled = busy;
        if (this.elements.restoreBtn) this.elements.restoreBtn.disabled = busy || !this.elements.restoreFileInput?.files.length;
        if (this.elements.cancelBtn) this.elements.cancelBtn.disabled = !busy;
        if (this.elements.dumpCalibBtn) this.elements.dumpCalibBtn.disabled = busy;
        if (this.elements.restoreCalibBtn) this.elements.restoreCalibBtn.disabled = busy || !this.calibFileData;
    }
    
    handleProgress(pct, msg) {
        if (this.isCalibOperation) this.updateCalibProgress(pct, msg);
        else this.updateProgress(pct, msg);
    }
    
    handleStatus(msg) {
        if (this.isCalibOperation) this.addCalibStatus(msg);
        else this.addStatus(msg);
    }
    
    handleError(msg) {
        if (this.isCalibOperation) this.addCalibStatus('❌ ERROR: ' + msg);
        else this.addStatus('❌ ERROR: ' + msg);
        this.setUIState('idle');
        this.isCalibOperation = false;
    }
    
    handleComplete(data, type) {
        if (type === 'calibration') {
            this.isCalibOperation = false;
            this.downloadCalibration(data);
        } else {
            this.setUIState('idle');
            if (data) this.downloadBackup(data);
        }
    }
    
    async startBackup() {
        if (!this.spi) { this.addStatus('❌ SPI module not loaded'); return; }
        if (this.elements.statusLog) this.elements.statusLog.innerHTML = '';
        this.setUIState('busy');
        this.addStatus('Starting SPI backup (4MB)...');
        try { await this.spi.backup(this.getBaudRate()); }
        catch (e) { this.handleError(e.message); }
    }
    
    downloadBackup(data) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const filename = 'RT890_SPI_Backup_' + date + '.bin';
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        this.addStatus('✅ Saved: ' + filename);
        this.setUIState('idle');
    }
    
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.addStatus('Selected: ' + file.name);
            if (this.elements.restoreBtn) this.elements.restoreBtn.disabled = false;
        }
    }
    
    async startRestore() {
        const file = this.elements.restoreFileInput?.files[0];
        if (!file) { this.addStatus('❌ No file'); return; }
        if (!confirm('WARNING: Restore SPI flash?')) return;
        if (this.elements.statusLog) this.elements.statusLog.innerHTML = '';
        this.setUIState('busy');
        try {
            const data = new Uint8Array(await file.arrayBuffer());
            await this.spi.restore(data, this.getBaudRate());
            this.addStatus('✅ Restore complete!');
        } catch (e) { this.handleError(e.message); }
    }
    
    cancelOperation() { if (this.spi) this.spi.cancel(); }
    
    async startDumpCalibration() {
        if (!this.spi) { this.addCalibStatus('❌ SPI not loaded'); return; }
        this.isCalibOperation = true;
        if (this.elements.calibStatusLog) this.elements.calibStatusLog.innerHTML = '';
        this.setUIState('busy');
        this.addCalibStatus('📏 Dumping calibration (4KB)...');
        try { await this.spi.dumpCalibrationOnly(this.getCalibBaudRate()); }
        catch (e) { this.handleError(e.message); }
    }
    
    downloadCalibration(data) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const filename = 'RT890_Calibration_' + date + '.bin';
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        this.addCalibStatus('✅ Saved: ' + filename);
        this.updateCalibProgress(100, 'Complete');
        this.setUIState('idle');
    }
    
    handleCalibFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.addCalibStatus('Selected: ' + file.name);
            if (file.size !== 4096) {
                this.addCalibStatus('❌ Must be exactly 4096 bytes!');
                this.calibFileData = null;
                return;
            }
            this.addCalibStatus('✅ Size OK');
            this.calibFileData = file;
            if (this.elements.restoreCalibBtn) this.elements.restoreCalibBtn.disabled = false;
        }
    }
    
    async startRestoreCalibration() {
        if (!this.calibFileData) { this.addCalibStatus('❌ No file'); return; }
        if (!confirm('WARNING: Restore calibration?')) return;
        this.isCalibOperation = true;
        if (this.elements.calibStatusLog) this.elements.calibStatusLog.innerHTML = '';
        this.setUIState('busy');
        try {
            const data = new Uint8Array(await this.calibFileData.arrayBuffer());
            await this.spi.restoreCalibrationOnly(data, this.getCalibBaudRate());
            this.addCalibStatus('✅ Complete!');
            this.setUIState('idle');
        } catch (e) { this.handleError(e.message); }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.rt890ToolsUI = new RT890ToolsUI();
        window.rt890ToolsUI.init();
    }, 500);
});
