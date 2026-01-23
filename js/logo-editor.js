// logo-editor.js - v7.46 - CHUNKED READ/WRITE (256 bytes) + VERTICAL FLIP
import { getPort, isConnected, subscribe } from "./serial-manager.js";
import { tk11Init, tk11Read, tk11Write } from "./protocol-tk11.js";

const LOGO_ADDRESS = 0x0D6008;
const LOGO_SIZE = 1024;
const CHUNK_SIZE = 256;  // TK11_MAX_CHUNK_SIZE
const NUM_CHUNKS = 4;    // 1024 / 256 = 4
const CANVAS_WIDTH = 128;
const CANVAS_HEIGHT = 64;

let canvas, ctx;


let logoData = new Uint8Array(LOGO_SIZE);
let connected = false;
let isBusy = false;

// 🔄 FLIP VERTICAL - Radio armazena invertido (de pernas para o ar)
function flipVertical(data) {
  const flipped = new Uint8Array(LOGO_SIZE);
  const bytesPerLine = 16; // 128 pixels / 8 = 16 bytes
  
  // Inverte linha por linha (linha 0 ↔ linha 63, linha 1 ↔ linha 62, etc.)
  for (let y = 0; y < CANVAS_HEIGHT; y++) {
    const srcOffset = y * bytesPerLine;
    const dstOffset = (63 - y) * bytesPerLine;
    
    for (let x = 0; x < bytesPerLine; x++) {
      flipped[dstOffset + x] = data[srcOffset + x];
    }
  }
  
  return flipped;
}

// Subscribe to connection status (same pattern as tk11-settings.js)
function init() {
  console.log('[Logo Editor] A inicializar...');
  
  // Get canvas
  canvas = document.getElementById('logoCanvas');
  if (!canvas) {
    console.error('[Logo Editor] ❌ Canvas não encontrado (id: logoCanvas)');
    return;
  }
  
  ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  
  // Initialize with empty logo
  clearCanvas();
  
  // Attach button handlers (with CORRECT IDs!)
  const loadBtn = document.getElementById('logoLoadImageBtn');  // ← FIXED!
  const readBtn = document.getElementById('logoReadBtn');
  const writeBtn = document.getElementById('logoWriteBtn');
  const clearBtn = document.getElementById('logoClearBtn');
  const invertBtn = document.getElementById('logoInvertBtn');
  const saveBtn = document.getElementById('logoSaveBAKBtn');
  
  if (loadBtn) loadBtn.addEventListener('click', handleLoadFile);
  if (readBtn) readBtn.addEventListener('click', handleReadFromRadio);
  if (writeBtn) writeBtn.addEventListener('click', handleWriteToRadio);
  if (clearBtn) clearBtn.addEventListener('click', handleClear);
  if (invertBtn) invertBtn.addEventListener('click', handleInvert);
  if (saveBtn) saveBtn.addEventListener('click', handleSaveBAK);
  
  // Subscribe to connection status (CRITICAL!)
  subscribe((state) => {
    connected = state.connected;
    updateButtons();
  });
  
  // Initial button state
  updateButtons();
  
  console.log('[Logo Editor] ✅ Inicializado com sucesso');
}

// Update button states based on connection (same pattern as other modules)
function updateButtons() {
  const readBtn = document.getElementById('logoReadBtn');
  const writeBtn = document.getElementById('logoWriteBtn');
  
  if (readBtn) readBtn.disabled = !connected || isBusy;
  if (writeBtn) writeBtn.disabled = !connected || isBusy;
}

// Helper to read logo in chunks (CHUNKED READ - 256 bytes × 4)
async function readLogoChunked(port) {
  const fullLogo = new Uint8Array(LOGO_SIZE);
  
  console.log(`[Logo Editor] 📥 A ler logo em ${NUM_CHUNKS} chunks de ${CHUNK_SIZE} bytes...`);
  
  for (let i = 0; i < NUM_CHUNKS; i++) {
    const chunkAddress = LOGO_ADDRESS + (i * CHUNK_SIZE);
    console.log(`[Logo Editor] Chunk ${i + 1}/${NUM_CHUNKS} - Address: 0x${chunkAddress.toString(16)}`);
    
    const chunk = await tk11Read(port, chunkAddress, CHUNK_SIZE);
    fullLogo.set(chunk, i * CHUNK_SIZE);
  }
  
  console.log('[Logo Editor] ✅ Todos os chunks lidos com sucesso');
  
  // 🔄 Radio armazena invertido - inverte para mostrar correto ao utilizador
  return flipVertical(fullLogo);
}

// Helper to write logo in chunks (CHUNKED WRITE - 256 bytes × 4)
async function writeLogoChunked(port, data) {
  if (data.length !== LOGO_SIZE) {
    throw new Error(`Invalid logo size: expected ${LOGO_SIZE}, got ${data.length}`);
  }
  
  // 🔄 Inverte antes de escrever (canvas tem correto, radio precisa invertido)
  const flippedData = flipVertical(data);
  
  console.log(`[Logo Editor] 📤 A escrever logo em ${NUM_CHUNKS} chunks de ${CHUNK_SIZE} bytes...`);
  
  for (let i = 0; i < NUM_CHUNKS; i++) {
    const chunkAddress = LOGO_ADDRESS + (i * CHUNK_SIZE);
    const chunkData = flippedData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    console.log(`[Logo Editor] Chunk ${i + 1}/${NUM_CHUNKS} - Address: 0x${chunkAddress.toString(16)}`);
    
    await tk11Write(port, chunkAddress, chunkData);
  }
  
  console.log('[Logo Editor] ✅ Todos os chunks escritos com sucesso');
}

function clearCanvas() {
  logoData.fill(0x00);  // All bits 0 = white
  renderLogoToCanvas(logoData);
}

// Invert logo (black <-> white)
function invertLogo() {
  for (let i = 0; i < logoData.length; i++) {
    logoData[i] = ~logoData[i];
  }
  renderLogoToCanvas(logoData);
}

// Render logo data (1024 bytes) to canvas
function renderLogoToCanvas(data) {
  // LCD-style background (greenish)
  ctx.fillStyle = '#B8D4A8';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // Draw pixels
  const pixelSize = 1;
  for (let y = 0; y < CANVAS_HEIGHT; y++) {
    for (let x = 0; x < CANVAS_WIDTH; x++) {
      const byteIndex = y * 16 + Math.floor(x / 8);
      const bitIndex = 7 - (x % 8);  // MSB first
      const isBlack = (data[byteIndex] >> bitIndex) & 1;
      
      if (isBlack) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
  }
}

// Load image file (PNG/JPG/BMP) and convert to monochrome
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Create temporary canvas for conversion
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Calculate scaling to fit 128x64 (maintain aspect ratio)
        const scale = Math.min(CANVAS_WIDTH / img.width, CANVAS_HEIGHT / img.height);
        const scaledWidth = Math.floor(img.width * scale);
        const scaledHeight = Math.floor(img.height * scale);
        const offsetX = Math.floor((CANVAS_WIDTH - scaledWidth) / 2);
        const offsetY = Math.floor((CANVAS_HEIGHT - scaledHeight) / 2);
        
        tempCanvas.width = CANVAS_WIDTH;
        tempCanvas.height = CANVAS_HEIGHT;
        
        // Fill with white
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Draw scaled image
        tempCtx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
        
        // Get pixel data
        const imageData = tempCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        resolve(imageData);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Load .BAK file (1024 bytes raw)
function loadBAKFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      
      if (data.length !== LOGO_SIZE) {
        reject(new Error(`Invalid .BAK file size (expected ${LOGO_SIZE} bytes, got ${data.length})`));
        return;
      }
      
      // 🔄 .BAK está em formato radio (invertido) - inverte para mostrar correto
      resolve(flipVertical(data));
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// Convert image data to monochrome (1 bit per pixel)
function imageToMonochrome(imageData) {
  const mono = new Uint8Array(LOGO_SIZE);
  
  for (let y = 0; y < CANVAS_HEIGHT; y++) {
    for (let x = 0; x < CANVAS_WIDTH; x++) {
      const pixelIndex = (y * CANVAS_WIDTH + x) * 4;
      const r = imageData.data[pixelIndex];
      const g = imageData.data[pixelIndex + 1];
      const b = imageData.data[pixelIndex + 2];
      
      // Luminance formula
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const isBlack = luminance < 128;
      
      if (isBlack) {
        const byteIndex = y * 16 + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);  // MSB first
        mono[byteIndex] |= (1 << bitIndex);
      }
    }
  }
  
  return mono;
}

// BUTTON HANDLERS

async function handleLoadFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,.bak';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      console.log('[Logo Editor] A carregar ficheiro:', file.name);
      
      if (file.name.toLowerCase().endsWith('.bak')) {
        // Load .BAK file directly (já vem invertido para correto)
        logoData = await loadBAKFile(file);
        renderLogoToCanvas(logoData);
        console.log('[Logo Editor] ✅ Ficheiro .BAK carregado');
      } else {
        // Load and convert image file (já está correto)
        const imageData = await loadImageFile(file);
        logoData = imageToMonochrome(imageData);
        renderLogoToCanvas(logoData);
        console.log('[Logo Editor] ✅ Imagem convertida para monocromático');
      }
    } catch (error) {
      console.error('[Logo Editor] ❌ Erro ao carregar ficheiro:', error);
      alert(`Erro ao carregar ficheiro: ${error.message}`);
    }
  };
  
  input.click();
}

async function handleReadFromRadio() {
  if (isBusy) {
    console.log('[Logo Editor] ⚠️ Operação em curso, aguarde...');
    return;
  }
  
  if (!connected) {
    alert('Não está ligado ao rádio. Por favor ligue primeiro.');
    return;
  }
  
  isBusy = true;
  updateButtons();
  
  try {
    console.log('[Logo Editor] A ler logo do rádio...');
    const port = getPort();
    await tk11Init(port);
    logoData = await readLogoChunked(port);  // ← Já vem invertido para correto
    renderLogoToCanvas(logoData);
    console.log('[Logo Editor] ✅ Logo lido com sucesso - Logo settings loaded');
  } catch (error) {
    console.error('[Logo Editor] ❌ Erro ao ler do rádio:', error);
    alert(`Erro ao ler do rádio: ${error.message}`);
  } finally {
    isBusy = false;
    updateButtons();
  }
}

async function handleWriteToRadio() {
  if (isBusy) {
    console.log('[Logo Editor] ⚠️ Operação em curso, aguarde...');
    return;
  }
  
  if (!connected) {
    alert('Não está ligado ao rádio. Por favor ligue primeiro.');
    return;
  }
  
  if (!confirm('Escrever logo no rádio? Esta operação não pode ser desfeita.')) {
    return;
  }
  
  isBusy = true;
  updateButtons();
  
  try {
    console.log('[Logo Editor] A escrever logo no rádio...');
    const port = getPort();
    await tk11Init(port);
    await writeLogoChunked(port, logoData);  // ← Inverte antes de escrever
    console.log('[Logo Editor] ✅ Logo escrito com sucesso');
    alert('Logo escrito com sucesso!');
  } catch (error) {
    console.error('[Logo Editor] ❌ Erro ao escrever no rádio:', error);
    alert(`Erro ao escrever no rádio: ${error.message}`);
  } finally {
    isBusy = false;
    updateButtons();
  }
}

function handleClear() {
  console.log('[Logo Editor] A limpar canvas...');
  clearCanvas();
  console.log('[Logo Editor] ✅ Canvas limpo');
}

function handleInvert() {
  console.log('[Logo Editor] A inverter logo...');
  invertLogo();
  console.log('[Logo Editor] ✅ Logo invertido');
}

function handleSaveBAK() {
  try {
    console.log('[Logo Editor] A guardar .BAK...');
    
    // 🔄 Inverte antes de guardar (canvas tem correto, .BAK precisa formato radio)
    const flippedData = flipVertical(logoData);
    
    const blob = new Blob([flippedData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logo.bak';
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('[Logo Editor] ✅ Ficheiro .BAK guardado');
  } catch (error) {
    console.error('[Logo Editor] ❌ Erro ao guardar .BAK:', error);
    alert(`Erro ao guardar .BAK: ${error.message}`);
  }
}

// Export functions for use in tk11-settings Read All / Write All
// NOTE: These are called by tk11-settings AFTER tk11Init(), so we don't call it here!
export const logoRead = () => {
  const port = getPort();
  return readLogoChunked(port);  // ← Já inverte automaticamente
};
export const logoWrite = (data) => {
  const port = getPort();
  return writeLogoChunked(port, data);  // ← Já inverte automaticamente
};
export const displayLogoOnCanvas = (data) => {
  if (!canvas || !ctx) {
    console.warn('[Logo Editor] Canvas not initialized, cannot display logo');
    return;
  }
  renderLogoToCanvas(data);
  console.log('[Logo Editor] Logo displayed on canvas');
};
export { LOGO_ADDRESS, LOGO_SIZE };

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
