// display-mirror-f4hwn.js - Display Mirror for F4HWN UV-K5v1/v3 UV-K1
// Uses lcdCanvas and serial-manager like original display-mirror.js
// Protocol based on https://github.com/armel/k5viewer

import { getPort, subscribe, isConnected } from "./serial-manager.js";

const PROFILE_NAME = "F4HWN UV-K5v1/v3 UV-K1";
const DISPLAY_WIDTH = 128;
const DISPLAY_HEIGHT = 64;

// Pixel effect settings (same as display-mirror.js)
const pixelSize = 3;
const gapSize = 1;
const pixelColor = "#06080c";

// Check if this profile is selected
function isProfileActive() {
  const select = document.getElementById("mirrorProfileSelect");
  return select && select.value === "f4hwn";
}

// Elements and state
let canvas = null;
let context = null;
let shell = null;
let port = null;
let reader = null;
let writer = null;
let isSerialConnected = false;
let mirrorRunning = false;
let cleanupFn = null;
let keepaliveInterval = null;
let framebuffer = new Uint8Array(1024);

function updateStatus(connected, title, subtitle) {
  const statusDot = document.getElementById("mirrorStatusDot");
  const statusTitle = document.getElementById("mirrorStatusTitle");
  const statusSubtitle = document.getElementById("mirrorStatusSubtitle");
  
  if (statusDot) statusDot.dataset.status = connected ? "connected" : "disconnected";
  if (statusTitle) statusTitle.textContent = title;
  if (statusSubtitle) statusSubtitle.textContent = subtitle;
}

function updateControls() {
  const toggleBtn = document.getElementById("mirrorToggle");
  const toggleLabel = toggleBtn?.querySelector(".btn-label");
  const toggleIcon = toggleBtn?.querySelector("svg path");
  const saveBtn = document.getElementById("mirrorSave");
  const colorSelect = document.getElementById("mirrorColor");
  
  if (toggleBtn) toggleBtn.disabled = !isSerialConnected;
  if (saveBtn) saveBtn.disabled = !mirrorRunning;
  if (colorSelect) colorSelect.disabled = !mirrorRunning;
  
  if (toggleLabel) toggleLabel.textContent = mirrorRunning ? "Stop" : "Start";
  if (toggleIcon) {
    toggleIcon.setAttribute("d", mirrorRunning ? "M6 6h12v12H6z" : "M5 5l14 7-14 7z");
  }
}

// Draw pixel with gap and alpha effect (EXACT from display-mirror.js)
function drawPixel(x, y, isOn) {
  if (!context) return;
  context.globalAlpha = isOn ? 1 : 0.08;
  context.fillStyle = pixelColor;
  context.clearRect(x * (pixelSize + gapSize) + 1, y * (pixelSize + gapSize) + 1, pixelSize, pixelSize);
  context.fillRect(x * (pixelSize + gapSize) + 1, y * (pixelSize + gapSize) + 1, pixelSize, pixelSize);
  context.globalAlpha = 1;
}

function clearCanvas() {
  if (!context || !canvas) return;
  for (let y = 0; y < DISPLAY_HEIGHT; y++) {
    for (let x = 0; x < DISPLAY_WIDTH; x++) {
      drawPixel(x, y, false);
    }
  }
}

// F4HWN uses sequential bit addressing
function getBit(bitIdx) {
  const byteIdx = Math.floor(bitIdx / 8);
  const bitPos = bitIdx % 8;
  if (byteIdx < framebuffer.length) {
    return (framebuffer[byteIdx] >> bitPos) & 1;
  }
  return 0;
}

// Draw framebuffer with pixel effect
function drawFrame() {
  if (!context) return;
  
  for (let y = 0; y < DISPLAY_HEIGHT; y++) {
    for (let x = 0; x < DISPLAY_WIDTH; x++) {
      const bitIdx = y * DISPLAY_WIDTH + x;
      const isOn = getBit(bitIdx) === 1;
      drawPixel(x, y, isOn);
    }
  }
}

// Apply diff update (F4HWN specific)
function applyDiff(diffData) {
  for (let i = 0; i + 8 < diffData.length; i += 9) {
    const idx = diffData[i];
    for (let j = 0; j < 8 && (idx * 8 + j) < 1024; j++) {
      framebuffer[idx * 8 + j] = diffData[i + 1 + j];
    }
  }
}

// Send keepalive packet
async function sendKeepalive() {
  if (!writer || !mirrorRunning) return;
  try {
    await writer.write(new Uint8Array([0x55, 0xAA, 0x00, 0x00]));
  } catch (e) {
    console.error('[F4HWN] Keepalive error:', e);
  }
}

async function readLoop() {
  const buffer = new Uint8Array(4096);
  let bufferPos = 0;
  
  console.log('[F4HWN] Starting read loop...');
  
  while (mirrorRunning && reader) {
    try {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;
      
      // Add to buffer
      for (let i = 0; i < value.length && bufferPos < buffer.length; i++) {
        buffer[bufferPos++] = value[i];
      }
      
      // Process buffer
      while (bufferPos >= 5) {
        let startIdx = 0;
        
        // Check for 0xFF marker
        if (buffer[0] === 0xFF) {
          startIdx = 1;
        }
        
        // Check header
        if (buffer[startIdx] !== 0xAA || buffer[startIdx + 1] !== 0x55) {
          // Shift buffer by 1
          buffer.copyWithin(0, 1);
          bufferPos--;
          continue;
        }
        
        const frameType = buffer[startIdx + 2];
        const payloadLen = (buffer[startIdx + 3] << 8) | buffer[startIdx + 4];
        const totalLen = startIdx + 5 + payloadLen + 1;
        
        if (bufferPos < totalLen) break;
        
        const payload = buffer.slice(startIdx + 5, startIdx + 5 + payloadLen);
        
        if (frameType === 0x01 && payloadLen === 1024) {
          // Full screenshot
          framebuffer.set(payload);
          drawFrame();
          console.log('[F4HWN] Screenshot frame received');
        } else if (frameType === 0x02 && payloadLen > 0) {
          // Diff update
          applyDiff(payload);
          drawFrame();
        }
        
        // Remove processed data
        buffer.copyWithin(0, totalLen);
        bufferPos -= totalLen;
      }
      
    } catch (error) {
      if (mirrorRunning) {
        console.error('[F4HWN] Read error:', error);
      }
      break;
    }
  }
  
  console.log('[F4HWN] Read loop stopped');
}

async function startMirror() {
  if (!isProfileActive()) return;
  
  port = getPort();
  if (!port) {
    updateStatus(false, "Disconnected", "Connect to radio first.");
    return;
  }
  
  if (mirrorRunning) return;
  
  // Check if port is locked
  if (port.readable.locked) {
    console.log('[F4HWN] Port locked, waiting...');
    setTimeout(startMirror, 100);
    return;
  }
  
  try {
    reader = port.readable.getReader();
    writer = port.writable.getWriter();
    mirrorRunning = true;
    
    updateStatus(true, "Connected", "Streaming display data...");
    updateControls();
    console.log(`[F4HWN] Started display mirror`);
    
    // Start keepalive
    keepaliveInterval = setInterval(sendKeepalive, 1000);
    
    // Start reading
    await readLoop();
  } catch (e) {
    console.error('[F4HWN] Mirror error:', e);
    updateStatus(true, "Error", e.message);
  } finally {
    await stopMirror();
  }
}

async function stopMirror() {
  mirrorRunning = false;
  
  if (keepaliveInterval) {
    clearInterval(keepaliveInterval);
    keepaliveInterval = null;
  }
  
  if (reader) {
    try {
      await reader.cancel();
      reader.releaseLock();
    } catch (e) {}
    reader = null;
  }
  
  if (writer) {
    try {
      writer.releaseLock();
    } catch (e) {}
    writer = null;
  }
  
  updateStatus(isSerialConnected, isSerialConnected ? "Connected" : "Disconnected", 
               isSerialConnected ? "Mirror stopped." : "No radio connected.");
  updateControls();
  console.log(`[F4HWN] Stopped display mirror`);
}

async function toggleMirror() {
  if (!isProfileActive()) return;
  
  if (mirrorRunning) {
    await stopMirror();
  } else {
    await startMirror();
  }
}

function initMirror() {
  if (!isProfileActive()) return;
  
  console.log('[F4HWN] Initializing...');
  
  canvas = document.getElementById("lcdCanvas");
  shell = document.getElementById("lcdShell");
  
  if (canvas) {
    context = canvas.getContext("2d");
    clearCanvas();
  }
  
  // Reset framebuffer
  framebuffer = new Uint8Array(1024);
  
  // Get current connection state
  port = getPort();
  isSerialConnected = isConnected();
  
  updateStatus(isSerialConnected, isSerialConnected ? "Connected" : "Disconnected",
               isSerialConnected ? "Ready to start mirror." : "No radio connected.");
  updateControls();
}

function cleanupMirror() {
  if (mirrorRunning) {
    stopMirror();
  }
}

// Event handlers
document.addEventListener("DOMContentLoaded", () => {
  // Profile change handler
  const profileSelect = document.getElementById("mirrorProfileSelect");
  if (profileSelect) {
    profileSelect.addEventListener("change", () => {
      if (mirrorRunning && !isProfileActive()) {
        stopMirror();
      }
      if (isProfileActive()) {
        initMirror();
      }
    });
  }
  
  // Toggle button handler
  const toggleBtn = document.getElementById("mirrorToggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleMirror);
  }
  
  // Color select handler
  const colorSelect = document.getElementById("mirrorColor");
  if (colorSelect) {
    colorSelect.addEventListener("change", (e) => {
      if (shell) {
        shell.classList.toggle("lcd-amber", e.target.value === "amber");
        shell.classList.toggle("lcd-white", e.target.value === "white");
      }
    });
  }
  
  // Subscribe to serial-manager state changes
  cleanupFn = subscribe((state) => {
    port = state.port;
    isSerialConnected = state.connected;
    
    if (!isSerialConnected && mirrorRunning) {
      stopMirror();
    }
    
    if (isProfileActive()) {
      updateStatus(isSerialConnected, isSerialConnected ? "Connected" : "Disconnected",
                   isSerialConnected ? "Ready to start mirror." : "No radio connected.");
      updateControls();
    }
  });
});

// Handle page transitions
window.addEventListener("spa:page", (event) => {
  const isPageActive = event.detail?.pageId === "mirror";
  
  if (isPageActive && isProfileActive()) {
    initMirror();
  } else if (!isPageActive) {
    cleanupMirror();
  }
});

console.log('[F4HWN] Display Mirror module loaded');

export { startMirror, stopMirror, initMirror, cleanupMirror };
