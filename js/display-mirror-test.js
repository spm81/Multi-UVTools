// display-mirror-test.js - Display Mirror Test Profile
// Profile: Test/Debug

import { sendPacket } from "./protocol.js";
import { getPort, subscribe } from "./serial-manager.js";

const PROFILE_NAME = "Test Profile";

// Check if this profile is selected
function isProfileActive() {
  const select = document.getElementById("mirrorProfileSelect");
  return select && select.value === "test";
}
const CMD_READ_DISPLAY = 0x15;
const DISPLAY_WIDTH = 128;
const DISPLAY_HEIGHT = 64;

let mirrorCanvas = null;
let mirrorCtx = null;
let mirrorRunning = false;
let mirrorReader = null;
let cleanupFn = null;

function updateStatus(msg) {
  const el = document.getElementById("mirrorStatus");
  if (el) el.textContent = `[${PROFILE_NAME}] ${msg}`;
}

function logMirror(msg, type = "info") {
  console.log(`[Mirror-Test] ${msg}`);
  const logEl = document.getElementById("logOutput");
  if (logEl) {
    const div = document.createElement("div");
    div.className = `log-${type}`;
    div.textContent = `[Mirror] ${msg}`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

async function requestDisplayFrame(port) {
  if (!port?.writable) return null;
  const writer = port.writable.getWriter();
  try {
    const cmd = sendPacket([CMD_READ_DISPLAY]);
    await writer.write(cmd);
  } finally {
    writer.releaseLock();
  }
  return true;
}

function drawTestPattern() {
  if (!mirrorCtx) return;
  
  // Draw a test pattern
  const imageData = mirrorCtx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
  const t = Date.now() / 1000;
  
  for (let y = 0; y < DISPLAY_HEIGHT; y++) {
    for (let x = 0; x < DISPLAY_WIDTH; x++) {
      const idx = (y * DISPLAY_WIDTH + x) * 4;
      const pattern = Math.sin(x * 0.1 + t) * Math.cos(y * 0.1 + t) > 0 ? 255 : 0;
      imageData.data[idx] = pattern;
      imageData.data[idx + 1] = pattern;
      imageData.data[idx + 2] = pattern;
      imageData.data[idx + 3] = 255;
    }
  }
  
  mirrorCtx.putImageData(imageData, 0, 0);
}

async function startMirror() {
  const port = getPort();
  
  mirrorRunning = true;
  updateStatus("Running (test pattern)...");
  logMirror(`Started display mirror (${PROFILE_NAME})`);
  
  const toggleLabelStart = document.getElementById("mirrorToggle")?.querySelector(".btn-label");
    if (toggleLabelStart) toggleLabelStart.textContent = "Stop";
  // mirrorStopBtn not used?.removeAttribute("disabled");
  
  // If no port, show test pattern
  if (!port) {
    logMirror("No connection - showing test pattern", "warning");
    while (mirrorRunning) {
      drawTestPattern();
      await new Promise(r => setTimeout(r, 100));
    }
    return;
  }
  
  // Normal operation with port
  try {
    mirrorReader = port.readable.getReader();
    // ... normal read loop would go here
  } catch (e) {
    logMirror(`Mirror error: ${e.message}`, "error");
  } finally {
    await stopMirror();
  }
}

async function stopMirror() {
  mirrorRunning = false;
  
  if (mirrorReader) {
    try {
      await mirrorReader.cancel();
      mirrorReader.releaseLock();
    } catch (e) {}
    mirrorReader = null;
  }
  
  updateStatus("Stopped");
  const toggleLabelStop = document.getElementById("mirrorToggle")?.querySelector(".btn-label");
  if (toggleLabelStop) toggleLabelStop.textContent = "Start";
  // mirrorStopBtn not used?.setAttribute("disabled", "");
  logMirror(`Stopped display mirror (${PROFILE_NAME})`);
}

function initMirror() {
  mirrorCanvas = document.getElementById("mirrorCanvas");
  if (!mirrorCanvas) return;
  
  mirrorCtx = mirrorCanvas.getContext("2d");
  mirrorCtx.fillStyle = "#000";
  mirrorCtx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
  
  document.getElementById("mirrorToggle")?.addEventListener("click", async () => {
    if (!isProfileActive()) return;
    if (mirrorRunning) {
      await stopMirror();
    } else {
      await startMirror();
    }
  });
  
  cleanupFn = subscribe((connected) => {
    if (!connected && mirrorRunning) {
      // Don't stop in test mode - just note it
      logMirror("Radio disconnected", "warning");
    }
  });
  
  updateStatus("Ready");
  logMirror(`Initialized ${PROFILE_NAME}`);
}

function cleanupMirror() {
  stopMirror();
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}

document.addEventListener("spa:page", (e) => {
  if (e.detail?.page === "mirror") {
    initMirror();
  } else {
    cleanupMirror();
  }
});

if (document.querySelector("#mirror.active, .page#mirror.active")) {
  initMirror();
}

export { startMirror, stopMirror, initMirror, cleanupMirror };
