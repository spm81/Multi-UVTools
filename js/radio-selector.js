/**
 * Radio Selector Module
 * Manages selection between UV-K5/K1, TK11, and RT-890 radios
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
    name: 'TK11',
    description: 'Radtel TK11',
    protocol: 'tk11',
    baudRates: [115200],
    defaultBaud: 115200,
    memorySize: 0x23000,
    hasExternalEeprom: false,
    hasCalibration: false,
    channelCount: 999
  },
  RT890: {
    id: 'RT890',
    name: 'RT-890',
    description: 'RT-890 and compatible',
    protocol: 'rt890',
    baudRates: [115200],
    defaultBaud: 115200,
    memorySize: 0x400000,
    hasExternalEeprom: false,
    hasCalibration: true,
    channelCount: 200
  },
  H3: {
    id: 'H3',
    name: 'TD-H3/H8',
    description: 'TID TD-H3 and TD-H8 with nicFW',
    protocol: 'h3',
    baudRates: [38400, 115200],
    defaultBaud: 38400,
    memorySize: 0x2000,
    hasExternalEeprom: false,
    hasCalibration: false,
    channelCount: 198
  },
  RT880: {
    id: 'RT880',
    name: 'RT-880',
    description: 'Radtel RT-880 and iRadio UV-98',
    protocol: 'rt880',
    baudRates: [115200],
    defaultBaud: 115200,
    memorySize: 0x10000,
    hasExternalEeprom: false,
    hasCalibration: false,
    channelCount: 128
  }
};

let currentRadioType = 'K5';
let onChangeCallbacks = [];

const getRadioType = () => currentRadioType;
const getRadioConfig = () => RADIO_TYPES[currentRadioType];

const setRadioType = (type) => {
  if (RADIO_TYPES[type] && type !== currentRadioType) {
    currentRadioType = type;
    localStorage.setItem('selectedRadioType', type);
    onChangeCallbacks.forEach(cb => cb(type, RADIO_TYPES[type]));
    console.log('Radio type changed to: ' + RADIO_TYPES[type].name);
  }
};

const onRadioTypeChange = (callback) => {
  onChangeCallbacks.push(callback);
  return () => { onChangeCallbacks = onChangeCallbacks.filter(cb => cb !== callback); };
};

const getAllRadioTypes = () => Object.values(RADIO_TYPES);

const init = () => {
  const saved = localStorage.getItem('selectedRadioType');
  if (saved && RADIO_TYPES[saved]) {
    currentRadioType = saved;
  }
  
  const selectors = document.querySelectorAll('.radio-type-select');
  selectors.forEach(select => {
    select.innerHTML = '';
    Object.values(RADIO_TYPES).forEach(radio => {
      const option = document.createElement('option');
      option.value = radio.id;
      option.textContent = radio.name;
      option.selected = radio.id === currentRadioType;
      select.appendChild(option);
    });
    
    select.addEventListener('change', (e) => {
      setRadioType(e.target.value);
    });
  });
  
  updateBaudRates();
  
  const baudSelect = document.getElementById('baudSelect');
  if (baudSelect) {
    baudSelect.addEventListener('change', () => {
      localStorage.setItem('baudRate_' + currentRadioType, baudSelect.value);
    });
  }
  
  console.log('Radio selector initialized: ' + RADIO_TYPES[currentRadioType].name);
};

const updateBaudRates = () => {
  const baudSelect = document.getElementById('baudSelect');
  if (!baudSelect) return;
  
  const config = RADIO_TYPES[currentRadioType];
  const savedBaud = localStorage.getItem('baudRate_' + currentRadioType);
  const preferredBaud = savedBaud ? parseInt(savedBaud) : config.defaultBaud;
  
  baudSelect.innerHTML = '';
  config.baudRates.forEach(baud => {
    const option = document.createElement('option');
    option.value = baud;
    option.textContent = baud;
    option.selected = baud === preferredBaud;
    baudSelect.appendChild(option);
  });
  
  if (config.baudRates.includes(preferredBaud)) {
    baudSelect.value = preferredBaud;
  }
};

const updateUI = () => {
  const config = RADIO_TYPES[currentRadioType];
  const isK5 = currentRadioType === 'K5';
  const isTK11 = currentRadioType === 'TK11';
  const isRT890 = currentRadioType === 'RT890';
  const isH3 = currentRadioType === 'H3';
  const isRT880 = currentRadioType === 'RT880';
  
  document.querySelectorAll('.k5-only').forEach(el => {
    el.style.display = isK5 ? '' : 'none';
  });
  
  document.querySelectorAll('.tk11-only').forEach(el => {
    el.style.display = isTK11 ? '' : 'none';
  });
  
  document.querySelectorAll('.rt890-only').forEach(el => {
    el.style.display = isRT890 ? '' : 'none';
  });
  
  document.querySelectorAll('.h3-only').forEach(el => {
    el.style.display = isH3 ? '' : 'none';
  });
  
  document.querySelectorAll('.rt880-only').forEach(el => {
    el.style.display = isRT880 ? '' : 'none';
  });
  
  document.querySelectorAll('.k5-tk11-only').forEach(el => {
    el.style.display = (isK5 || isTK11) ? '' : 'none';
  });
  
  const navItems = document.querySelectorAll('.nav-links .nav-item');
  navItems.forEach(item => {
    const navTarget = item.getAttribute('data-nav');
    
    const k5Tabs = ['instructions', 'home', 'k1', 'channels', 'settings', 'mirror', 'smr', 'spectrum', 'unbricking'];
    const tk11Tabs = ['instructions', 'home', 'channels', 'tk11-settings'];
    const rt890Tabs = ['instructions', 'rt890-flash', 'rt890-tools'];
    const h3Tabs = ['instructions', 'h3-flash', 'h3-channels', 'h3-bandplan', 'h3-codeplug'];
    const rt880Tabs = ['instructions', 'rt880-flash', 'rt880-monitor', 'rt880-spi'];
    
    if (isK5) {
      item.style.display = k5Tabs.includes(navTarget) ? '' : 'none';
    } else if (isTK11) {
      item.style.display = tk11Tabs.includes(navTarget) ? '' : 'none';
    } else if (isRT890) {
      item.style.display = rt890Tabs.includes(navTarget) ? '' : 'none';
    } else if (isH3) {
      item.style.display = h3Tabs.includes(navTarget) ? '' : 'none';
    } else if (isRT880) {
      item.style.display = rt880Tabs.includes(navTarget) ? '' : 'none';
    }
  });
  
  const currentHash = window.location.hash.replace('#', '') || 'instructions';
  if (isRT890 && !['instructions', 'rt890-flash', 'rt890-tools'].includes(currentHash)) {
    window.location.hash = '#instructions';
  } else if (isTK11 && !['instructions', 'home', 'channels', 'tk11-settings'].includes(currentHash)) {
    window.location.hash = '#instructions';
  } else if (isH3 && !h3Tabs.includes(currentHash)) {
    window.location.hash = '#instructions';
  } else if (isRT880 && !rt880Tabs.includes(currentHash)) {
    window.location.hash = '#instructions';
  }
  
  document.querySelectorAll('.memory-size').forEach(el => {
    el.textContent = (config.memorySize / 1024).toFixed(1) + ' KB';
  });
  
  document.querySelectorAll('.channel-count').forEach(el => {
    el.textContent = config.channelCount;
  });
  
  const memorySizeDetectorSection = document.getElementById('memorySizeDetectorSection');
  const eepromCleanerSection = document.getElementById('eepromCleanerSection');
  
  if (memorySizeDetectorSection) memorySizeDetectorSection.style.display = isK5 ? '' : 'none';
  if (eepromCleanerSection) eepromCleanerSection.style.display = isK5 ? '' : 'none';
  
  updateBaudRates();
  console.log('UI updated for ' + config.name);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { init(); updateUI(); });
} else {
  init();
  updateUI();
}

onRadioTypeChange(() => updateUI());

export { RADIO_TYPES, getRadioType, getRadioConfig, setRadioType, onRadioTypeChange, getAllRadioTypes, updateUI };
