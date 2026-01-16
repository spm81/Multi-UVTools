import { getPort, subscribe } from "./serial-manager.js";

const connectBtn = document.getElementById("smrConnect");
const disconnectBtn = document.getElementById("smrDisconnect");
const statusDot = document.getElementById("smrStatusDot");
const statusTitle = document.getElementById("smrStatusTitle");
const statusSubtitle = document.getElementById("smrStatusSubtitle");
const firmwareEl = document.getElementById("smrFirmware");
const errorEl = document.getElementById("smrError");
const logEl = document.getElementById("smsLog");
const clearBtn = document.getElementById("smsClear");
const inputEl = document.getElementById("smsInput");
const sendBtn = document.getElementById("smsSend");

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_SMS_LENGTH = 30;

let port = null;
let reader = null;
let isConnected = false;
let isAttached = false;
let isReading = false;
let textBuffer = "";
let lastSent = null;
let lastSentAt = 0;
let lastSentEntry = null;

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
  if (sendBtn) sendBtn.disabled = !isAttached;
  if (inputEl) inputEl.disabled = !isAttached;
};

const appendMessage = (message, direction = "system", label = "SYS") => {
  if (!logEl) return;
  const entry = document.createElement("div");
  entry.className = "sms-entry";
  if (direction === "system") {
    entry.dataset.tone = "system";
  } else {
    entry.dataset.direction = direction;
  }

  const labelEl = document.createElement("span");
  labelEl.className = "sms-label";
  labelEl.textContent = label;

  const textEl = document.createElement("span");
  textEl.className = "sms-text";
  textEl.textContent = message || "";

  entry.append(labelEl, textEl);
  logEl.append(entry);
  logEl.scrollTop = logEl.scrollHeight;
  return entry;
};

const markLastSentReceived = (stationId = "") => {
  if (!lastSentEntry) return;
  lastSentEntry.classList.add("sms-ack");
  if (!lastSentEntry.querySelector(".sms-meta")) {
    const metaEl = document.createElement("span");
    metaEl.className = "sms-meta";
    metaEl.textContent = stationId || "OK";
    lastSentEntry.append(metaEl);
  }
};

const shouldSkipEcho = (message) => {
  if (!lastSent) return false;
  const isSame = message.trim() === lastSent;
  const within = Date.now() - lastSentAt < 2000;
  if (isSame && within) {
    lastSent = null;
    return true;
  }
  return false;
};

const handleLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  if (trimmed.startsWith("SVC<RCPT")) {
    const match = trimmed.match(/^SVC<RCPT\[(.+)\]$/);
    const stationId = match ? match[1].trim() : "";
    markLastSentReceived(stationId);
    return;
  }
  if (trimmed.startsWith("SMS[")) {
    const match = trimmed.match(/^SMS\[(.+?)\]\s*<\s*(.*)$/);
    if (match) {
      const stationId = match[1].trim();
      const message = match[2].trim();
      appendMessage(message, "in", stationId || "SMS<");
      return;
    }
  }
  if (trimmed.startsWith("SMS<")) {
    const message = trimmed.slice(4).trimStart();
    appendMessage(message, "in", "SMS<");
    return;
  }
  if (trimmed.startsWith("SMS>")) {
    const message = trimmed.slice(4).trimStart();
    if (shouldSkipEcho(message)) return;
    lastSentEntry = appendMessage(message, "out", "SMS>");
    return;
  }
  appendMessage(trimmed, "system", "SYS");
};

const flushLines = () => {
  let newlineIndex = textBuffer.indexOf("\n");
  while (newlineIndex !== -1) {
    let line = textBuffer.slice(0, newlineIndex);
    if (line.endsWith("\r")) line = line.slice(0, -1);
    textBuffer = textBuffer.slice(newlineIndex + 1);
    handleLine(line);
    newlineIndex = textBuffer.indexOf("\n");
  }
};

const startReader = async (retryCount = 0) => {
  if (!port || !port.readable || isReading) return;
  
  // Check if port is already locked - retry with delay (page transitions need time)
  if (port.readable.locked) {
    if (retryCount < 5) {
      // Wait and retry - allows other modules to release the port
      setTimeout(() => startReader(retryCount + 1), 100);
      return;
    }
    setError("Serial port is busy. Close other tools first.");
    return;
  }
  
  setError(""); // Clear any previous errors
  reader = port.readable.getReader();
  isReading = true;
  try {
    while (isReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      textBuffer += decoder.decode(value, { stream: true });
      flushLines();
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

const stopReader = async () => {
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

const connectToDevice = async () => {};

const disconnectFromDevice = async () => {};

let isPageActive = false;

const updateAttachment = () => {
  const shouldAttach = isConnected && isPageActive;
  if (shouldAttach === isAttached) {
    updateControls();
    return;
  }
  isAttached = shouldAttach;
  if (isAttached) {
    textBuffer = "";
    startReader();
    setStatus(true, "Connected", "Ready to exchange SMS frames.");
  } else {
    stopReader();
    setStatus(isConnected, isConnected ? "Connected" : "Disconnected", isConnected ? "SMR idle." : "No radio connected.");
  }
  updateControls();
};

const sendMessage = async () => {
  if (!port || !port.writable || !inputEl) return;
  const raw = inputEl.value.trim();
  if (!raw) return;
  if (raw.length > MAX_SMS_LENGTH) {
    setError(`Message must be ${MAX_SMS_LENGTH} characters or less.`);
    inputEl.focus();
    return;
  }
  setError("");
  const message = raw.toUpperCase();
  const payload = `SMS:${message}\r\n`;
  
  // Check if port is locked
  if (port.writable.locked) {
    setError("Serial port is busy. Try again.");
    return;
  }
  
  const writer = port.writable.getWriter();
  try {
    await writer.write(encoder.encode(payload));
    lastSent = message;
    lastSentAt = Date.now();
    lastSentEntry = appendMessage(message, "out", "SMS>");
    inputEl.value = "";
    inputEl.focus();
  } catch (error) {
    setError(`Failed to send SMS: ${error.message || error}`);
  } finally {
    writer.releaseLock();
  }
};

const clearLog = () => {
  if (!logEl) return;
  logEl.textContent = "";
  lastSentEntry = null;
};

if (connectBtn) connectBtn.addEventListener("click", connectToDevice);
if (disconnectBtn) disconnectBtn.addEventListener("click", disconnectFromDevice);
if (sendBtn) sendBtn.addEventListener("click", sendMessage);
if (clearBtn) clearBtn.addEventListener("click", clearLog);
if (inputEl) {
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });
}

window.addEventListener("spa:page", (event) => {
  isPageActive = event.detail && event.detail.pageId === "smr";
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
