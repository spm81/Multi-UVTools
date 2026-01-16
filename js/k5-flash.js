// k5-flash.js - K5 Firmware Flashing Module
// Based on joaquim k5_editor flash implementation

import {
  FLASH_BLOCK_SIZE,
  sendPacket,
  readPacket,
  unpackFirmware,
  unpackFirmwareVersion,
  flashGenerateCommand,
} from "./protocol.js";
import {
  connect as connectSerial,
  disconnect as disconnectSerial,
  getPort,
  claim,
  release,
} from "./serial-manager.js";

const OFFICIAL_VERSION_PACKET = new Uint8Array([
  48, 5, 16, 0, 42, 79, 69, 70, 87, 45, 76, 79, 83, 69, 72, 85, 0, 0, 0, 0,
]);

// Helper to fetch firmware from URL (including GitHub)
async function fetchFirmwareFromUrl(url) {
  // Convert GitHub blob URLs to raw URLs
  let fetchUrl = url;
  if (url.includes('github.com') && url.includes('/blob/')) {
    fetchUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch firmware: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

// Main flash function
export async function flashK5Firmware(firmwareSource, options = {}) {
  const {
    onLog = () => {},
    onProgress = () => {},
    onComplete = () => {},
    onError = () => {},
  } = options;
  
  if (!claim("k5flash")) {
    onError("Another tool is using the serial connection.");
    return false;
  }
  
  try {
    // Get firmware data
    let firmwareEncoded;
    onLog("Loading firmware...");
    
    if (firmwareSource instanceof Uint8Array) {
      firmwareEncoded = firmwareSource;
    } else if (firmwareSource instanceof File) {
      firmwareEncoded = new Uint8Array(await firmwareSource.arrayBuffer());
    } else if (typeof firmwareSource === 'string') {
      // URL or path
      if (firmwareSource.startsWith('http://') || firmwareSource.startsWith('https://')) {
        firmwareEncoded = await fetchFirmwareFromUrl(firmwareSource);
      } else {
        // Local path - fetch it
        const response = await fetch(firmwareSource);
        if (!response.ok) {
          throw new Error(`Failed to load firmware: ${response.statusText}`);
        }
        firmwareEncoded = new Uint8Array(await response.arrayBuffer());
      }
    } else {
      throw new Error("Invalid firmware source");
    }
    
    onLog(`Firmware loaded: ${firmwareEncoded.length} bytes`);
    
    // Get firmware version
    let versionText = "unknown";
    try {
      const rawVersion = unpackFirmwareVersion(firmwareEncoded);
      const decoded = new TextDecoder().decode(rawVersion).replace(/\0.*$/, "");
      // Check if decoded text contains only printable ASCII characters
      if (decoded && /^[\x20-\x7E]+$/.test(decoded)) {
        versionText = decoded;
      }
    } catch (e) {
      onLog("Warning: Could not read firmware version");
    }
    onLog(`Firmware version: ${versionText}`);
    
    // Disconnect any existing connection and reconnect at 38400 baud
    onLog("Preparing serial connection...");
    await disconnectSerial();
    
    onLog("Waiting for bootloader... Put radio in boot mode (PTT + Power On)");
    onProgress(0);
    
    // Connect at 38400 baud for bootloader
    await connectSerial({ baudRate: 38400 });
    const flashingPort = getPort();
    
    if (!flashingPort) {
      throw new Error("No serial port available");
    }
    
    // Wait for bootloader with longer timeout
    try {
      await readPacket(flashingPort, 0x18, 30000);
      onLog("Bootloader detected!");
    } catch (e) {
      throw new Error("Bootloader not detected. Make sure radio is in boot mode (PTT + Power On)");
    }
    
    // Send version packet
    await sendPacket(flashingPort, OFFICIAL_VERSION_PACKET);
    await readPacket(flashingPort, 0x18, 5000);
    
    // Unpack and flash firmware
    const firmware = unpackFirmware(firmwareEncoded);
    if (firmware.length > 0xf000) {
      throw new Error("Firmware size too large for official flashing.");
    }
    
    onLog(`Flashing ${firmware.length} bytes...`);
    
    for (let i = 0; i < firmware.length; i += FLASH_BLOCK_SIZE) {
      const data = firmware.slice(i, i + FLASH_BLOCK_SIZE);
      const command = flashGenerateCommand(data, i, firmware.length);
      await sendPacket(flashingPort, command);
      await readPacket(flashingPort, 0x1a, 5000);
      const pct = ((i + FLASH_BLOCK_SIZE) / firmware.length) * 100;
      onProgress(Math.min(pct, 100));
    }
    
    onProgress(100);
    onLog("Firmware programmed successfully!", "success");
    onComplete();
    return true;
    
  } catch (error) {
    onLog(`Flash failed: ${error.message}`, "error");
    onError(error.message);
    return false;
  } finally {
    await disconnectSerial();
    release("k5flash");
  }
}

export { fetchFirmwareFromUrl };
