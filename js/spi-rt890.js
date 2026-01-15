/**
 * RT-890 SPI Flash Backup/Restore Module
 * Based on OEFW-community/radtel-rt-890-flasher protocol
 * 
 * IMPORTANT: SPI operations require NORMAL MODE (not bootloader!)
 * 
 * SPI Flash: 4MB total (32768 blocks of 128 bytes)
 * Protocol: Simple read/write with checksum
 * 
 * v7.4 - Added Dump/Restore Calibration Only functions
 *        Calibration region: 0x3BF000 - 0x3BFFFF (4 KB)
 */

class RT890SPIFlash {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.isCancelled = false;
        
        // Protocol constants
        this.CMD_READ = 0x52;
        this.CMD_WRITE = 0x57;
        this.ACK = 0x06;
        this.BLOCK_SIZE = 128;
        this.TOTAL_BLOCKS = 32768; // 4MB / 128 bytes
        this.TOTAL_SIZE = 4 * 1024 * 1024; // 4MB
        
        // ========== CALIBRATION CONSTANTS (v7.4) ==========
        // Per GitHub bricky149/rt890-flash-rs
        this.CALIB_START = 0x3BF000;  // Calibration start address
        this.CALIB_END   = 0x3BFFFF;  // Calibration end address (inclusive)
        this.CALIB_SIZE  = 0x1000;    // 4 KB (4096 bytes)
        this.CALIB_BLOCKS = 32;       // 4096 / 128 = 32 blocks
        this.CALIB_START_BLOCK = 0x3BF000 / 128; // Block index = 31616
        
        // Baud rates
        this.BAUD_FAST = 115200;
        this.BAUD_SLOW = 19200;
        
        // Restore regions (only these areas are written during restore)
        this.RESTORE_REGIONS = [
            { start: 0x000000, end: 0x2CFFFF },
            { start: 0x2D0000, end: 0x2F7FFF },
            { start: 0x2F8000, end: 0x319FFF },
            { start: 0x31A000, end: 0x31BFFF },
            { start: 0x31C000, end: 0x3B4FFF },
            { start: 0x3B5000, end: 0x3BEFFF },
            { start: 0x3BF000, end: 0x3BFFFF },  // Calibration region
            { start: 0x3C1000, end: 0x3CAFFF },
            { start: 0x3D8000, end: 0x3E1FFF }
        ];
        
        // Callbacks
        this.onProgress = null;
        this.onStatus = null;
        this.onError = null;
        this.onComplete = null;
    }
    
    /**
     * Calculate checksum (sum of all bytes mod 256)
     */
    calculateChecksum(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum = (sum + data[i]) & 0xFF;
        }
        return sum;
    }
    
    /**
     * Verify checksum of received data
     */
    verifyChecksum(data) {
        if (data.length < 2) return false;
        const expected = data[data.length - 1];
        let sum = 0;
        for (let i = 0; i < data.length - 1; i++) {
            sum = (sum + data[i]) & 0xFF;
        }
        return sum === expected;
    }
    
    /**
     * Connect to serial port
     */
    async connect(baudRate = this.BAUD_FAST) {
        if (!('serial' in navigator)) {
            throw new Error('Web Serial API not supported in this browser');
        }
        
        try {
            this.port = await navigator.serial.requestPort();
            await this.port.open({
                baudRate: baudRate,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none'
            });
            
            this.reader = this.port.readable.getReader();
            this.writer = this.port.writable.getWriter();
            this.isConnected = true;
            this.isCancelled = false;
            
            this.log(`Connected at ${baudRate} baud`);
            return true;
        } catch (error) {
            this.error(`Connection failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Disconnect from serial port
     */
    async disconnect() {
        try {
            if (this.reader) {
                await this.reader.cancel();
                this.reader.releaseLock();
                this.reader = null;
            }
            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }
            if (this.port) {
                await this.port.close();
                this.port = null;
            }
            this.isConnected = false;
            this.log('Disconnected');
        } catch (error) {
            console.error('Disconnect error:', error);
        }
    }
    
    /**
     * Cancel current operation
     */
    cancel() {
        this.isCancelled = true;
        this.log('Operation cancelled by user');
    }
    
    /**
     * Read with timeout
     */
    async readWithTimeout(length, timeoutMs = 2000) {
        const result = new Uint8Array(length);
        let pos = 0;
        
        const startTime = Date.now();
        
        while (pos < length) {
            if (this.isCancelled) {
                throw new Error('Operation cancelled');
            }
            
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Read timeout (got ${pos}/${length} bytes)`);
            }
            
            try {
                const { value, done } = await Promise.race([
                    this.reader.read(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Read timeout')), timeoutMs - (Date.now() - startTime))
                    )
                ]);
                
                if (done || !value) break;
                
                for (let i = 0; i < value.length && pos < length; i++) {
                    result[pos++] = value[i];
                }
            } catch (e) {
                if (e.message === 'Read timeout') {
                    throw new Error(`Read timeout (got ${pos}/${length} bytes)`);
                }
                throw e;
            }
        }
        
        return result;
    }
    
    /**
     * Check if radio is in normal mode (not bootloader)
     */
    async isNormalMode() {
        try {
            // Try to read block 0 - if it works, we're in normal mode
            const data = await this.readBlock(0);
            if (data && data[0] !== 0xFF) {
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Read a single 128-byte block from SPI
     * @param {number} blockIndex - Block index (0-32767)
     * @returns {Uint8Array} - 128 bytes of data
     */
    async readBlock(blockIndex) {
        // Build command: [0x52] [Addr_H] [Addr_L] [Checksum]
        const command = new Uint8Array(4);
        command[0] = this.CMD_READ;
        command[1] = (blockIndex >> 8) & 0xFF;
        command[2] = blockIndex & 0xFF;
        command[3] = this.calculateChecksum(command.slice(0, 3));
        
        // Send command
        await this.writer.write(command);
        
        // Read response: [0x52] [Addr_H] [Addr_L] [128 bytes] [Checksum] = 132 bytes
        const response = await this.readWithTimeout(132, 3000);
        
        // Check for bootloader mode (returns 0xFF)
        if (response[0] === 0xFF) {
            throw new Error('Radio is in bootloader mode. Please restart in normal mode.');
        }
        
        // Verify response header
        if (response[0] !== this.CMD_READ) {
            throw new Error(`Invalid response header: expected 0x52, got 0x${response[0].toString(16)}`);
        }
        
        // Verify checksum
        if (!this.verifyChecksum(response)) {
            throw new Error(`Checksum error at block ${blockIndex}`);
        }
        
        // Extract data (bytes 3-130)
        return response.slice(3, 3 + this.BLOCK_SIZE);
    }
    
    /**
     * Write a single 128-byte block to SPI
     * @param {number} blockIndex - Block index (0-32767)
     * @param {Uint8Array} data - 128 bytes of data
     * @returns {boolean} - Success
     */
    async writeBlock(blockIndex, data) {
        if (data.length !== this.BLOCK_SIZE) {
            throw new Error(`Invalid data size: expected ${this.BLOCK_SIZE}, got ${data.length}`);
        }
        
        // Build command: [0x57] [Addr_H] [Addr_L] [128 bytes] [Checksum] = 132 bytes
        const command = new Uint8Array(132);
        command[0] = this.CMD_WRITE;
        command[1] = (blockIndex >> 8) & 0xFF;
        command[2] = blockIndex & 0xFF;
        command.set(data, 3);
        command[131] = this.calculateChecksum(command.slice(0, 131));
        
        // Send command
        await this.writer.write(command);
        
        // Wait for ACK (0x06)
        const response = await this.readWithTimeout(1, 3000);
        
        if (response[0] !== this.ACK) {
            throw new Error(`Write failed at block ${blockIndex}: expected ACK (0x06), got 0x${response[0].toString(16)}`);
        }
        
        return true;
    }
    
    /**
     * Backup entire SPI flash (4MB)
     * @param {number} baudRate - Baud rate (115200 or 19200)
     * @returns {Uint8Array} - 4MB of SPI data
     */
    async backup(baudRate = this.BAUD_FAST) {
        this.isCancelled = false;
        const spiData = new Uint8Array(this.TOTAL_SIZE);
        
        try {
            // Connect
            this.log('Connecting to RT-890...');
            await this.connect(baudRate);
            
            // Check mode
            this.log('Checking radio mode...');
            const normalMode = await this.isNormalMode();
            if (!normalMode) {
                throw new Error('Radio is not in normal mode! Please turn on the radio normally (without holding any buttons).');
            }
            
            this.log('Starting SPI backup (4MB)...');
            this.log('This will take approximately 5-10 minutes.');
            
            const startTime = Date.now();
            
            // Read all blocks
            for (let block = 0; block < this.TOTAL_BLOCKS; block++) {
                if (this.isCancelled) {
                    throw new Error('Backup cancelled by user');
                }
                
                // Read block
                const data = await this.readBlock(block);
                
                // Store data
                const offset = block * this.BLOCK_SIZE;
                spiData.set(data, offset);
                
                // Progress update (every 100 blocks)
                if (block % 100 === 0 || block === this.TOTAL_BLOCKS - 1) {
                    const progress = ((block + 1) / this.TOTAL_BLOCKS) * 100;
                    const elapsed = (Date.now() - startTime) / 1000;
                    const eta = (elapsed / (block + 1)) * (this.TOTAL_BLOCKS - block - 1);
                    
                    this.progress(progress, `Block ${block + 1}/${this.TOTAL_BLOCKS} (${progress.toFixed(1)}%) - ETA: ${this.formatTime(eta)}`);
                }
            }
            
            const totalTime = (Date.now() - startTime) / 1000;
            this.log(`Backup complete! Total time: ${this.formatTime(totalTime)}`);
            
            await this.disconnect();
            
            if (this.onComplete) {
                this.onComplete(spiData);
            }
            
            return spiData;
            
        } catch (error) {
            this.error(`Backup failed: ${error.message}`);
            await this.disconnect();
            throw error;
        }
    }
    
    /**
     * Check if a block address falls within restore regions
     */
    isInRestoreRegion(byteAddress) {
        for (const region of this.RESTORE_REGIONS) {
            if (byteAddress >= region.start && byteAddress <= region.end) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Restore SPI flash from backup (only safe regions)
     * @param {Uint8Array} spiData - 4MB backup data
     * @param {number} baudRate - Baud rate (115200 or 19200)
     */
    async restore(spiData, baudRate = this.BAUD_FAST) {
        if (spiData.length !== this.TOTAL_SIZE) {
            throw new Error(`Invalid backup size: expected ${this.TOTAL_SIZE} bytes, got ${spiData.length} bytes`);
        }
        
        this.isCancelled = false;
        
        try {
            // Connect
            this.log('Connecting to RT-890...');
            await this.connect(baudRate);
            
            // Check mode
            this.log('Checking radio mode...');
            const normalMode = await this.isNormalMode();
            if (!normalMode) {
                throw new Error('Radio is not in normal mode! Please turn on the radio normally (without holding any buttons).');
            }
            
            // Calculate total blocks to write
            let totalBlocksToWrite = 0;
            for (let block = 0; block < this.TOTAL_BLOCKS; block++) {
                const byteAddress = block * this.BLOCK_SIZE;
                if (this.isInRestoreRegion(byteAddress)) {
                    totalBlocksToWrite++;
                }
            }
            
            this.log(`Starting SPI restore (${totalBlocksToWrite} blocks in safe regions)...`);
            this.log('⚠️ DO NOT turn off the radio during restore!');
            
            const startTime = Date.now();
            let blocksWritten = 0;
            
            // Write blocks in restore regions only
            for (let block = 0; block < this.TOTAL_BLOCKS; block++) {
                if (this.isCancelled) {
                    throw new Error('Restore cancelled by user');
                }
                
                const byteAddress = block * this.BLOCK_SIZE;
                
                // Skip blocks outside restore regions
                if (!this.isInRestoreRegion(byteAddress)) {
                    continue;
                }
                
                // Get block data
                const offset = block * this.BLOCK_SIZE;
                const data = spiData.slice(offset, offset + this.BLOCK_SIZE);
                
                // Write block
                await this.writeBlock(block, data);
                blocksWritten++;
                
                // Progress update (every 100 blocks)
                if (blocksWritten % 100 === 0 || blocksWritten === totalBlocksToWrite) {
                    const progress = (blocksWritten / totalBlocksToWrite) * 100;
                    const elapsed = (Date.now() - startTime) / 1000;
                    const eta = (elapsed / blocksWritten) * (totalBlocksToWrite - blocksWritten);
                    
                    this.progress(progress, `Block ${blocksWritten}/${totalBlocksToWrite} (${progress.toFixed(1)}%) - ETA: ${this.formatTime(eta)}`);
                }
            }
            
            const totalTime = (Date.now() - startTime) / 1000;
            this.log(`Restore complete! Total time: ${this.formatTime(totalTime)}`);
            this.log('Please restart your radio.');
            
            await this.disconnect();
            
            if (this.onComplete) {
                this.onComplete(null);
            }
            
        } catch (error) {
            this.error(`Restore failed: ${error.message}`);
            await this.disconnect();
            throw error;
        }
    }
    
    // ========== CALIBRATION ONLY FUNCTIONS (v7.4) ==========
    
    /**
     * Dump calibration data ONLY (4 KB from 0x3BF000 to 0x3BFFFF)
     * @param {number} baudRate - Baud rate (115200 or 19200)
     * @returns {Uint8Array} - 4096 bytes of calibration data
     */
    async dumpCalibrationOnly(baudRate = this.BAUD_FAST) {
        this.isCancelled = false;
        const calibData = new Uint8Array(this.CALIB_SIZE);
        
        try {
            // Connect
            this.log('Connecting to RT-890...');
            await this.connect(baudRate);
            
            // Check mode
            this.log('Checking radio mode...');
            const normalMode = await this.isNormalMode();
            if (!normalMode) {
                throw new Error('Radio is not in normal mode! Please turn on the radio normally (without holding any buttons).');
            }
            
            this.log('📏 Dumping CALIBRATION ONLY (4 KB)...');
            this.log(`Address range: 0x${this.CALIB_START.toString(16).toUpperCase()} - 0x${this.CALIB_END.toString(16).toUpperCase()}`);
            
            const startTime = Date.now();
            const startBlock = this.CALIB_START_BLOCK;
            
            // Read calibration blocks (32 blocks of 128 bytes = 4 KB)
            for (let i = 0; i < this.CALIB_BLOCKS; i++) {
                if (this.isCancelled) {
                    throw new Error('Dump cancelled by user');
                }
                
                const block = startBlock + i;
                const data = await this.readBlock(block);
                
                // Store data
                const offset = i * this.BLOCK_SIZE;
                calibData.set(data, offset);
                
                // Progress update
                const progress = ((i + 1) / this.CALIB_BLOCKS) * 100;
                this.progress(progress, `Block ${i + 1}/${this.CALIB_BLOCKS} (${progress.toFixed(0)}%)`);
            }
            
            const totalTime = (Date.now() - startTime) / 1000;
            this.log(`✅ Calibration dump complete! (${totalTime.toFixed(1)}s)`);
            this.log(`Size: ${calibData.length} bytes (${(calibData.length / 1024).toFixed(1)} KB)`);
            
            await this.disconnect();
            
            if (this.onComplete) {
                this.onComplete(calibData, 'calibration');
            }
            
            return calibData;
            
        } catch (error) {
            this.error(`Calibration dump failed: ${error.message}`);
            await this.disconnect();
            throw error;
        }
    }
    
    /**
     * Restore calibration data ONLY (4 KB to 0x3BF000 - 0x3BFFFF)
     * @param {Uint8Array} calibData - 4096 bytes of calibration data
     * @param {number} baudRate - Baud rate (115200 or 19200)
     */
    async restoreCalibrationOnly(calibData, baudRate = this.BAUD_FAST) {
        // Validate calibration data size
        if (calibData.length !== this.CALIB_SIZE) {
            throw new Error(`Invalid calibration size!\nExpected: ${this.CALIB_SIZE} bytes (4 KB)\nGot: ${calibData.length} bytes`);
        }
        
        this.isCancelled = false;
        
        try {
            // Connect
            this.log('Connecting to RT-890...');
            await this.connect(baudRate);
            
            // Check mode
            this.log('Checking radio mode...');
            const normalMode = await this.isNormalMode();
            if (!normalMode) {
                throw new Error('Radio is not in normal mode! Please turn on the radio normally (without holding any buttons).');
            }
            
            this.log('📝 Restoring CALIBRATION ONLY (4 KB)...');
            this.log(`Address range: 0x${this.CALIB_START.toString(16).toUpperCase()} - 0x${this.CALIB_END.toString(16).toUpperCase()}`);
            this.log('⚠️ DO NOT turn off the radio during restore!');
            
            const startTime = Date.now();
            const startBlock = this.CALIB_START_BLOCK;
            
            // Write calibration blocks (32 blocks of 128 bytes = 4 KB)
            for (let i = 0; i < this.CALIB_BLOCKS; i++) {
                if (this.isCancelled) {
                    throw new Error('Restore cancelled by user');
                }
                
                const block = startBlock + i;
                const offset = i * this.BLOCK_SIZE;
                const data = calibData.slice(offset, offset + this.BLOCK_SIZE);
                
                // Write block
                await this.writeBlock(block, data);
                
                // Progress update
                const progress = ((i + 1) / this.CALIB_BLOCKS) * 100;
                this.progress(progress, `Block ${i + 1}/${this.CALIB_BLOCKS} (${progress.toFixed(0)}%)`);
            }
            
            const totalTime = (Date.now() - startTime) / 1000;
            this.log(`✅ Calibration restore complete! (${totalTime.toFixed(1)}s)`);
            this.log('Please restart your radio.');
            
            await this.disconnect();
            
            if (this.onComplete) {
                this.onComplete(null, 'calibration');
            }
            
        } catch (error) {
            this.error(`Calibration restore failed: ${error.message}`);
            await this.disconnect();
            throw error;
        }
    }
    
    // ========== UTILITY FUNCTIONS ==========
    
    /**
     * Format time in mm:ss
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Logging helpers
     */
    log(message) {
        console.log(`[SPI] ${message}`);
        if (this.onStatus) {
            this.onStatus(message);
        }
    }
    
    error(message) {
        console.error(`[SPI] ${message}`);
        if (this.onError) {
            this.onError(message);
        }
    }
    
    progress(percent, message) {
        if (this.onProgress) {
            this.onProgress(percent, message);
        }
    }
}

// Export for use
window.RT890SPIFlash = RT890SPIFlash;
