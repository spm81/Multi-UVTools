// serial-manager.js
// Centralized serial port management - compatible with joaquim k5_editor

let port = null;
let isConnectedState = false;
let firmwareVersion = null;
let currentOwner = null;
const subscribers = [];
// Known USB-Serial device identifiers
const KNOWN_DEVICES = {
  '1a86:7523': 'CH340',
  '1a86:55d4': 'CH9102',
  '067b:2303': 'PL2303',
  '10c4:ea60': 'CP2102',
  '0403:6001': 'FT232R',
  '0403:6015': 'FT231X',
};

const formatDeviceName = (info) => {
  if (!info) return null;
  const vid = info.usbVendorId?.toString(16).toUpperCase().padStart(4, '0') || '????';
  const pid = info.usbProductId?.toString(16).toUpperCase().padStart(4, '0') || '????';
  const key = `${vid.toLowerCase()}:${pid.toLowerCase()}`;
  const name = KNOWN_DEVICES[key] || 'USB';
  return `${name} (VID: ${vid} / PID: ${pid})`;
};



const notify = () => {
  const state = { connected: isConnectedState, port, firmwareVersion };
  subscribers.forEach((fn) => {
    try { fn(state); } catch (e) { console.error('Subscriber error:', e); }
  });
};

export const connect = async (options = {}) => {
  const baudRate = options.baudRate || 38400;
  
  // If already connected with same baud rate, return existing port
  if (port && isConnectedState && port.readable) {
    return port;
  }
  
  try {
    // Close existing port if open with different settings
    if (port) {
      try {
        if (port.readable?.locked) {
          const reader = port.readable.getReader();
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
        if (port.writable?.locked) {
          const writer = port.writable.getWriter();
          writer.releaseLock();
        }
        await port.close().catch(() => {});
      } catch (e) {
        console.warn('Error closing existing port:', e);
      }
      port = null;
    }
    
    // Request new port
    port = await navigator.serial.requestPort();
    await port.open({ baudRate });
    
    isConnectedState = true;
    notify();
    return port;
  } catch (error) {
    console.error('Serial connect error:', error);
    isConnectedState = false;
    port = null;
    notify();
    throw error;
  }
};

export const disconnect = async () => {
  if (port) {
    try {
      // Cancel any active readers
      if (port.readable?.locked) {
        const reader = port.readable.getReader();
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      // Release any writers
      if (port.writable?.locked) {
        const writer = port.writable.getWriter();
        writer.releaseLock();
      }
      await port.close();
    } catch (e) {
      console.warn('Error closing port:', e);
    }
    port = null;
  }
  isConnectedState = false;
  firmwareVersion = null;
  currentOwner = null;
  notify();
};

export const getPort = () => port;

export const isConnected = () => isConnectedState;

export const isPortConnected = () => isConnectedState;

export const setFirmwareVersion = (version) => {
  firmwareVersion = version;
  notify();
};

export const getFirmwareVersion = () => firmwareVersion;

// Get device information  
export const getDeviceInfo = () => {
  if (!port) return null;
  const info = port.getInfo();
  return {
    raw: info,
    formatted: formatDeviceName(info)
  };
};


// Claim/release for exclusive access (prevents concurrent operations)
export const claim = (owner) => {
  if (currentOwner && currentOwner !== owner) {
    console.warn(`Serial port claimed by ${currentOwner}, ${owner} cannot claim`);
    return false;
  }
  currentOwner = owner;
  return true;
};

export const release = (owner) => {
  if (currentOwner === owner) {
    currentOwner = null;
  }
};

export const getCurrentOwner = () => currentOwner;

export const subscribe = (callback) => {
  subscribers.push(callback);
  // Immediately call with current state
  try {
    callback({ connected: isConnectedState, port, firmwareVersion });
  } catch (e) {
    console.error('Initial subscriber call error:', e);
  }
  return () => {
    const index = subscribers.indexOf(callback);
    if (index > -1) {
      subscribers.splice(index, 1);
    }
  };
};

// For external port setting (used by flash)
export const setPort = (p) => {
  port = p;
};

export const setConnected = (connected) => {
  isConnectedState = connected;
  notify();
};
