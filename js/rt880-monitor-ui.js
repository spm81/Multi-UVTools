/**
 * RT-880 Monitor UI
 * Serial monitor for Radtel RT-880 / iRadio UV-98
 */

(function() {
  'use strict';

  // State
  let port = null;
  let reader = null;
  let writer = null;
  let isConnected = false;
  let monitorInterval = null;
  let lastFrequency = 0;
  let lastRSSI = 0;
  
  // DOM elements
  let logArea, connectBtn, clearBtn, baudSelect;
  let freqDisplay, rssiDisplay, rssiBar, statusDisplay;

  // Logging
  function log(msg, type = 'info') {
    if (!logArea) return;
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
  }

  // Initialize
  function init() {
    logArea = document.getElementById('rt880MonitorLog');
    connectBtn = document.getElementById('rt880MonitorConnectBtn');
    clearBtn = document.getElementById('rt880MonitorClearBtn');
    baudSelect = document.getElementById('rt880MonitorBaud');
    freqDisplay = document.getElementById('rt880MonitorFreq');
    rssiDisplay = document.getElementById('rt880MonitorRSSI');
    rssiBar = document.getElementById('rt880MonitorRSSIBar');
    statusDisplay = document.getElementById('rt880MonitorStatus');

    if (connectBtn) {
      connectBtn.addEventListener('click', toggleConnection);
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', clearLog);
    }

    log('RT-880 Monitor ready. Click Connect to start.');
  }

  function clearLog() {
    if (logArea) logArea.innerHTML = '';
    log('Log cleared.');
  }

  async function toggleConnection() {
    if (isConnected) {
      await disconnect();
    } else {
      await connect();
    }
  }

  async function connect() {
    if (!navigator.serial) {
      log('WebSerial not supported in this browser!', 'error');
      return;
    }

    try {
      port = await navigator.serial.requestPort();
      const baud = parseInt(baudSelect?.value || '115200');
      await port.open({ baudRate: baud });
      
      reader = port.readable.getReader();
      writer = port.writable.getWriter();
      isConnected = true;
      
      if (connectBtn) connectBtn.textContent = 'Disconnect';
      log(`Connected at ${baud} baud`, 'success');
      
      // Start monitoring
      startMonitor();
      readLoop();
      
    } catch (err) {
      log(`Connection failed: ${err.message}`, 'error');
    }
  }

  async function disconnect() {
    stopMonitor();
    
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
    } catch (err) {
      // Ignore close errors
    }

    isConnected = false;
    if (connectBtn) connectBtn.textContent = 'Connect';
    log('Disconnected');
    
    // Reset display
    updateDisplay(0, 0, 'Disconnected');
  }

  async function readLoop() {
    const buffer = [];
    
    while (isConnected && reader) {
      try {
        const { value, done } = await reader.read();
        if (done) break;
        
        // Process received data
        for (const byte of value) {
          buffer.push(byte);
          
          // Check for complete packet
          if (buffer.length >= 4) {
            processPacket(buffer);
          }
        }
        
      } catch (err) {
        if (isConnected) {
          log(`Read error: ${err.message}`, 'error');
        }
        break;
      }
    }
  }

  function processPacket(buffer) {
    // RT-880 protocol parsing
    // Status response format varies - this is a simplified version
    if (buffer.length >= 8) {
      // Try to parse frequency and RSSI from buffer
      const freq = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
      const rssi = buffer[4];
      
      if (freq > 0 && freq < 600000000) {
        lastFrequency = freq;
        lastRSSI = rssi;
        updateDisplay(freq, rssi, 'Active');
      }
      
      // Clear buffer
      buffer.length = 0;
    }
  }

  function startMonitor() {
    // Poll for status every 500ms
    monitorInterval = setInterval(async () => {
      if (isConnected && writer) {
        try {
          // Send status request
          const cmd = new Uint8Array([0x52, 0x53]); // "RS" - Read Status
          await writer.write(cmd);
        } catch (err) {
          // Ignore write errors during polling
        }
      }
    }, 500);
  }

  function stopMonitor() {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
  }

  function updateDisplay(freq, rssi, status) {
    if (freqDisplay) {
      if (freq > 0) {
        freqDisplay.textContent = (freq / 1000000).toFixed(5) + ' MHz';
      } else {
        freqDisplay.textContent = '--- MHz';
      }
    }
    
    if (rssiDisplay) {
      rssiDisplay.textContent = rssi > 0 ? `-${rssi} dBm` : '--- dBm';
    }
    
    if (rssiBar) {
      // RSSI bar (0-100%)
      const percentage = Math.min(100, Math.max(0, (150 - rssi) / 1.5));
      rssiBar.style.width = percentage + '%';
      rssiBar.style.backgroundColor = percentage > 60 ? '#4CAF50' : percentage > 30 ? '#FFC107' : '#f44336';
    }
    
    if (statusDisplay) {
      statusDisplay.textContent = status;
    }
  }

  // Export
  window.initRT880Monitor = init;
  
  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }
})();
