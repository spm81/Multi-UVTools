// serial-manager.js
// Centralized serial port management

let port = null;
let isConnected = false;
let firmwareVersion = null;
let currentOwner = null;
const subscribers = [];

const notify = () => {
  const state = { connected: isConnected, port, firmwareVersion };
  subscribers.forEach((fn) => fn(state));
};

export const connect = async (options = {}) => {
  const baudRate = options.baudRate || 38400;
  
  // If we already have a connected port, just return it
  if (port && isConnected) {
    return port;
  }
  
  try {
    // Request a new port if we don't have one
    if (!port) {
      port = await navigator.serial.requestPort();
    }
    
    // Only open if not already open
    if (port.readable === null) {
      await port.open({ baudRate });
    }
    
    isConnected = true;
    notify();
    return port;
  } catch (error) {
    console.error('Serial connect error:', error);
    throw error;
  }
};

export const disconnect = async () => {
  if (port) {
    try {
      if (port.readable?.locked) {
        const reader = port.readable.getReader();
        await reader.cancel();
        reader.releaseLock();
      }
      if (port.writable?.locked) {
        const writer = port.writable.getWriter();
        await writer.close();
        writer.releaseLock();
      }
      await port.close();
    } catch (e) {
      console.warn('Error closing port:', e);
    }
    port = null;
  }
  isConnected = false;
  firmwareVersion = null;
  currentOwner = null;
  notify();
};

export const getPort = () => port;

export const isPortConnected = () => isConnected;

// Alias for app.js compatibility (exports function, not variable)
export { isPortConnected as isConnected };

export const setFirmwareVersion = (version) => {
  firmwareVersion = version;
  notify();
};

export const getFirmwareVersion = () => firmwareVersion;

// Claim/release for exclusive access
export const claim = (owner) => {
  if (currentOwner && currentOwner !== owner) {
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
  callback({ connected: isConnected, port, firmwareVersion });
  return () => {
    const index = subscribers.indexOf(callback);
    if (index > -1) {
      subscribers.splice(index, 1);
    }
  };
};

export const setPort = (p) => {
  port = p;
};

export const setConnected = (connected) => {
  isConnected = connected;
  notify();
};
