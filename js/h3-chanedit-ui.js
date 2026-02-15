// h3-chanedit-ui.js
// TD-H3/H8 Channel Editor
// Adapted from h3webtools by nicFW

'use strict';

// ========== STATE ==========
let h3ChanPort = null;
let h3ChanWriter = null;
let h3ChanReader = null;
let h3ChanRows = [];
let h3ChanTargetRow = null;
const H3_IDLE = -1;
const H3_CS_OK = -2;
const H3_CS_BAD = -3;
const H3_ACK = -4;
let h3ChanState = H3_IDLE;
let h3ChanBusy = false;
const h3ChanBlock = new Uint8Array(33);
const h3ChanEePacket = new Uint8Array(2);
const h3ChanByteCommand = new Uint8Array(1);

// ========== UI ELEMENTS ==========
const h3ChanGrid = document.getElementById('h3ChanGrid');
const h3ChanConnectBtn = document.getElementById('h3ChanConnectBtn');
const h3ChanReadBtn = document.getElementById('h3ChanReadBtn');
const h3ChanWriteBtn = document.getElementById('h3ChanWriteBtn');
const h3ChanSaveBtn = document.getElementById('h3ChanSaveBtn');
const h3ChanLoadBtn = document.getElementById('h3ChanLoadBtn');
const h3ChanStatus = document.getElementById('h3ChanStatus');
const h3ChanCsvFile = document.getElementById('h3ChanCsvFile');
const h3ChanScroller = document.getElementById('h3ChanScroller');

// ========== HELPERS ==========
function h3ChanLog(message) {
  if (h3ChanStatus) h3ChanStatus.textContent = message;
  console.log(`[H3 Chan] ${message}`);
}

function h3ChanClamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}

function h3ChanFormatFreq(ele) {
  ele.value = parseFloat(ele.value < 18 ? 0 : ele.value > 1300 ? 1300 : ele.value).toFixed(5);
}

function h3ChanFormatTone(ele) {
  const cts = parseFloat(ele.value);
  if (cts > 0 && cts <= 3000) ele.value = cts.toFixed(1);
}

function h3ChanToGroupWord(letters) {
  let r = 0;
  for (let i = letters.length - 1; i >= 0; i--) {
    const cc = letters.toUpperCase().charCodeAt(i) - 64;
    if (cc > 0 && cc < 16) {
      r <<= 4;
      r &= 0xffff;
      r |= cc;
    }
  }
  return r;
}

function h3ChanToGroupString(groupw) {
  let r = "";
  groupw &= 0xffff;
  while (groupw > 0) {
    const nib = groupw & 0xf;
    if (nib > 0) r += String.fromCharCode(nib + 64);
    groupw >>= 4;
  }
  return r;
}

function h3ChanToToneString(tonew) {
  if (tonew > 0 && tonew <= 3000) return tonew / 10.0;
  if (tonew > 0x8000) {
    const rev = tonew > 0xc000;
    let tone = tonew & 0x3fff;
    if (tone < 512) {
      let str = "D";
      for (let w = 0; w < 3; w++) {
        const dig = (tone & 0x1c0) >> 6;
        tone <<= 3;
        str += dig;
      }
      str += rev ? "I" : "N";
      return str;
    }
  }
  return "Off";
}

function h3ChanToToneWord(tone) {
  const tonew = Math.round(Math.abs(parseFloat(tone)) * 10.0);
  if (tonew >= 0 && tonew <= 3000) return tonew;
  const toneu = String(tone).toUpperCase();
  const len = toneu.length - 1;
  if (len > 1) {
    if (toneu[0] === 'D' && (toneu[len] === 'N' || toneu[len] === 'I')) {
      let oct = 0;
      let mag = 1;
      const rev = toneu[len] === 'I';
      for (let q = len - 1; q >= 1; q--) {
        oct += parseInt(toneu[q]) * mag;
        mag *= 8;
      }
      if (oct >= 1 && oct <= 511) {
        oct += 0x8000;
        if (rev) oct += 0x4000;
        return oct;
      }
    }
  }
  return 0;
}

function h3ChanSetNum16(index, num) {
  h3ChanBlock[index++] = num & 0xff;
  num >>= 8;
  h3ChanBlock[index] = num & 0xff;
}

function h3ChanSetNum32(index, num) {
  h3ChanBlock[index++] = num & 0xff;
  num >>= 8;
  h3ChanBlock[index++] = num & 0xff;
  num >>= 8;
  h3ChanBlock[index++] = num & 0xff;
  num >>= 8;
  h3ChanBlock[index] = num & 0xff;
}

function h3ChanToNum16(index) {
  return h3ChanBlock[index] + (h3ChanBlock[index + 1] << 8);
}

function h3ChanToNum32(index) {
  return h3ChanBlock[index] + (h3ChanBlock[index + 1] << 8) + (h3ChanBlock[index + 2] << 16) + (h3ChanBlock[index + 3] << 24);
}

function h3ChanToFreq(index) {
  const f = h3ChanClamp(h3ChanToNum32(index) / 100000.0, 0.0, 1300.0);
  return f < 18 ? 0 : f;
}

// ========== SERIAL ==========
function h3ChanDisposeSerial() {
  try { if (h3ChanWriter) h3ChanWriter.releaseLock(); } catch {}
  try { if (h3ChanReader) h3ChanReader.releaseLock(); } catch {}
  try { if (h3ChanPort) h3ChanPort.close(); } catch {}
}

function h3ChanCloseSerial() {
  h3ChanDisposeSerial();
  h3ChanPort = null;
  h3ChanReader = null;
  h3ChanWriter = null;
}

async function h3ChanOpenSerial() {
  if (h3ChanPort) {
    try {
      await h3ChanPort.open({ baudRate: 38400 });
      h3ChanWriter = h3ChanPort.writable.getWriter();
      h3ChanReader = h3ChanPort.readable.getReader();
      return;
    } catch {}
    h3ChanCloseSerial();
  }
}

function h3ChanProcessByte(b) {
  if (h3ChanState === H3_IDLE) {
    switch (b) {
      case 0x30:
        h3ChanState = 0;
        h3ChanBlock[32] = 0;
        break;
      case 0x31:
      case 0x45:
      case 0x46:
        h3ChanState = H3_ACK;
        break;
    }
  } else {
    if (h3ChanState < 32) {
      h3ChanBlock[h3ChanState++] = b;
      h3ChanBlock[32] += b;
    } else if (h3ChanState === 32) {
      h3ChanState = h3ChanBlock[32] === b ? H3_CS_OK : H3_CS_BAD;
    }
  }
}

async function h3ChanReadLoop() {
  h3ChanState = H3_IDLE;
  try {
    while (h3ChanPort && h3ChanState >= H3_IDLE) {
      const { value, done } = await h3ChanReader.read();
      if (done || !value) break;
      for (const b of value) h3ChanProcessByte(b);
    }
  } catch {}
}

function h3ChanSetActiveButtons() {
  if (h3ChanReadBtn) h3ChanReadBtn.disabled = h3ChanPort == null || h3ChanBusy;
  if (h3ChanWriteBtn) h3ChanWriteBtn.disabled = h3ChanPort == null || h3ChanBusy;
  if (h3ChanConnectBtn) h3ChanConnectBtn.disabled = h3ChanBusy;
  if (h3ChanSaveBtn) h3ChanSaveBtn.disabled = h3ChanBusy;
  if (h3ChanLoadBtn) h3ChanLoadBtn.disabled = h3ChanBusy;
}

// ========== ENCODE/DECODE ==========
function h3ChanDecodeBlock() {
  const rx = h3ChanToFreq(0);
  h3ChanTargetRow.rxFreq.value = rx;
  h3ChanFormatFreq(h3ChanTargetRow.rxFreq);
  if (rx === 0) {
    h3ChanTargetRow.txFreq.value = 0;
    h3ChanFormatFreq(h3ChanTargetRow.txFreq);
    h3ChanTargetRow.style.opacity = 0.6;
    h3ChanTargetRow.chName.value = "";
    h3ChanTargetRow.rxTone.value = "Off";
    h3ChanTargetRow.txTone.value = "Off";
    h3ChanTargetRow.txPower.value = "0";
    h3ChanTargetRow.groups.value = "";
    h3ChanTargetRow.bandwidth.selectedIndex = 0;
    h3ChanTargetRow.modulation.selectedIndex = 0;
  } else {
    h3ChanTargetRow.style.opacity = 1;
    const tx = h3ChanToFreq(4);
    h3ChanTargetRow.txFreq.value = tx;
    h3ChanFormatFreq(h3ChanTargetRow.txFreq);
    const rxst = h3ChanToNum16(8);
    h3ChanTargetRow.rxTone.value = h3ChanToToneString(rxst);
    h3ChanFormatTone(h3ChanTargetRow.rxTone);
    const txst = h3ChanToNum16(10);
    h3ChanTargetRow.txTone.value = h3ChanToToneString(txst);
    h3ChanFormatTone(h3ChanTargetRow.txTone);
    h3ChanTargetRow.txPower.value = h3ChanBlock[12];
    const groupw = h3ChanToNum16(13);
    h3ChanTargetRow.groups.value = h3ChanToGroupString(groupw);
    const bw = h3ChanBlock[15] & 1;
    h3ChanTargetRow.bandwidth.selectedIndex = bw;
    const mod = (h3ChanBlock[15] & 7) >> 1;
    h3ChanTargetRow.modulation.selectedIndex = mod;
    let cnt = 20;
    let cname = "";
    while (cnt < 32 && h3ChanBlock[cnt] !== 0) {
      cname += String.fromCharCode(h3ChanBlock[cnt++]);
    }
    h3ChanTargetRow.chName.value = cname;
  }
}

function h3ChanEncodeBlock() {
  for (let f = 0; f < 33; f++) h3ChanBlock[f] = 0;
  const rx = Math.round(h3ChanTargetRow.rxFreq.value * 100000.0) >>> 0;
  const tx = Math.round(h3ChanTargetRow.txFreq.value * 100000.0) >>> 0;
  const rxst = h3ChanToToneWord(h3ChanTargetRow.rxTone.value) >>> 0;
  const txst = h3ChanToToneWord(h3ChanTargetRow.txTone.value) >>> 0;
  const grpw = h3ChanToGroupWord(h3ChanTargetRow.groups.value) >>> 0;
  const modbw = h3ChanTargetRow.bandwidth.selectedIndex + (h3ChanTargetRow.modulation.selectedIndex << 1);
  h3ChanSetNum32(0, rx);
  h3ChanSetNum32(4, tx);
  h3ChanSetNum16(8, rxst);
  h3ChanSetNum16(10, txst);
  h3ChanBlock[12] = Math.abs(h3ChanTargetRow.txPower.value) >>> 0;
  h3ChanSetNum16(13, grpw);
  h3ChanBlock[15] = modbw;
  let f = 20;
  for (const l of h3ChanTargetRow.chName.value) {
    h3ChanBlock[f++] = l.charCodeAt(0);
  }
  for (f = 0; f < 32; f++) h3ChanBlock[32] += h3ChanBlock[f];
}

// ========== CSV EXPORT ==========
function h3ChanExportCsv() {
  let csv = "Channel_Num,Active,Name,RX,TX,RX_Tone,TX_Tone,TX_Power,Slot1,Slot2,Slot3,Slot4,Bandwidth,Modulation\r\n";
  for (let w = 1; w < 199; w++) {
    const r = h3ChanRows[w];
    csv += `${w},`;
    if (Math.abs(r.rxFreq.value) === 0) {
      csv += "False,,,,,,,,,,,,\r\n";
    } else {
      csv += "True,";
      csv += `${r.chName.value.replace(",", ".").replace('"', "'")},`;
      csv += `${r.rxFreq.value},`;
      csv += `${r.txFreq.value},`;
      csv += `${r.rxTone.value},`;
      csv += `${r.txTone.value},`;
      csv += `${r.txPower.value},`;
      csv += `${r.groups.value.length > 0 ? r.groups.value[0] : ""},`;
      csv += `${r.groups.value.length > 1 ? r.groups.value[1] : ""},`;
      csv += `${r.groups.value.length > 2 ? r.groups.value[2] : ""},`;
      csv += `${r.groups.value.length > 3 ? r.groups.value[3] : ""},`;
      csv += `${r.bandwidth.value},`;
      csv += `${r.modulation.value}\r\n`;
    }
  }
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "h3channels.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ========== INITIALIZATION ==========
function h3ChanInit() {
  if (!h3ChanGrid) return;
  
  // Resize scroller
  function resizeScroller() {
    if (h3ChanScroller) {
      h3ChanScroller.style.height = Math.round(window.innerHeight - 300) + "px";
    }
  }
  window.addEventListener("resize", resizeScroller);
  resizeScroller();
  
  // Build table
  for (let i = 0; i < 199; i++) {
    const row = document.createElement("tr");
    row.offset = 0;
    for (let j = 0; j < 10; j++) {
      const cell = document.createElement(i === 0 ? "th" : "td");
      const col = j;
      if (i > 0) {
        row.style.opacity = 0.6;
        switch (j) {
          case 0:
            cell.textContent = i + " ";
            cell.classList.add("index-cell");
            row.chNum = i;
            break;
          case 1:
          case 2:
            const fbox = document.createElement("input");
            fbox.type = "number";
            fbox.max = 1300;
            fbox.min = 0;
            fbox.value = "0.00000";
            fbox.classList.add("freq-input");
            fbox.addEventListener("blur", () => {
              fbox.value = h3ChanClamp(fbox.value, 0, 1300);
              h3ChanFormatFreq(fbox);
            });
            cell.appendChild(fbox);
            if (col === 1) row.rxFreq = fbox;
            else row.txFreq = fbox;
            break;
          case 3:
            const nbox = document.createElement("input");
            nbox.type = "text";
            nbox.maxLength = 12;
            nbox.classList.add("name-input");
            cell.appendChild(nbox);
            row.chName = nbox;
            break;
          case 4:
          case 5:
            const tbox = document.createElement("input");
            tbox.type = "text";
            tbox.maxLength = 5;
            tbox.value = "Off";
            tbox.classList.add("tone-input");
            tbox.addEventListener("blur", () => {
              const tw = h3ChanToToneWord(tbox.value);
              tbox.value = h3ChanToToneString(tw);
              h3ChanFormatTone(tbox);
            });
            cell.appendChild(tbox);
            if (col === 4) row.rxTone = tbox;
            else row.txTone = tbox;
            break;
          case 6:
            const pbox = document.createElement("input");
            pbox.type = "number";
            pbox.min = 0;
            pbox.max = 255;
            pbox.value = 0;
            pbox.classList.add("power-input");
            cell.appendChild(pbox);
            row.txPower = pbox;
            break;
          case 7:
            const gbox = document.createElement("input");
            gbox.type = "text";
            gbox.maxLength = 4;
            gbox.classList.add("groups-input");
            gbox.addEventListener("blur", () => {
              gbox.value = h3ChanToGroupString(h3ChanToGroupWord(gbox.value));
            });
            cell.appendChild(gbox);
            row.groups = gbox;
            break;
          case 8:
            const bdd = document.createElement("select");
            bdd.innerHTML = '<option value="Wide">Wide</option><option value="Narrow">Narrow</option>';
            cell.appendChild(bdd);
            row.bandwidth = bdd;
            break;
          case 9:
            const mdd = document.createElement("select");
            mdd.innerHTML = '<option value="Auto">Auto</option><option value="FM">FM</option><option value="AM">AM</option><option value="USB">USB</option>';
            cell.appendChild(mdd);
            row.modulation = mdd;
            break;
        }
      } else {
        const headers = ["#", "RX Freq", "TX Freq", "Name", "RX Tone", "TX Tone", "TX Power", "Groups", "Bandwidth", "Modulation"];
        cell.textContent = headers[j];
      }
      row.appendChild(cell);
    }
    h3ChanGrid.appendChild(row);
  }
  h3ChanRows = Array.from(h3ChanGrid.getElementsByTagName("tr"));
  
  // Connect button
  if (h3ChanConnectBtn) {
    h3ChanConnectBtn.addEventListener("click", async () => {
      h3ChanCloseSerial();
      try {
        h3ChanPort = await navigator.serial.requestPort();
      } catch {
        h3ChanPort = null;
      }
      await h3ChanOpenSerial();
      h3ChanSetActiveButtons();
      h3ChanLog(h3ChanPort ? "Serial port opened" : "Cannot open serial port");
      h3ChanState = -1;
    });
  }
  
  // Read button
  if (h3ChanReadBtn) {
    h3ChanReadBtn.addEventListener("click", async () => {
      h3ChanBusy = true;
      h3ChanSetActiveButtons();
      try {
        h3ChanByteCommand[0] = 0x45;
        await h3ChanWriter.write(h3ChanByteCommand);
        await h3ChanReadLoop();
        if (h3ChanState === H3_ACK) {
          for (let i = 1; i < 199; i++) {
            h3ChanLog(`Read Channel ${i} of 198`);
            h3ChanTargetRow = h3ChanRows[i];
            h3ChanEePacket[0] = 0x30;
            h3ChanEePacket[1] = i + 1;
            await h3ChanWriter.write(h3ChanEePacket);
            await h3ChanReadLoop();
            if (h3ChanState === H3_CS_OK) h3ChanDecodeBlock();
          }
        }
        h3ChanByteCommand[0] = 0x46;
        await h3ChanWriter.write(h3ChanByteCommand);
        await h3ChanReadLoop();
      } catch {}
      h3ChanBusy = false;
      h3ChanLog("Read Finished");
      h3ChanSetActiveButtons();
    });
  }
  
  // Write button
  if (h3ChanWriteBtn) {
    h3ChanWriteBtn.addEventListener("click", async () => {
      h3ChanBusy = true;
      h3ChanSetActiveButtons();
      try {
        h3ChanByteCommand[0] = 0x45;
        await h3ChanWriter.write(h3ChanByteCommand);
        await h3ChanReadLoop();
        if (h3ChanState === H3_ACK) {
          for (let x = 1; x < 199; x++) {
            h3ChanLog(`Write Channel ${x} of 198`);
            h3ChanTargetRow = h3ChanRows[x];
            h3ChanEncodeBlock();
            h3ChanEePacket[0] = 0x31;
            h3ChanEePacket[1] = x + 1;
            await h3ChanWriter.write(h3ChanEePacket);
            await h3ChanWriter.write(h3ChanBlock);
            await h3ChanReadLoop();
            if (h3ChanState !== H3_ACK) break;
          }
          h3ChanByteCommand[0] = 0x49;
          await h3ChanWriter.write(h3ChanByteCommand);
        } else {
          h3ChanByteCommand[0] = 0x46;
          await h3ChanWriter.write(h3ChanByteCommand);
          await h3ChanReadLoop();
        }
      } catch {}
      h3ChanBusy = false;
      h3ChanLog("Write Finished");
      h3ChanSetActiveButtons();
    });
  }
  
  // Save button
  if (h3ChanSaveBtn) {
    h3ChanSaveBtn.addEventListener("click", () => h3ChanExportCsv());
  }
  
  // Load button
  if (h3ChanLoadBtn && h3ChanCsvFile) {
    h3ChanLoadBtn.addEventListener("click", () => h3ChanCsvFile.click());
    h3ChanCsvFile.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          // Parse CSV and load channels (simplified)
          h3ChanLog("CSV loaded - parsing not fully implemented");
        };
        reader.readAsText(file);
      }
    });
  }
  
  h3ChanSetActiveButtons();
  h3ChanLog("Channel Editor ready. Connect to radio to begin.");
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', h3ChanInit);
} else {
  h3ChanInit();
}

console.log('[H3 Channel Editor] Initialized successfully!');
