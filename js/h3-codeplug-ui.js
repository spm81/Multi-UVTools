// h3-codeplug-ui.js
// TD-H3/H8 Codeplug Manager
// Adapted from h3webtools by nicFW

'use strict';

// ========== STATE ==========
let h3CpPort = null;
let h3CpWriter = null;
let h3CpReader = null;
let h3Codeplug = null;
let h3CpStarted = false;
let h3CpSynced = false;
let h3CpSyncCount = 0;
let h3CpState = 0;
let h3CpAck = false;
let h3CpBlkCount = 0;
let h3CpBlkCs = 0;
const h3CpBlkBuffer = new Uint8Array(32);

// ========== UI ELEMENTS ==========
const h3CpFile = document.getElementById('h3CpFile');
const h3CpReadBtn = document.getElementById('h3CpReadBtn');
const h3CpWriteBtn = document.getElementById('h3CpWriteBtn');
const h3CpStatus = document.getElementById('h3CpStatus');
const h3CpConnectBtn = document.getElementById('h3CpConnectBtn');
const h3CpAbortBtn = document.getElementById('h3CpAbortBtn');
const h3CpSaveBtn = document.getElementById('h3CpSaveBtn');
const h3CpProgress = document.getElementById('h3CpProgress');
const h3CpProgressFill = document.getElementById('h3CpProgressFill');
const h3CpProgressPct = document.getElementById('h3CpProgressPct');

// ========== HELPERS ==========
function h3CpLog(message) {
  if (h3CpStatus) h3CpStatus.textContent = message;
  console.log(`[H3 Codeplug] ${message}`);
}

function h3CpUpdateProgress(percent) {
  if (h3CpProgressFill) h3CpProgressFill.style.width = `${percent}%`;
  if (h3CpProgressPct) h3CpProgressPct.textContent = `${Math.round(percent)}%`;
}

function h3CpSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== SERIAL ==========
async function h3CpOpenSerial(baud) {
  if (h3CpPort) {
    try {
      await h3CpPort.open({ baudRate: baud });
      h3CpWriter = h3CpPort.writable.getWriter();
      h3CpReader = h3CpPort.readable.getReader();
    } catch (error) {
      h3CpLog(`Serial port error: ${error.message}`);
      h3CpPort = null;
      h3CpWriter = null;
      h3CpReader = null;
    }
  }
}

function h3CpSetActiveButtons() {
  if (h3CpReadBtn) h3CpReadBtn.disabled = (h3CpStarted || h3CpPort == null);
  if (h3CpWriteBtn) h3CpWriteBtn.disabled = (h3CpStarted || h3CpPort == null || h3Codeplug == null);
  if (h3CpSaveBtn) h3CpSaveBtn.disabled = (h3CpStarted || h3Codeplug == null);
  if (h3CpAbortBtn) h3CpAbortBtn.disabled = h3CpPort == null;
  if (h3CpConnectBtn) h3CpConnectBtn.disabled = h3CpPort != null;
  if (h3CpFile) h3CpFile.disabled = h3CpStarted;
}

// ========== BYTE PROCESSOR ==========
async function h3CpByteProcessor(byt) {
  switch (h3CpState) {
    case 0: // idle
      switch (byt) {
        case 1: // ping
          h3CpSyncCount++;
          if (h3CpSyncCount > 16) {
            if (!h3CpSynced) h3CpLog("Radio Found");
            h3CpSynced = true;
          }
          break;
        case 0x30: // read block
          h3CpState = byt;
          h3CpBlkCount = 0;
          h3CpBlkCs = 0;
          break;
        case 0x31: // write block ack
          h3CpAck = true;
          break;
      }
      break;
    case 0x30: // read block data
      h3CpBlkCs += byt;
      h3CpBlkBuffer[h3CpBlkCount++] = byt;
      if (h3CpBlkCount >= 32) h3CpState = 0x130; // checksum
      break;
    case 0x130: // checksum
      if ((h3CpBlkCs & 0xff) === byt) h3CpAck = true;
      h3CpState = 0; // idle
      break;
  }
}

async function h3CpByteReader() {
  while (h3CpPort) {
    const { value, done } = await h3CpReader.read();
    if (done || !value) {
      throw new Error("Serial connection lost.");
    }
    for (let b of value) {
      await h3CpByteProcessor(b);
    }
  }
}

async function h3CpSyncRadio() {
  h3CpSynced = false;
  h3CpSyncCount = 0;
  const syncpacket = new Uint8Array(32).fill(1);
  await h3CpWriter.write(syncpacket);
  for (let i = 0; i < 100; i++) {
    if (h3CpSynced) break;
    await h3CpSleep(10);
  }
  await h3CpSleep(100);
}

// ========== INITIALIZATION ==========
function h3CpInit() {
  // Connect button
  if (h3CpConnectBtn) {
    h3CpConnectBtn.addEventListener("click", async () => {
      try {
        h3CpPort = await navigator.serial.requestPort();
      } catch {
        h3CpPort = null;
      }
      await h3CpOpenSerial(38400);
      h3CpSetActiveButtons();
      if (h3CpPort) {
        h3CpLog("Connected to serial port.");
        try {
          await h3CpByteReader();
        } catch (error) {
          h3CpLog(`${error.message}`);
        }
      }
      h3CpPort = null;
      h3CpReader = null;
      h3CpWriter = null;
      h3CpSetActiveButtons();
    });
  }
  
  // File input
  if (h3CpFile) {
    h3CpFile.addEventListener("change", async (event) => {
      try {
        h3Codeplug = null;
        if (event.target.files[0]) {
          const fileData = await event.target.files[0].arrayBuffer();
          const fileBytes = new Uint8Array(fileData);
          const fileLength = fileBytes.length;
          if (fileLength !== 8192) {
            throw new Error("Incorrect file size " + fileLength + " (expected 8192 bytes)");
          }
          h3Codeplug = new Uint8Array(8192);
          h3Codeplug.set(fileBytes);
          h3CpLog("Codeplug file loaded.");
        }
      } catch (error) {
        h3CpLog(`File error: ${error.message}`);
      }
      h3CpSetActiveButtons();
    });
  }
  
  // Write button
  if (h3CpWriteBtn) {
    h3CpWriteBtn.addEventListener("click", async () => {
      h3CpState = 0;
      h3CpStarted = true;
      h3CpSetActiveButtons();
      h3CpLog("Finding Radio.");
      h3CpUpdateProgress(0);
      await h3CpSyncRadio();
      
      if (h3CpSynced) {
        const blockput = new Uint8Array(35);
        blockput[0] = 0x31;
        for (let block = 0; block < 256; block++) {
          blockput[1] = block;
          blockput[34] = 0;
          for (let i = 0; i < 32; i++) {
            const b = h3Codeplug[(block * 32) + i];
            blockput[i + 2] = b;
            blockput[34] += b;
          }
          h3CpAck = false;
          await h3CpWriter.write(blockput);
          let timeout = 0;
          while (!h3CpAck && timeout++ < 100) {
            await h3CpSleep(10);
          }
          if (!h3CpAck) {
            h3CpLog("Radio Communication Timeout");
            h3CpStarted = false;
            h3CpSetActiveButtons();
            return;
          }
          h3CpLog(`Writing Block ${block + 1}/256`);
          h3CpUpdateProgress((block / 256) * 100);
        }
        const resetreq = new Uint8Array([0x49]);
        await h3CpWriter.write(resetreq);
        h3CpStarted = false;
        h3CpLog("Codeplug Write Complete");
        h3CpUpdateProgress(100);
      } else {
        h3CpLog("Cannot Find Radio.");
        h3CpStarted = false;
      }
      h3CpSetActiveButtons();
    });
  }
  
  // Read button
  if (h3CpReadBtn) {
    h3CpReadBtn.addEventListener("click", async () => {
      h3CpState = 0;
      h3CpStarted = true;
      h3CpSetActiveButtons();
      h3CpLog("Finding Radio.");
      h3CpUpdateProgress(0);
      await h3CpSyncRadio();
      
      if (h3CpSynced) {
        const tempcp = new Uint8Array(8192);
        const blockreq = new Uint8Array(2);
        blockreq[0] = 0x30;
        for (let block = 0; block < 256; block++) {
          blockreq[1] = block;
          h3CpAck = false;
          await h3CpWriter.write(blockreq);
          let timeout = 0;
          while (!h3CpAck && timeout++ < 100) {
            await h3CpSleep(10);
          }
          if (!h3CpAck) {
            h3CpLog("Radio Communication Timeout");
            h3CpStarted = false;
            h3CpSetActiveButtons();
            return;
          }
          h3CpLog(`Reading Block ${block + 1}/256`);
          h3CpUpdateProgress((block / 256) * 100);
          tempcp.set(h3CpBlkBuffer, block * 32);
        }
        h3CpStarted = false;
        h3CpLog("Codeplug Read Complete");
        h3CpUpdateProgress(100);
        h3Codeplug = tempcp;
      } else {
        h3CpLog("Cannot Find Radio.");
        h3CpStarted = false;
      }
      h3CpSetActiveButtons();
    });
  }
  
  // Abort button
  if (h3CpAbortBtn) {
    h3CpAbortBtn.addEventListener("click", () => {
      location.reload();
    });
  }
  
  // Save button
  if (h3CpSaveBtn) {
    h3CpSaveBtn.addEventListener("click", () => {
      if (h3Codeplug) {
        const blob = new Blob([h3Codeplug], { type: "application/octet-stream" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "codeplug.nfw";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }
  
  h3CpSetActiveButtons();
  h3CpLog("Codeplug Manager ready. Connect to radio to begin.");
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', h3CpInit);
} else {
  h3CpInit();
}

console.log('[H3 Codeplug Manager] Initialized successfully!');
