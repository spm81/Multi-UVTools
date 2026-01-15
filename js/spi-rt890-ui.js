/**
 * RT-890 SPI Flash UI Module
 * Provides user interface for SPI backup and restore operations
 * 
 * v7.4 - Added Dump/Restore Calibration Only buttons
 * v7.5 - Separate Calibration panel with own progress/status
 */

class RT890SPIUI {
    constructor() {
        this.spi = new RT890SPIFlash();
        this.backupData = null;
        this.calibData = null;
        this.calibFileData = null; // v7.5: Selected calibration file
        this.isCalibOperation = false; // v7.5: Flag to route callbacks to calib panel
        
        // Bind callbacks
        this.spi.onProgress = this.handleProgress.bind(this);
        this.spi.onStatus = this.handleStatus.bind(this);
        this.spi.onError = this.handleError.bind(this);
        this.spi.onComplete = this.handleComplete.bind(this);
    }
    
    /**
     * Initialize UI elements
     */
    init() {
        // Get elements
        this.baudSelect = document.getElementById('spiBaudRate');
        this.backupBtn = document.getElementById('spiBackupBtn');
        this.restoreBtn = document.getElementById('spiRestoreBtn');
        this.cancelBtn = document.getElementById('spiCancelBtn');
        this.restoreFileInput = document.getElementById('spiRestoreFile');
        this.progressBar = document.getElementById('spiProgressBar');
        this.progressText = document.getElementById('spiProgressText');
        this.statusLog = document.getElementById('spiStatusLog');
        
        // v7.5: Separate Calibration panel elements
        this.calibBaudSelect = document.getElementById('spiCalibBaudRate');
        this.dumpCalibBtn = document.getElementById('spiDumpCalibBtn');
        this.restoreCalibBtn = document.getElementById('spiRestoreCalibBtn');
        this.restoreCalibFileInput = document.getElementById('spiRestoreCalibFile');
        this.calibProgressBar = document.getElementById('spiCalibProgressBar');
        this.calibProgressText = document.getElementById('spiCalibProgressText');
        this.calibProgressPct = document.getElementById('spiCalibProgressPct');
        this.calibStatusLog = document.getElementById('spiCalibStatusLog');
        
        if (!this.backupBtn) {
            console.log('[SPI UI] Elements not found, skipping init');
            return;
        }
        
        // Bind events
        this.backupBtn.addEventListener('click', () => this.startBackup());
        this.restoreBtn.addEventListener('click', () => this.startRestore());
        this.cancelBtn.addEventListener('click', () => this.cancelOperation());
        this.restoreFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // v7.4: Calibration-only event listeners
        if (this.dumpCalibBtn) {
            this.dumpCalibBtn.addEventListener('click', () => this.startDumpCalibration());
        }
        if (this.restoreCalibBtn) {
            this.restoreCalibBtn.addEventListener('click', () => this.startRestoreCalibration());
        }
        if (this.restoreCalibFileInput) {
            this.restoreCalibFileInput.addEventListener('change', (e) => this.handleCalibFileSelect(e));
        }
        
        // Initial state
        this.setUIState('idle');
        
        // Initialize calibration panel status
        if (this.calibStatusLog) {
            this.addCalibStatus('Calibration Tool ready. Select an operation.');
            this.addCalibStatus('⚠️ Radio must be in NORMAL MODE (not bootloader) for SPI operations!');
        }
        
        console.log('[SPI UI] Initialized (v7.4 with Calibration functions)');
    }
    
    /**
     * Set UI state
     */
    setUIState(state) {
        switch (state) {
            case 'idle':
                this.backupBtn.disabled = false;
                this.restoreBtn.disabled = !this.restoreFileInput.files.length;
                this.cancelBtn.disabled = true;
                this.baudSelect.disabled = false;
                this.restoreFileInput.disabled = false;
                this.progressBar.style.width = '0%';
                // v7.4: Calibration buttons
                if (this.dumpCalibBtn) this.dumpCalibBtn.disabled = false;
                if (this.restoreCalibBtn) this.restoreCalibBtn.disabled = !this.restoreCalibFileInput?.files.length;
                if (this.restoreCalibFileInput) this.restoreCalibFileInput.disabled = false;
                break;
            case 'busy':
                this.backupBtn.disabled = true;
                this.restoreBtn.disabled = true;
                this.cancelBtn.disabled = false;
                this.baudSelect.disabled = true;
                this.restoreFileInput.disabled = true;
                // v7.4: Calibration buttons
                if (this.dumpCalibBtn) this.dumpCalibBtn.disabled = true;
                if (this.restoreCalibBtn) this.restoreCalibBtn.disabled = true;
                if (this.restoreCalibFileInput) this.restoreCalibFileInput.disabled = true;
                break;
            case 'complete':
                this.backupBtn.disabled = false;
                this.restoreBtn.disabled = !this.restoreFileInput.files.length;
                this.cancelBtn.disabled = true;
                this.baudSelect.disabled = false;
                this.restoreFileInput.disabled = false;
                this.progressBar.style.width = '100%';
                // v7.4: Calibration buttons
                if (this.dumpCalibBtn) this.dumpCalibBtn.disabled = false;
                if (this.restoreCalibBtn) this.restoreCalibBtn.disabled = !this.restoreCalibFileInput?.files.length;
                if (this.restoreCalibFileInput) this.restoreCalibFileInput.disabled = false;
                break;
        }
    }
    
    /**
     * Add status message
     */
    addStatus(message) {
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = 'spi-log-entry';
        entry.innerHTML = `<span class="spi-log-time">[${time}]</span> ${message}`;
        this.statusLog.appendChild(entry);
        this.statusLog.scrollTop = this.statusLog.scrollHeight;
    }
    
    /**
     * Handle progress updates
     */
    handleProgress(percent, message) {
        // v7.5: Route to correct panel based on operation type
        if (this.isCalibOperation) {
            this.updateCalibProgress(percent, message);
        } else {
            this.progressBar.style.width = `${percent}%`;
            this.progressText.textContent = message;
        }
    }
    
    /**
     * Handle status messages
     */
    handleStatus(message) {
        // v7.5: Route to correct panel based on operation type
        if (this.isCalibOperation) {
            this.addCalibStatus(message);
        } else {
            this.addStatus(message);
        }
    }
    
    /**
     * Handle error messages
     */
    handleError(message) {
        // v7.5: Route to correct panel based on operation type
        if (this.isCalibOperation) {
            this.addCalibStatus(`❌ ERROR: ${message}`);
            this.setCalibUIState('idle');
        } else {
            this.addStatus(`❌ ERROR: ${message}`);
            this.setUIState('idle');
        }
    }
    
    /**
     * Handle completion
     */
    handleComplete(data, type = 'full') {
        if (type === 'calibration') {
            // v7.5: Calibration dump complete - route to calib panel
            this.isCalibOperation = false;
            this.calibData = data;
            this.downloadCalibration(data);
        } else {
            // Full backup complete - offer download
            this.setUIState('complete');
            if (data) {
                this.backupData = data;
                this.downloadBackup(data);
            }
        }
    }
    
    /**
     * Get selected baud rate
     */
    getBaudRate() {
        return parseInt(this.baudSelect.value) || 115200;
    }
    
    /**
     * Get baud rate for calibration panel (v7.5)
     */
    getCalibBaudRate() {
        return parseInt(this.calibBaudSelect?.value) || 115200;
    }
    
    /**
     * Add status message to calibration panel (v7.5)
     */
    addCalibStatus(message) {
        if (!this.calibStatusLog) return;
        const entry = document.createElement('div');
        entry.className = 'status-entry';
        const time = new Date().toLocaleTimeString();
        entry.innerHTML = `<span class="time">[${time}]</span> ${message}`;
        this.calibStatusLog.appendChild(entry);
        this.calibStatusLog.scrollTop = this.calibStatusLog.scrollHeight;
    }
    
    /**
     * Update calibration progress bar (v7.5)
     */
    updateCalibProgress(percent, text) {
        if (this.calibProgressBar) {
            this.calibProgressBar.style.width = `${percent}%`;
        }
        if (this.calibProgressPct) {
            this.calibProgressPct.textContent = `${percent}%`;
        }
        if (text && this.calibProgressText) {
            this.calibProgressText.textContent = text;
        }
    }
    
    /**
     * Set calibration panel UI state (v7.5)
     */
    setCalibUIState(state) {
        const isBusy = state === 'busy';
        if (this.dumpCalibBtn) this.dumpCalibBtn.disabled = isBusy;
        if (this.restoreCalibBtn) this.restoreCalibBtn.disabled = isBusy || !this.calibFileData;
        if (this.calibBaudSelect) this.calibBaudSelect.disabled = isBusy;
        if (this.restoreCalibFileInput) this.restoreCalibFileInput.disabled = isBusy;
        
        if (state === 'idle') {
            this.updateCalibProgress(0, 'Ready');
        }
    }
    
    /**
     * Start SPI backup
     */
    async startBackup() {
        this.statusLog.innerHTML = '';
        this.setUIState('busy');
        this.addStatus('Starting SPI backup...');
        this.addStatus('Please wait, this will take 5-10 minutes.');
        
        try {
            await this.spi.backup(this.getBaudRate());
        } catch (error) {
            this.handleError(error.message);
        }
    }
    
    /**
     * Download backup file
     */
    downloadBackup(data) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `RT890_SPI_Backup_${date}.bin`;
        
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.addStatus(`✅ Backup saved as: ${filename}`);
        this.addStatus(`File size: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
    }
    
    /**
     * Handle file selection for restore
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.addStatus(`Selected file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            
            // Validate file size
            if (file.size !== 4 * 1024 * 1024) {
                this.addStatus(`⚠️ Warning: Expected 4MB file, got ${(file.size / 1024 / 1024).toFixed(2)} MB`);
            }
            
            this.restoreBtn.disabled = false;
        }
    }
    
    /**
     * Start SPI restore
     */
    async startRestore() {
        const file = this.restoreFileInput.files[0];
        if (!file) {
            this.addStatus('❌ No file selected for restore');
            return;
        }
        
        // Confirm restore
        const confirmed = confirm(
            '⚠️ WARNING: SPI Restore will modify your radio\'s flash memory!\n\n' +
            'This operation will restore calibration data and settings.\n\n' +
            'Make sure:\n' +
            '1. The backup file is from YOUR radio\n' +
            '2. The radio is in NORMAL mode (not bootloader)\n' +
            '3. Battery is fully charged\n' +
            '4. DO NOT turn off the radio during restore\n\n' +
            'Continue with restore?'
        );
        
        if (!confirmed) {
            this.addStatus('Restore cancelled by user');
            return;
        }
        
        this.statusLog.innerHTML = '';
        this.setUIState('busy');
        this.addStatus('Loading backup file...');
        
        try {
            // Read file
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            
            this.addStatus(`File loaded: ${data.length} bytes`);
            
            // Start restore
            await this.spi.restore(data, this.getBaudRate());
            
            this.addStatus('✅ Restore complete! Please restart your radio.');
            
        } catch (error) {
            this.handleError(error.message);
        }
    }
    
    /**
     * Cancel current operation
     */
    cancelOperation() {
        this.spi.cancel();
        this.addStatus('Cancelling operation...');
    }
    
    // ========== CALIBRATION-ONLY FUNCTIONS (v7.5) ==========
    
    /**
     * Start calibration dump (4 KB only)
     */
    async startDumpCalibration() {
        this.isCalibOperation = true; // v7.5: Route callbacks to calib panel
        if (this.calibStatusLog) this.calibStatusLog.innerHTML = '';
        this.setCalibUIState('busy');
        this.addCalibStatus('📏 Starting CALIBRATION DUMP (4 KB only)...');
        this.addCalibStatus('This will be quick (~5 seconds).');
        this.updateCalibProgress(10, 'Connecting...');
        
        try {
            await this.spi.dumpCalibrationOnly(this.getCalibBaudRate());
        } catch (error) {
            this.addCalibStatus(`❌ ERROR: ${error.message}`);
            this.setCalibUIState('idle');
            this.isCalibOperation = false;
        }
    }
    
    /**
     * Download calibration file
     */
    downloadCalibration(data) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `RT890_Calibration_${date}.bin`;
        
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.addCalibStatus(`✅ Calibration saved as: ${filename}`);
        this.addCalibStatus(`File size: ${data.length} bytes (${(data.length / 1024).toFixed(1)} KB)`);
        this.updateCalibProgress(100, 'Complete');
        this.setCalibUIState('idle');
    }
    
    /**
     * Handle calibration file selection for restore
     */
    handleCalibFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.addCalibStatus(`Selected calibration file: ${file.name} (${file.size} bytes)`);
            
            // Validate file size (must be exactly 4 KB)
            const expectedSize = 4096; // 4 KB
            if (file.size !== expectedSize) {
                this.addCalibStatus(`❌ ERROR: Calibration file must be exactly ${expectedSize} bytes (4 KB)!`);
                this.addCalibStatus(`Got: ${file.size} bytes`);
                this.restoreCalibBtn.disabled = true;
                this.calibFileData = null;
                return;
            }
            
            this.addCalibStatus(`✅ File size validated: ${file.size} bytes`);
            this.calibFileData = file;
            this.restoreCalibBtn.disabled = false;
        }
    }
    
    /**
     * Start calibration restore (4 KB only)
     */
    async startRestoreCalibration() {
        const file = this.restoreCalibFileInput?.files[0];
        if (!file) {
            this.addCalibStatus('❌ No calibration file selected for restore');
            return;
        }
        
        // Validate file size again
        if (file.size !== 4096) {
            this.addCalibStatus(`❌ Calibration file must be exactly 4096 bytes (4 KB)!`);
            return;
        }
        
        // Confirm restore
        const confirmed = confirm(
            '⚠️ WARNING: CALIBRATION RESTORE\n\n' +
            'This will overwrite ONLY the calibration region (4 KB):\n' +
            '0x3BF000 - 0x3BFFFF\n\n' +
            'Calibration data affects:\n' +
            '• TX/RX frequency accuracy\n' +
            '• Power output levels\n' +
            '• RSSI calibration\n' +
            '• Battery voltage calibration\n\n' +
            'Make sure:\n' +
            '1. The calibration file is from YOUR radio\n' +
            '2. The radio is in NORMAL mode\n' +
            '3. DO NOT turn off the radio during restore\n\n' +
            'Continue with calibration restore?'
        );
        
        if (!confirmed) {
            this.addCalibStatus('Calibration restore cancelled by user');
            return;
        }
        
        this.isCalibOperation = true; // v7.5: Route callbacks to calib panel
        if (this.calibStatusLog) this.calibStatusLog.innerHTML = '';
        this.setCalibUIState('busy');
        this.addCalibStatus('Loading calibration file...');
        this.updateCalibProgress(10, 'Loading file...');
        
        try {
            // Read file
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            
            this.addCalibStatus(`Calibration file loaded: ${data.length} bytes`);
            this.updateCalibProgress(20, 'Connecting...');
            
            // Start restore
            await this.spi.restoreCalibrationOnly(data, this.getCalibBaudRate());
            
            this.addCalibStatus('✅ Calibration restore complete! Please restart your radio.');
            this.updateCalibProgress(100, 'Complete');
            this.setCalibUIState('idle');
            this.isCalibOperation = false;
            
        } catch (error) {
            this.addCalibStatus(`❌ ERROR: ${error.message}`);
            this.setCalibUIState('idle');
            this.isCalibOperation = false;
        }
    }
}

// Create global instance
window.rt890SPIUI = new RT890SPIUI();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Delay initialization to ensure all elements are loaded
    setTimeout(() => {
        if (document.getElementById('spiBackupBtn')) {
            window.rt890SPIUI.init();
        }
    }, 500);
});
