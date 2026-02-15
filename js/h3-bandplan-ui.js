// h3-bandplan-ui.js
// TD-H3/H8 Band Plan Editor
// Adapted from h3webtools by nicFW

'use strict';

// ========== STATE ==========
let h3BandPort = null;
let h3BandWriter = null;
let h3BandReader = null;
let h3BandRows = [];
const H3B_IDLE = -1;
const H3B_CS_OK = -2;
const H3B_CS_BAD = -3;
const H3B_ACK = -4;
let h3BandState = H3B_IDLE;
let h3BandBusy = false;
let h3BandReadAddr = 0;
let h3BandCheckSum = 0;
const h3BandBlock = new Uint8Array(224);
const h3BandEePacket = new Uint8Array(2);
const h3BandByteCommand = new Uint8Array(1);

// ========== UI ELEMENTS ==========
const h3BandGrid = document.getElementById('h3BandGrid');
const h3BandConnectBtn = document.getElementById('h3BandConnectBtn');
const h3BandReadBtn = document.getElementById('h3BandReadBtn');
const h3BandWriteBtn = document.getElementById('h3BandWriteBtn');
const h3BandSaveBtn = document.getElementById('h3BandSaveBtn');
const h3BandLoadBtn = document.getElementById('h3BandLoadBtn');
const h3BandStatus = document.getElementById('h3BandStatus');
const h3BandCsvFile = document.getElementById('h3BandCsvFile');
const h3BandScroller = document.getElementById('h3BandScroller');

// ========== HELPERS ==========
function h3BandLog(message) {
  if (h3BandStatus) h3BandStatus.textContent = message;
  console.log(`[H3 Band] ${message}`);
}

function h3BandClamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}

function h3BandFormatFreq(ele) {
  ele.value = parseFloat(ele.value < 18 ? 0 : ele.value > 1300 ? 1300 : ele.value).toFixed(5);
}

function h3BandSetNum32(index, num) {
  h3BandBlock[index++] = num & 0xff;
  num >>= 8;
  h3BandBlock[index++] = num & 0xff;
  num >>= 8;
  h3BandBlock[index++] = num & 0xff;
  num >>= 8;
  h3BandBlock[index] = num & 0xff;
}

function h3BandToNum32(index) {
  return h3BandBlock[index] + (h3BandBlock[index + 1] << 8) + (h3BandBlock[index + 2] << 16) + (h3BandBlock[index + 3] << 24);
}

function h3BandToBKFreq(decfreq) {
  return Math.round(decfreq * 100000.0) & 0x7fffffff;
}

function h3BandToDecimalFreq(bkfreq) {
  return bkfreq / 100000.0;
}

// ========== SERIAL ==========
function h3BandDisposeSerial() {
  try { if (h3BandWriter) h3BandWriter.releaseLock(); } catch {}
  try { if (h3BandReader) h3BandReader.releaseLock(); } catch {}
  try { if (h3BandPort) h3BandPort.close(); } catch {}
}

function h3BandCloseSerial() {
  h3BandDisposeSerial();
  h3BandPort = null;
  h3BandReader = null;
  h3BandWriter = null;
}

async function h3BandOpenSerial() {
  if (h3BandPort) {
    try {
      await h3BandPort.open({ baudRate: 38400 });
      h3BandWriter = h3BandPort.writable.getWriter();
      h3BandReader = h3BandPort.readable.getReader();
      return;
    } catch {}
    h3BandCloseSerial();
  }
}

function h3BandProcessByte(b) {
  if (h3BandState === H3B_IDLE) {
    switch (b) {
      case 0x30:
        h3BandState = 0;
        h3BandCheckSum = 0;
        break;
      case 0x31:
      case 0x45:
      case 0x46:
        h3BandState = H3B_ACK;
        break;
    }
  } else {
    if (h3BandState < 32) {
      h3BandBlock[h3BandReadAddr + h3BandState++] = b;
      h3BandCheckSum += b;
    } else if (h3BandState === 32) {
      h3BandState = (h3BandCheckSum & 0xff) === b ? H3B_CS_OK : H3B_CS_BAD;
    }
  }
}

async function h3BandReadLoop() {
  h3BandState = H3B_IDLE;
  try {
    while (h3BandPort && h3BandState >= H3B_IDLE) {
      const { value, done } = await h3BandReader.read();
      if (done || !value) break;
      for (const b of value) h3BandProcessByte(b);
    }
  } catch {}
}

function h3BandSetActiveButtons() {
  if (h3BandReadBtn) h3BandReadBtn.disabled = h3BandPort == null || h3BandBusy;
  if (h3BandWriteBtn) h3BandWriteBtn.disabled = h3BandPort == null || h3BandBusy;
  if (h3BandConnectBtn) h3BandConnectBtn.disabled = h3BandBusy;
  if (h3BandSaveBtn) h3BandSaveBtn.disabled = h3BandBusy;
  if (h3BandLoadBtn) h3BandLoadBtn.disabled = h3BandBusy;
}

// ========== ENCODE/DECODE ==========
function h3BandEncode() {
  h3BandBlock[0] = 0x6D;
  h3BandBlock[1] = 0xA4;
  for (let r = 1; r < 21; r++) {
    const addr = ((r - 1) * 10) + 2;
    const row = h3BandRows[r];
    h3BandSetNum32(addr, h3BandToBKFreq(+row.startFreq.value));
    h3BandSetNum32(addr + 4, h3BandToBKFreq(+row.endFreq.value));
    h3BandBlock[addr + 8] = +row.maxPower.value || 0;
    let byt = row.txAllowed.checked ? 1 : 0;
    byt |= row.wrap.checked ? 2 : 0;
    byt |= row.modulation.selectedIndex << 2;
    byt |= row.bandwidth.selectedIndex << 5;
    h3BandBlock[addr + 9] = byt;
  }
}

function h3BandDecode() {
  const magic = h3BandBlock[0] === 0x6D && h3BandBlock[1] === 0xA4;
  for (let r = 1; r < 21; r++) {
    const addr = ((r - 1) * 10) + 2;
    const row = h3BandRows[r];
    const start = h3BandToDecimalFreq(h3BandToNum32(addr));
    const end = h3BandToDecimalFreq(h3BandToNum32(addr + 4));
    if (magic && start && end && end > start && start >= 18 && start <= 1300 && end >= 18 && end <= 1300) {
      row.startFreq.value = start;
      row.endFreq.value = end;
      row.style.opacity = 1;
      row.maxPower.value = h3BandBlock[addr + 8] || "";
      const byt = h3BandBlock[addr + 9];
      row.txAllowed.checked = byt & 1;
      row.wrap.checked = byt & 2;
      row.modulation.selectedIndex = (byt & 0x1c) >> 2;
      row.bandwidth.selectedIndex = (byt & 0xe0) >> 5;
    } else {
      row.startFreq.value = 0;
      row.endFreq.value = 0;
      row.style.opacity = 0.6;
      row.txAllowed.checked = false;
      row.maxPower.value = "";
      row.wrap.checked = false;
      row.modulation.selectedIndex = 1;
      row.bandwidth.selectedIndex = 1;
    }
    h3BandFormatFreq(row.startFreq);
    h3BandFormatFreq(row.endFreq);
  }
}

// ========== CSV EXPORT ==========
function h3BandExportCsv() {
  let csv = "Band_Num,Start,End,TX,Modulation,Bandwidth,Wrap,Max_Power\r\n";
  for (let w = 1; w < 21; w++) {
    const r = h3BandRows[w];
    csv += `${w},`;
    csv += `${r.startFreq.value},`;
    csv += `${r.endFreq.value},`;
    csv += `${r.txAllowed.checked ? "True" : "False"},`;
    csv += `${r.modulation.value},`;
    csv += `${r.bandwidth.value},`;
    csv += `${r.wrap.checked ? "True" : "False"},`;
    csv += `${r.maxPower.value ? r.maxPower.value : "Ignore"}\r\n`;
  }
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "h3bandplan.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ========== INITIALIZATION ==========
function h3BandInit() {
  if (!h3BandGrid) return;
  
  function resizeScroller() {
    if (h3BandScroller) {
      h3BandScroller.style.height = Math.round(window.innerHeight - 300) + "px";
    }
  }
  window.addEventListener("resize", resizeScroller);
  resizeScroller();
  
  // Build table
  for (let i = 0; i < 21; i++) {
    const row = document.createElement("tr");
    for (let j = 0; j < 8; j++) {
      const cell = document.createElement(i === 0 ? "th" : "td");
      if (i > 0) {
        row.style.opacity = 0.6;
        switch (j) {
          case 0:
            cell.textContent = i + " ";
            cell.classList.add("index-cell");
            row.planNum = i;
            break;
          case 1:
          case 2:
            const fbox = document.createElement("input");
            fbox.type = "number";
            fbox.max = 1300;
            fbox.min = 0;
            fbox.value = "0.00000";
            fbox.classList.add("freq-input");
            fbox.addEventListener("blur", () => h3BandFormatFreq(fbox));
            cell.appendChild(fbox);
            if (j === 1) row.startFreq = fbox;
            else row.endFreq = fbox;
            break;
          case 3:
            const cbox = document.createElement("input");
            cbox.type = "checkbox";
            cell.appendChild(cbox);
            row.txAllowed = cbox;
            break;
          case 4:
            const mdd = document.createElement("select");
            mdd.innerHTML = '<option>Ignore</option><option>FM</option><option>AM</option><option>USB</option><option>Enforce FM</option><option>Enforce AM</option><option>Enforce USB</option><option>Enforce None</option>';
            mdd.selectedIndex = 1;
            cell.appendChild(mdd);
            row.modulation = mdd;
            break;
          case 5:
            const bdd = document.createElement("select");
            bdd.innerHTML = '<option>Ignore</option><option>Wide</option><option>Narrow</option><option>Enforce Wide</option><option>Enforce Narrow</option><option>FM Tuner</option>';
            bdd.selectedIndex = 1;
            cell.appendChild(bdd);
            row.bandwidth = bdd;
            break;
          case 6:
            const wbox = document.createElement("input");
            wbox.type = "checkbox";
            cell.appendChild(wbox);
            row.wrap = wbox;
            break;
          case 7:
            const pbox = document.createElement("input");
            pbox.type = "number";
            pbox.min = 0;
            pbox.max = 255;
            pbox.value = "";
            pbox.placeholder = "Ignore";
            pbox.classList.add("power-input");
            cell.appendChild(pbox);
            row.maxPower = pbox;
            break;
        }
      } else {
        const headers = ["#", "Start Freq", "End Freq", "TX Allowed", "Modulation", "Bandwidth", "Wrap", "Max Power"];
        cell.textContent = headers[j];
      }
      row.appendChild(cell);
    }
    h3BandGrid.appendChild(row);
  }
  h3BandRows = Array.from(h3BandGrid.getElementsByTagName("tr"));
  
  // Set defaults
  if (h3BandRows.length > 20) {
    h3BandRows[1].startFreq.value = "138.00000";
    h3BandRows[1].endFreq.value = "174.00000";
    h3BandRows[1].wrap.checked = true;
    h3BandRows[1].maxPower.value = 255;
    h3BandRows[1].txAllowed.checked = true;
    h3BandRows[1].style.opacity = 1;
    h3BandRows[2].startFreq.value = "400.00000";
    h3BandRows[2].endFreq.value = "520.00000";
    h3BandRows[2].wrap.checked = true;
    h3BandRows[2].maxPower.value = 255;
    h3BandRows[2].txAllowed.checked = true;
    h3BandRows[2].style.opacity = 1;
    h3BandRows[20].startFreq.value = "18.00000";
    h3BandRows[20].endFreq.value = "1300.00000";
    h3BandRows[20].style.opacity = 1;
  }
  
  // Connect button
  if (h3BandConnectBtn) {
    h3BandConnectBtn.addEventListener("click", async () => {
      h3BandCloseSerial();
      try {
        h3BandPort = await navigator.serial.requestPort();
      } catch {
        h3BandPort = null;
      }
      await h3BandOpenSerial();
      h3BandSetActiveButtons();
      h3BandLog(h3BandPort ? "Serial port opened" : "Cannot open serial port");
    });
  }
  
  // Read button
  if (h3BandReadBtn) {
    h3BandReadBtn.addEventListener("click", async () => {
      h3BandBusy = true;
      h3BandSetActiveButtons();
      let okay = true;
      try {
        h3BandByteCommand[0] = 0x45;
        await h3BandWriter.write(h3BandByteCommand);
        await h3BandReadLoop();
        if (h3BandState === H3B_ACK) {
          for (let i = 0; i < 7; i++) {
            h3BandLog(`Read Data ${i + 1} of 7`);
            h3BandEePacket[0] = 0x30;
            h3BandEePacket[1] = i + 208;
            h3BandReadAddr = i * 32;
            await h3BandWriter.write(h3BandEePacket);
            await h3BandReadLoop();
            if (h3BandState !== H3B_CS_OK) {
              h3BandLog("Bad checksum");
              okay = false;
              break;
            }
          }
        }
        h3BandByteCommand[0] = 0x46;
        await h3BandWriter.write(h3BandByteCommand);
        await h3BandReadLoop();
      } catch (error) {
        h3BandLog("Read error " + error);
        okay = false;
      }
      if (okay) h3BandLog("Read complete");
      else h3BandBlock[0] = 0;
      h3BandDecode();
      h3BandBusy = false;
      h3BandSetActiveButtons();
    });
  }
  
  // Write button
  if (h3BandWriteBtn) {
    h3BandWriteBtn.addEventListener("click", async () => {
      h3BandBusy = true;
      h3BandSetActiveButtons();
      let okay = true;
      try {
        h3BandByteCommand[0] = 0x45;
        await h3BandWriter.write(h3BandByteCommand);
        await h3BandReadLoop();
        if (h3BandState === H3B_ACK) {
          h3BandEncode();
          for (let x = 0; x < 7; x++) {
            h3BandLog(`Write Data ${x + 1} of 7`);
            h3BandEePacket[0] = 0x31;
            h3BandEePacket[1] = x + 208;
            h3BandByteCommand[0] = 0;
            const start = x * 32;
            const end = start + 32;
            for (let y = start; y < end; y++) {
              h3BandByteCommand[0] += h3BandBlock[y];
            }
            await h3BandWriter.write(h3BandEePacket);
            await h3BandWriter.write(h3BandBlock.slice(start, end));
            await h3BandWriter.write(h3BandByteCommand);
            await h3BandReadLoop();
            if (h3BandState !== H3B_ACK) {
              okay = false;
              h3BandLog("No ACK from radio");
              break;
            }
          }
          h3BandByteCommand[0] = 0x49;
          await h3BandWriter.write(h3BandByteCommand);
        }
      } catch (error) {
        okay = false;
        h3BandLog("Write error " + error);
      }
      h3BandBusy = false;
      if (okay) h3BandLog("Write Finished");
      h3BandSetActiveButtons();
    });
  }
  
  // Save/Load buttons
  if (h3BandSaveBtn) {
    h3BandSaveBtn.addEventListener("click", () => h3BandExportCsv());
  }
  
  if (h3BandLoadBtn && h3BandCsvFile) {
    h3BandLoadBtn.addEventListener("click", () => h3BandCsvFile.click());
  }
  
  h3BandSetActiveButtons();
  h3BandLog("Band Plan Editor ready. Connect to radio to begin.");
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', h3BandInit);
} else {
  h3BandInit();
}

console.log('[H3 Band Plan Editor] Initialized successfully!');
