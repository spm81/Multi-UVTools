/**
 * RT-880 Web Remote — adapted from NicSure's webremote_nicfw880
 * Original: https://github.com/nicsure/webremote_nicfw880
 * Adapted for Multi-UVTools by Matoz
 *
 * Uses its own serial connection at 38400 baud (independent from main app).
 */

(function () {
  'use strict';

  // ── Protocol constants ──
  const START_SESSION = new Uint8Array([0xaa, 0x51]);
  const EXIT_SESSION  = new Uint8Array([0x52]);
  const PING_BYTE     = 0xaa;

  const FONT_METRICS = {
    0: { width: 8,  height: 8,  size: 8  },
    1: { width: 8,  height: 16, size: 16 },
    2: { width: 16, height: 16, size: 16 },
    3: { width: 16, height: 24, size: 24 },
    4: { width: 24, height: 24, size: 24 },
    5: { width: 24, height: 32, size: 32 },
    6: { width: 16, height: 16, size: 16 },
  };

  const DISPLAY_SCALE = 2;

  const SYMBOL_MAP = {
    32: ' ', 33: '🔒', 34: '🆔', 35: '💬', 36: '🔍', 37: '⏸',
    38: '▲', 39: '🔑', 40: '🔄', 41: '↑', 42: '↓', 43: '←',
    44: '→', 45: '−', 46: '+', 47: '⚠', 48: '🅧🅑', 49: '🌙',
    50: '🌧', 51: '♪', 52: '⚡', 53: '●', 54: '📡', 55: '📶',
    56: '🧭', 57: '🧭', 58: '🔇',
  };

  // ── DOM elements ──
  const connectBtn      = document.getElementById('rt880RemoteConnectBtn');
  const disconnectBtn   = document.getElementById('rt880RemoteDisconnectBtn');
  const startBtn        = document.getElementById('rt880RemoteStartBtn');
  const exitBtn         = document.getElementById('rt880RemoteExitBtn');
  const clearBtn        = document.getElementById('rt880RemoteClearBtn');
  const statusLabel     = document.getElementById('rt880RemoteStatus');
  const pingLabel       = document.getElementById('rt880RemotePing');
  const checksumLabel   = document.getElementById('rt880RemoteChecksum');
  const ledDot          = document.getElementById('rt880RemoteLed');
  const canvas          = document.getElementById('rt880RemoteDisplay');
  const ctx             = canvas.getContext('2d');

  // ── State ──
  let port            = null;
  let reader           = null;
  let writer           = null;
  let pingInterval     = null;
  let lastPingReply    = null;
  let sessionActive    = false;
  let sessionStarting  = false;
  let sessionStartTime = null;

  // ── Helpers ──
  function setStatus(text) { statusLabel.textContent = text; }

  function setChecksumStatus(text, ok) {
    checksumLabel.textContent = text;
    checksumLabel.style.color = ok ? '' : 'var(--danger, #b00020)';
  }

  function updatePingStatus() {
    if (!lastPingReply) { pingLabel.textContent = 'Ping: --'; return; }
    const delta = Math.round((Date.now() - lastPingReply) / 100) / 10;
    pingLabel.textContent = `Ping: ${delta.toFixed(1)}s`;
  }

  function rgb565ToHex(v) {
    const r = Math.round(((v >> 11) & 0x1f) * (255 / 31));
    const g = Math.round(((v >> 5) & 0x3f) * (255 / 63));
    const b = Math.round((v & 0x1f) * (255 / 31));
    return `rgb(${r},${g},${b})`;
  }

  function computeChecksum(bytes) {
    let sum = 0;
    for (const b of bytes) sum = (sum + b) & 0xff;
    return sum;
  }

  // ── Display ──
  function clearDisplay() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawText({ x, y, font, background, foreground, text }) {
    const m = FONT_METRICS[font] ?? FONT_METRICS[0];
    const w = m.width * text.length * DISPLAY_SCALE;
    const h = m.height * DISPLAY_SCALE;
    ctx.fillStyle = rgb565ToHex(background);
    ctx.fillRect(x, y, w, h);
    ctx.textBaseline = 'top';
    ctx.fillStyle = rgb565ToHex(foreground);
    if (font === 6) {
      const fs = m.size * DISPLAY_SCALE * 0.85;
      ctx.font = `${fs}px monospace`;
      [...text].forEach((ch, i) => {
        const code = ch.charCodeAt(0);
        ctx.fillText(SYMBOL_MAP[code] ?? ch, x + i * m.width * DISPLAY_SCALE, y);
      });
      return;
    }
    ctx.font = `${m.size * DISPLAY_SCALE}px monospace`;
    ctx.fillText(text, x, y);
  }

  function drawRect({ x, y, width, height, color }) {
    ctx.fillStyle = rgb565ToHex(color);
    ctx.fillRect(x, y, width, height);
  }

  function updateLed(status) {
    const colors = { 0x00: '#1c1e26', 0x01: '#e53935', 0x02: '#43a047', 0x03: '#fbc02d' };
    ledDot.style.background = colors[status] ?? '#1c1e26';
  }

  // ── Packet parser ──
  class PacketParser {
    constructor(onPacket, onPing) {
      this.buffer = [];
      this.onPacket = onPacket;
      this.onPing = onPing;
    }
    feed(chunk) {
      for (const byte of chunk) {
        if (byte === PING_BYTE && this.buffer.length === 0) { this.onPing(); continue; }
        this.buffer.push(byte);
        this._process();
      }
    }
    _process() {
      while (this.buffer.length > 0) {
        if (this.buffer[0] !== 0x55) { this.buffer.shift(); continue; }
        if (this.buffer.length < 2) return;
        const type = this.buffer[1];
        if (type === 0x01) {
          if (this.buffer.length < 11) return;
          const pkt = this.buffer.splice(0, 11);
          this.onPacket(pkt);
          continue;
        }
        if (type === 0x03) {
          if (this.buffer.length < 4) return;
          const pkt = this.buffer.splice(0, 4);
          this.onPacket(pkt);
          continue;
        }
        if (type === 0x02) {
          if (this.buffer.length < 11) return;
          const ti = this.buffer.indexOf(0x00, 10);
          if (ti === -1) return;
          const len = ti + 2;
          if (this.buffer.length < len) return;
          const pkt = this.buffer.splice(0, len);
          this.onPacket(pkt);
          continue;
        }
        this.buffer.shift();
      }
    }
  }

  function parsePacket(pkt) {
    const cs = pkt[pkt.length - 1];
    const cc = computeChecksum(pkt.slice(0, -1));
    const ok = cs === cc;
    setChecksumStatus(`Checksum: ${ok ? 'OK' : 'BAD'}`, ok);
    if (!ok) return;
    const type = pkt[1];
    if (type === 0x01) {
      drawRect({
        x: pkt[2] * DISPLAY_SCALE,
        y: (pkt[3] | (pkt[4] << 8)) * DISPLAY_SCALE,
        width: pkt[5] * DISPLAY_SCALE,
        height: (pkt[6] | (pkt[7] << 8)) * DISPLAY_SCALE,
        color: pkt[8] | (pkt[9] << 8),
      });
    } else if (type === 0x02) {
      const textBytes = pkt.slice(10, -1);
      const text = new TextDecoder().decode(Uint8Array.from(textBytes)).replace(/\u0000$/, '');
      drawText({
        x: pkt[2] * DISPLAY_SCALE,
        y: (pkt[3] | (pkt[4] << 8)) * DISPLAY_SCALE,
        font: pkt[5],
        background: pkt[6] | (pkt[7] << 8),
        foreground: pkt[8] | (pkt[9] << 8),
        text,
      });
    } else if (type === 0x03) {
      updateLed(pkt[2]);
    }
  }

  // ── Serial ──
  async function sendBytes(bytes) {
    if (!writer) return;
    await writer.write(bytes);
  }

  async function readLoop() {
    const parser = new PacketParser(parsePacket, () => {
      lastPingReply = Date.now();
      updatePingStatus();
      if (sessionStarting) {
        sessionStarting = false;
        sessionActive = true;
        updateButtons();
        setStatus('Session active');
      }
    });
    while (port && reader) {
      try {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) parser.feed(value);
      } catch (e) { console.error('[RT880 Remote]', e); break; }
    }
  }

  // ── Ping ──
  function startPing() {
    stopPing();
    pingInterval = setInterval(async () => {
      try { await sendBytes(Uint8Array.from([PING_BYTE])); } catch (e) { console.error(e); }
      updatePingStatus();
      const now = Date.now();
      if (sessionStarting && sessionStartTime && now - sessionStartTime > 5000 && !lastPingReply) {
        await sendBytes(EXIT_SESSION);
        endSession('Ping timeout');
        return;
      }
      if (sessionActive && lastPingReply && now - lastPingReply > 5000) {
        await sendBytes(EXIT_SESSION);
        endSession('Ping timeout');
      }
    }, 1000);
  }

  function stopPing() {
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
    lastPingReply = null;
    updatePingStatus();
  }

  // ── Session management ──
  function updateButtons() {
    const connected = Boolean(port);
    connectBtn.disabled    = connected;
    disconnectBtn.disabled = !connected;
    startBtn.disabled      = !connected || sessionActive || sessionStarting;
    exitBtn.disabled       = !connected || !sessionActive;
    clearBtn.disabled      = false;
  }

  function beginSession() {
    sessionStarting = true;
    sessionActive = false;
    sessionStartTime = Date.now();
    lastPingReply = null;
    updatePingStatus();
    updateButtons();
    startPing();
    setStatus('Starting session...');
  }

  function endSession(msg) {
    sessionStarting = false;
    sessionActive = false;
    sessionStartTime = null;
    lastPingReply = null;
    stopPing();
    updatePingStatus();
    updateButtons();
    if (msg) setStatus(msg);
  }

  // ── Connect / Disconnect ──
  async function connectRemote() {
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 38400 });
      writer = port.writable.getWriter();
      reader = port.readable.getReader();
      setStatus('Connected');
      updateButtons();
      readLoop();
    } catch (e) {
      console.error('[RT880 Remote]', e);
      setStatus('Connection failed');
    }
  }

  async function disconnectRemote() {
    stopPing();
    if (reader) { await reader.cancel(); reader.releaseLock(); reader = null; }
    if (writer) { writer.releaseLock(); writer = null; }
    if (port) { await port.close(); port = null; }
    endSession();
    updateButtons();
    setStatus('Disconnected');
  }

  // ── Keypad events ──
  function handleKeyPress(e) {
    if (!sessionActive) return;
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    sendBytes(Uint8Array.from([Number(key)]));
  }

  function handleKeyRelease(e) {
    if (!sessionActive) return;
    const release = e.currentTarget.dataset.release;
    if (!release) return;
    sendBytes(Uint8Array.from([Number(release)]));
  }

  // ── Init ──
  function init() {
    connectBtn.addEventListener('click', connectRemote);
    disconnectBtn.addEventListener('click', disconnectRemote);
    startBtn.addEventListener('click', () => { beginSession(); sendBytes(START_SESSION); });
    exitBtn.addEventListener('click', () => { sendBytes(EXIT_SESSION); endSession('Session ended'); });
    clearBtn.addEventListener('click', clearDisplay);

    document.querySelectorAll('#rt880-remote .rt880r-key').forEach(btn => {
      btn.addEventListener('pointerdown', handleKeyPress);
      btn.addEventListener('pointerup', handleKeyRelease);
      btn.addEventListener('pointerleave', handleKeyRelease);
    });

    clearDisplay();
    updateButtons();
    setChecksumStatus('Checksum: --', true);
    updatePingStatus();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
