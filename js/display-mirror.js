import { sendPacket } from "./protocol.js";
import {
  getPort,
  subscribe,
} from "./serial-manager.js";

const lcdSizeX = 128;
const lcdSizeY = 64;
const pixelSize = 3;
const gapSize = 1;
const pixelColor = "#06080c";

const canvas = document.getElementById("lcdCanvas");
const shell = document.getElementById("lcdShell");
const connectBtn = document.getElementById("mirrorConnect");
const disconnectBtn = document.getElementById("mirrorDisconnect");
const toggleBtn = document.getElementById("mirrorToggle");
const toggleIcon = toggleBtn ? toggleBtn.querySelector("svg path") : null;
const toggleLabel = toggleBtn ? toggleBtn.querySelector(".btn-label") : null;
const saveBtn = document.getElementById("mirrorSave");
const statusDot = document.getElementById("mirrorStatusDot");
const statusTitle = document.getElementById("mirrorStatusTitle");
const statusSubtitle = document.getElementById("mirrorStatusSubtitle");
const firmwareEl = document.getElementById("mirrorFirmware");
const errorEl = document.getElementById("mirrorError");
const colorSelect = document.getElementById("mirrorColor");

const context = canvas ? canvas.getContext("2d") : null;
let port = null;
let reader = null;
let isConnected = false;
let isAttached = false;
let isStreaming = false;
let isReading = false;
let serialBuffer = new Uint8Array();

const setStatus = (connected, title, subtitle) => {
  if (statusDot) statusDot.dataset.status = connected ? "connected" : "disconnected";
  if (statusTitle) statusTitle.textContent = title;
  if (statusSubtitle) statusSubtitle.textContent = subtitle;
};

const setError = (message) => {
  if (!errorEl) return;
  if (!message) {
    errorEl.hidden = true;
    errorEl.textContent = "";
    return;
  }
  errorEl.textContent = message;
  errorEl.hidden = false;
};

const updateControls = () => {
  if (connectBtn) connectBtn.disabled = isAttached;
  if (disconnectBtn) disconnectBtn.disabled = !isAttached;
  if (toggleBtn) toggleBtn.disabled = !isAttached;
  if (saveBtn) saveBtn.disabled = !isAttached;
  if (colorSelect) colorSelect.disabled = !isAttached;
  if (toggleLabel) {
    toggleLabel.textContent = isStreaming ? "Stop" : "Start";
  }
  if (toggleIcon) {
    toggleIcon.setAttribute("d", isStreaming ? "M6 6h12v12H6z" : "M5 5l14 7-14 7z");
  }
};

const drawPixel = (x, y, isOn) => {
  if (!context) return;
  context.globalAlpha = isOn ? 1 : 0.08;
  context.fillStyle = pixelColor;
  context.clearRect(x * (pixelSize + gapSize) + 1, y * (pixelSize + gapSize) + 1, pixelSize, pixelSize);
  context.fillRect(x * (pixelSize + gapSize) + 1, y * (pixelSize + gapSize) + 1, pixelSize, pixelSize);
  context.globalAlpha = 1;
};

const clearCanvas = (initPixels) => {
  if (!context || !canvas) return;
  if (!initPixels) return;
  for (let y = 0; y < lcdSizeY; y += 1) {
    for (let x = 0; x < lcdSizeX; x += 1) {
      drawPixel(x, y, false);
    }
  }
};

const updateDisplay = (displayArray) => {
  if (!context || !displayArray) return;
  for (let a = 0; a < lcdSizeX; a += 1) {
    for (let b = 0; b < 8; b += 1) {
      const binaryString = displayArray[a + b * lcdSizeX]
        .toString(2)
        .padStart(8, "0")
        .split("")
        .reverse();
      for (let i = 0; i < 8; i += 1) {
        drawPixel(a, i + b * 8, binaryString[i] === "1");
      }
    }
  }
};

const updateStatusDisplay = (displayArray) => {
  if (!context || !displayArray) return;
  const b = 0;
  for (let a = 0; a < lcdSizeX; a += 1) {
    const binaryString = displayArray[a + b * lcdSizeX]
      .toString(2)
      .padStart(8, "0")
      .split("")
      .reverse();
    for (let i = 0; i < 8; i += 1) {
      drawPixel(a, i + b * 8, binaryString[i] === "1");
    }
  }
};

const processSerialBuffer = () => {
  while (serialBuffer.length > 0 && serialBuffer[0] !== 0xab) {
    serialBuffer = serialBuffer.slice(1);
  }

  while (serialBuffer.length >= 2 && serialBuffer[0] === 0xab) {
    if (serialBuffer[1] === 0xee) {
      const payloadLength = 128 + 2;
      if (serialBuffer.length < payloadLength) return;
      const packet = serialBuffer.slice(2, payloadLength);
      updateStatusDisplay(packet);
      serialBuffer = serialBuffer.slice(payloadLength);
      continue;
    }

    if (serialBuffer[1] === 0xed) {
      const payloadLength = 1024 + 2;
      if (serialBuffer.length < payloadLength) return;
      const packet = serialBuffer.slice(2, payloadLength);
      updateDisplay(packet);
      serialBuffer = serialBuffer.slice(payloadLength);
      continue;
    }

    if (serialBuffer.length >= 4 && serialBuffer[1] === 0xcd) {
      const payloadLength = serialBuffer[2] + (serialBuffer[3] << 8);
      const totalPacketLength = payloadLength + 8;
      if (serialBuffer.length < totalPacketLength) return;
      serialBuffer = serialBuffer.slice(totalPacketLength);
      continue;
    }

    return;
  }
};

const startStreamReader = async () => {
  if (!port || !port.readable || isReading) return;
  reader = port.readable.getReader();
  isReading = true;

  try {
    while (isReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      serialBuffer = new Uint8Array([...serialBuffer, ...value]);
      processSerialBuffer();
    }
  } catch (error) {
    if (isReading) {
      setError(`Serial read error: ${error.message || error}`);
    }
  } finally {
    isReading = false;
    if (reader) {
      try {
        reader.releaseLock();
      } catch {
        // Ignore release errors.
      }
    }
  }
};

const stopStreamReader = async () => {
  isReading = false;
  if (reader) {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancel errors.
    }
  }
  reader = null;
};

const startMirror = async () => {
  if (!port) return;
  try {
    const packet = new Uint8Array([0x03, 0x0a, 0xff, 0xff, 0xff, 0xff]);
    await sendPacket(port, packet);
    isStreaming = true;
    updateControls();
    setStatus(true, "Connected", "Streaming display data.");
  } catch (error) {
    setError(`Failed to start mirror: ${error.message || error}`);
  }
};

const stopMirror = async () => {
  if (!port) return;
  try {
    const packet = new Uint8Array([0x04, 0x0a, 0xff, 0xff, 0xff, 0xff]);
    await sendPacket(port, packet);
  } catch (error) {
    setError(`Failed to stop mirror: ${error.message || error}`);
  } finally {
    isStreaming = false;
    updateControls();
    if (isConnected) {
      setStatus(true, "Connected", "Mirror stopped.");
    }
  }
};

const connectToDevice = async () => {};

const disconnectFromDevice = async () => {};

const updateAttachment = () => {
  const shouldAttach = isConnected && isPageActive;
  if (shouldAttach === isAttached) {
    updateControls();
    return;
  }
  isAttached = shouldAttach;
  if (isAttached) {
    serialBuffer = new Uint8Array();
    startStreamReader();
    if (isStreaming) {
      setStatus(true, "Connected", "Streaming display data.");
    } else {
      setStatus(true, "Connected", "Ready to start the mirror.");
    }
  } else {
    if (isStreaming) {
      isStreaming = false;
    }
    stopStreamReader();
    clearCanvas(true);
    setStatus(isConnected, isConnected ? "Connected" : "Disconnected", isConnected ? "Mirror idle." : "No radio connected.");
  }
  updateControls();
};

const toggleMirror = async () => {
  if (isStreaming) {
    await stopMirror();
  } else {
    await startMirror();
  }
};

const saveScreenshot = () => {
  if (!canvas) return;
  const isAmber = colorSelect && colorSelect.value === "amber";
  const padding = 6;
  const temp = document.createElement("canvas");
  temp.width = canvas.width + padding * 2;
  temp.height = canvas.height + padding * 2;
  const tempContext = temp.getContext("2d");
  if (!tempContext) return;
  tempContext.fillStyle = isAmber ? "#f5a43a" : "#e0ebff";
  tempContext.fillRect(0, 0, temp.width, temp.height);
  tempContext.drawImage(canvas, padding, padding);

  const link = document.createElement("a");
  link.download = "uv-k5-screenshot.png";
  link.href = temp.toDataURL("image/png").replace("image/png", "image/octet-stream");
  link.click();
};

const setColorMode = (mode) => {
  if (!shell) return;
  shell.classList.toggle("lcd-amber", mode === "amber");
  shell.classList.toggle("lcd-white", mode === "white");
};

if (canvas) {
  clearCanvas(true);
}

if (connectBtn) connectBtn.addEventListener("click", connectToDevice);
if (disconnectBtn) disconnectBtn.addEventListener("click", disconnectFromDevice);
if (toggleBtn) toggleBtn.addEventListener("click", toggleMirror);
if (saveBtn) saveBtn.addEventListener("click", saveScreenshot);
if (colorSelect) {
  colorSelect.addEventListener("change", (event) => {
    setColorMode(event.target.value);
  });
  setColorMode(colorSelect.value);
}

let isPageActive = false;

window.addEventListener("spa:page", (event) => {
  isPageActive = event.detail && event.detail.pageId === "mirror";
  updateAttachment();
});

subscribe((state) => {
  port = state.port;
  isConnected = state.connected;
  if (firmwareEl) {
    firmwareEl.textContent = state.firmwareVersion || "-";
  }
  updateAttachment();
});

updateControls();
