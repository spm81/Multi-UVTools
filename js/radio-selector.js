/**
 * Radio Selector Module
 * Manages selection between UV-K5/K1 and TK11 radios
 * Different radios have different protocols and memory layouts
 */

const RADIO_TYPES = {
  K5: {
    id: 'K5',
    name: 'UV-K5/K1',
    description: 'Quansheng UV-K5, UV-K5(8), UV-K6, UV-5R Plus, UV-K1',
    protocol: 'k5',
    baudRates: [38400, 115200],
    defaultBaud: 38400,
    memorySize: 0x2000,
    hasExternalEeprom: true,
    hasCalibration: true,
    calibrationAddr: 0x1E00,
    channelCount: 200
  },
  TK11: {
    id: 'TK11',
    name: 'TK11 / RT-890',
    description: 'Radtel TK11, RT-890, and compatible',
    protocol: 'tk11',
    baudRates: [115200],
    defaultBaud: 115200,
    memorySize: 0x23000,
    hasExternalEeprom: false,
    hasCalibration: false,
    channelCount: 999
  }
};

let currentRadioType = 'K5';
let onChangeCallbacks = [];

// Get current radio type
const getRadioType = () => currentRadioType;

// Get radio config
const getRadioConfig = () => RADIO_TYPES[currentRadioType];

// Set radio type
const setRadioType = (type) => {
  if (RADIO_TYPES[type] && type !== currentRadioType) {
    currentRadioType = type;
    localStorage.setItem('selectedRadioType', type);
    
    // Notify all subscribers
    onChangeCallbacks.forEach(cb => cb(type, RADIO_TYPES[type]));
    
    console.log(`Radio type changed to: ${RADIO_TYPES[type].name}`);
  }
};

// Subscribe to radio type changes
const onRadioTypeChange = (callback) => {
  onChangeCallbacks.push(callback);
  return () => {
    onChangeCallbacks = onChangeCallbacks.filter(cb => cb !== callback);
  };
};

// Get all radio types
const getAllRadioTypes = () => Object.values(RADIO_TYPES);

// Initialize from localStorage
const init = () => {
  const saved = localStorage.getItem('selectedRadioType');
  if (saved && RADIO_TYPES[saved]) {
    currentRadioType = saved;
  }
  
  // Set up all radio selector dropdowns
  const selectors = document.querySelectorAll('.radio-type-select');
  selectors.forEach(select => {
    // Populate options
    select.innerHTML = '';
    Object.values(RADIO_TYPES).forEach(radio => {
      const option = document.createElement('option');
      option.value = radio.id;
      option.textContent = radio.name;
      option.selected = radio.id === currentRadioType;
      select.appendChild(option);
    });
    
    // Listen for changes
    select.addEventListener('change', (e) => {
      setRadioType(e.target.value);
    });
  });
  
  // Update baud rate selector based on radio type
  updateBaudRates();
  
  console.log(`Radio selector initialized: ${RADIO_TYPES[currentRadioType].name}`);
};

// Update baud rate options based on radio type
const updateBaudRates = () => {
  const baudSelect = document.getElementById('baudSelect');
  if (!baudSelect) return;
  
  const config = RADIO_TYPES[currentRadioType];
  const currentBaud = parseInt(baudSelect.value);
  
  baudSelect.innerHTML = '';
  config.baudRates.forEach(baud => {
    const option = document.createElement('option');
    option.value = baud;
    option.textContent = baud;
    option.selected = baud === config.defaultBaud;
    baudSelect.appendChild(option);
  });
  
  // Restore current baud if available
  if (config.baudRates.includes(currentBaud)) {
    baudSelect.value = currentBaud;
  }
};

// Update UI elements based on radio type
const updateUI = () => {
  const config = RADIO_TYPES[currentRadioType];
  const isTK11 = currentRadioType === 'TK11';
  
  // Show/hide calibration options for K5 only
  const calibElements = document.querySelectorAll('.k5-calib-only');
  calibElements.forEach(el => {
    el.style.display = config.hasCalibration ? '' : 'none';
  });
  
  // Show/hide K5-specific elements
  const k5Elements = document.querySelectorAll('.k5-only');
  k5Elements.forEach(el => {
    el.style.display = !isTK11 ? '' : 'none';
  });
  
  // Show/hide TK11-specific elements
  const tk11Elements = document.querySelectorAll('.tk11-only');
  tk11Elements.forEach(el => {
    el.style.display = isTK11 ? '' : 'none';
  });
  
  // Update navigation tabs based on radio type
  // TK11 supports: Home (instructions), Tools (home) and Channels
  const navItems = document.querySelectorAll('.nav-links .nav-item');
  navItems.forEach(item => {
    const navTarget = item.getAttribute('data-nav');
    // Tabs supported by TK11: instructions (Home), home (Tools), channels, k1 (Flash)
    const tk11Tabs = ['instructions', 'home', 'channels', 'k1'];
    // Tabs only for K5 (Flash page now works for both, content is toggled inside)
    const k5OnlyTabs = ['settings', 'mirror', 'smr', 'unbricking'];
    
    if (isTK11) {
      // Hide K5-only tabs when TK11 is selected
      if (k5OnlyTabs.includes(navTarget)) {
        item.style.display = 'none';
      } else {
        item.style.display = '';
      }
    } else {
      // Hide TK11-only tabs when K5 is selected
      if (item.classList.contains('tk11-only')) {
        item.style.display = 'none';
      } else {
        item.style.display = '';
      }
    }
  });
  
  // If currently on a hidden tab, navigate to Tools
  if (isTK11) {
    const currentHash = window.location.hash.replace('#', '') || 'instructions';
    const tk11Tabs = ['instructions', 'home', 'channels'];
    if (!tk11Tabs.includes(currentHash)) {
      window.location.hash = '#instructions';
    }
  }
  
  // Update memory size displays
  const memorySizeElements = document.querySelectorAll('.memory-size');
  memorySizeElements.forEach(el => {
    el.textContent = `${(config.memorySize / 1024).toFixed(1)} KB`;
  });
  
  // Update channel count displays
  const channelCountElements = document.querySelectorAll('.channel-count');
  channelCountElements.forEach(el => {
    el.textContent = config.channelCount;
  });
  
  updateBaudRates();
  
  console.log(`UI updated for ${config.name}: showing ${isTK11 ? 'TK11' : 'K5'} tabs`);
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    updateUI();
  });
} else {
  init();
  updateUI();
}

// Subscribe to changes and update UI
onRadioTypeChange(() => updateUI());

export {
  RADIO_TYPES,
  getRadioType,
  getRadioConfig,
  setRadioType,
  onRadioTypeChange,
  getAllRadioTypes,
  updateUI
};
