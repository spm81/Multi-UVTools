/**
 * Basic Settings Module
 * Handles reading and writing settings for different firmware profiles
 */

import {
  eepromInit,
  eepromRead,
  eepromWrite,
  eepromReboot,
} from "./protocol.js";
import { claim, release, getPort, subscribe } from "./serial-manager.js";
import ProfileManager from "./profile-manager.js";

// DOM Elements
const readSettingsBtn = document.getElementById("readSettingsBtn");
const writeSettingsBtn = document.getElementById("writeSettingsBtn");
const settingsStatus = document.getElementById("settingsStatus");
const settingsFill = document.getElementById("settingsFill");
const settingsPct = document.getElementById("settingsPct");
const settingsModal = document.getElementById("settingsModal");
const settingsModalTitle = document.getElementById("settingsModalTitle");
const settingsModalMessage = document.getElementById("settingsModalMessage");
const settingsModalFill = document.getElementById("settingsModalFill");
const settingsModalPct = document.getElementById("settingsModalPct");
const settingsPanel = document.getElementById("settingsPanel");
const connectionDot = document.getElementById("settingsStatusDot");
const connectionLabel = document.getElementById("settingsStatusLabel");
const firmwareEl = document.getElementById("settingsFirmware");
const firmwareProfile = document.getElementById("firmwareProfile");
const profileSettingsContainer = document.getElementById("profileSettings");

let canEdit = false;
let isConnected = false;
let isBusy = false;

// Initialize Profile Manager
ProfileManager.init("profileSettings");

// Populate profile selector
const populateProfileSelector = () => {
    if (!firmwareProfile) return;
    
    const profiles = ProfileManager.getProfileListForRadio('K5');
    firmwareProfile.innerHTML = profiles
        .map(p => `<option value="${p.id}">${p.name}</option>`)
        .join("");
    
    // Default to Joaquim (original UV-KX firmware)
    firmwareProfile.value = "joaquim";
    ProfileManager.switchProfile("joaquim");
};

populateProfileSelector();

// Handle profile change
if (firmwareProfile) {
    firmwareProfile.addEventListener("change", () => {
        ProfileManager.switchProfile(firmwareProfile.value);
        setEditEnabled(false); // Disable editing until data is read
    });
}

const setStatus = (message, tone = "info") => {
    if (!settingsStatus) return;
    settingsStatus.textContent = message;
    settingsStatus.classList.toggle("status-error", tone === "error");
};

const setProgress = (value, visible = true) => {
    const pct = Math.max(0, Math.min(100, value));
    if (settingsFill) {
        const container = settingsFill.closest(".progress");
        if (container) container.classList.toggle("active", visible);
        settingsFill.style.width = `${pct}%`;
    }
    if (settingsPct) settingsPct.textContent = `${pct.toFixed(1)}%`;
    if (settingsModalFill) settingsModalFill.style.width = `${pct}%`;
    if (settingsModalPct) settingsModalPct.textContent = `${pct.toFixed(1)}%`;
};

const showModal = (title, message) => {
    if (settingsModalTitle) settingsModalTitle.textContent = title;
    if (settingsModalMessage) settingsModalMessage.textContent = message;
    if (settingsModal) {
        settingsModal.classList.add("active");
        settingsModal.setAttribute("aria-hidden", "false");
    }
    document.body.style.overflow = "hidden";
};

const hideModal = () => {
    if (settingsModal) {
        settingsModal.classList.remove("active");
        settingsModal.setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "";
};

const updateActionState = () => {
    if (readSettingsBtn) readSettingsBtn.disabled = isBusy || !isConnected;
    if (writeSettingsBtn) writeSettingsBtn.disabled = isBusy || !isConnected || !canEdit;
};

const disableActions = (disabled) => {
    isBusy = disabled;
    updateActionState();
};

const setEditEnabled = (enabled) => {
    canEdit = enabled;
    updateActionState();
    if (writeSettingsBtn) {
        writeSettingsBtn.classList.toggle("is-disabled", !enabled || !isConnected);
    }
    
    // Enable/disable all form controls in profile settings
    if (profileSettingsContainer) {
        const controls = profileSettingsContainer.querySelectorAll("select, input");
        controls.forEach((control) => {
            control.disabled = !enabled || !isConnected;
        });
    }
    
    if (settingsPanel) {
        settingsPanel.classList.toggle("is-locked", !enabled || !isConnected);
    }
};

// Read a range of EEPROM memory
const readRange = async (start, length) => {
    const buffer = new Uint8Array(length);
    for (let offset = 0; offset < length; offset += 0x80) {
        const size = Math.min(0x80, length - offset);
        const data = await eepromRead(getPort(), start + offset, size);
        buffer.set(data.slice(0, size), offset);
    }
    return buffer;
};

// Write a range to EEPROM memory
const writeRange = async (start, data) => {
    for (let offset = 0; offset < data.length; offset += 0x40) {
        const chunk = data.slice(offset, offset + 0x40);
        await eepromWrite(getPort(), start + offset, chunk, chunk.length);
    }
};

// Read settings based on current profile
const readSettings = async () => {
    if (!isConnected) {
        setStatus("Connect the radio on Home first.", "error");
        return;
    }
    if (!claim("settings")) {
        setStatus("Another tool is using the serial connection.", "error");
        return;
    }
    
    const port = getPort();
    if (!port) {
        setStatus("No serial port available.", "error");
        release("settings");
        return;
    }
    
    const profileId = firmwareProfile ? firmwareProfile.value : "stock";
    const profile = ProfileManager.getProfile(profileId);
    
    if (!profile) {
        setStatus("Profile not found.", "error");
        release("settings");
        return;
    }
    
    disableActions(true);
    setEditEnabled(false);
    setProgress(0, true);
    setStatus("Reading settings...");
    showModal("Reading settings", "Please keep the radio connected.");
    
    try {
        await eepromInit(port);
        setProgress(10, true);
        
        const requiredBlocks = ProfileManager.getRequiredBlocks(profileId);
        const blocks = {};
        
        let blockCount = 0;
        const totalBlocks = Object.keys(requiredBlocks).length;
        
        for (const [name, info] of Object.entries(requiredBlocks)) {
            blocks[name] = await readRange(info.start, info.size);
            blockCount++;
            setProgress(10 + (blockCount / totalBlocks) * 70, true);
        }
        
        // Profile-specific reading
        let settings;
        if (profileId === "ijv") {
            // IJV has different structure
            settings = profile.readSettings(blocks.settings);
        } else {
            // Stock, F4HWN, Matoz use similar block structure
            settings = profile.readSettings(blocks);
        }
        
        // Update form with settings
        profile.updateForm(settings);
        
        setProgress(100, true);
        setStatus("Settings loaded.");
        setEditEnabled(true);
        
        setTimeout(() => {
            setProgress(0, false);
            hideModal();
        }, 800);
        
    } catch (error) {
        console.error("Read error:", error);
        setStatus(`Read failed: ${error.message}`, "error");
        setProgress(0, false);
        setEditEnabled(false);
        hideModal();
    } finally {
        disableActions(false);
        release("settings");
    }
};

// Write settings based on current profile
const writeSettings = async () => {
    if (!isConnected) {
        setStatus("Connect the radio on Home first.", "error");
        return;
    }
    if (!claim("settings")) {
        setStatus("Another tool is using the serial connection.", "error");
        return;
    }
    if (!canEdit) {
        setStatus("Read from the radio before editing.", "error");
        release("settings");
        return;
    }
    
    const port = getPort();
    if (!port) {
        setStatus("No serial port available.", "error");
        release("settings");
        return;
    }
    
    const profileId = firmwareProfile ? firmwareProfile.value : "stock";
    const profile = ProfileManager.getProfile(profileId);
    
    if (!profile) {
        setStatus("Profile not found.", "error");
        release("settings");
        return;
    }
    
    disableActions(true);
    setEditEnabled(false);
    setProgress(0, true);
    setStatus("Writing settings...");
    showModal("Writing settings", "Please keep the radio connected.");
    
    try {
        await eepromInit(port);
        setProgress(10, true);
        
        // Get form settings
        const formSettings = profile.getFormSettings();
        
        // Read current blocks to preserve unchanged data
        const requiredBlocks = ProfileManager.getRequiredBlocks(profileId);
        const blocks = {};
        
        let blockCount = 0;
        const totalBlocks = Object.keys(requiredBlocks).length;
        
        for (const [name, info] of Object.entries(requiredBlocks)) {
            blocks[name] = await readRange(info.start, info.size);
            blockCount++;
            setProgress(10 + (blockCount / totalBlocks) * 30, true);
        }
        
        // Apply form settings to blocks
        if (profileId === "ijv") {
            profile.writeSettings(blocks.settings, formSettings);
        } else {
            profile.writeSettings(blocks, formSettings);
        }
        
        setProgress(50, true);
        
        // Write blocks back
        blockCount = 0;
        for (const [name, info] of Object.entries(requiredBlocks)) {
            await writeRange(info.start, blocks[name]);
            blockCount++;
            setProgress(50 + (blockCount / totalBlocks) * 40, true);
        }
        
        await eepromReboot(port);
        
        setProgress(100, true);
        setStatus("Settings written successfully.");
        
        setTimeout(() => {
            setProgress(0, false);
            hideModal();
        }, 800);
        
    } catch (error) {
        console.error("Write error:", error);
        setStatus(`Write failed: ${error.message}`, "error");
        setProgress(0, false);
        hideModal();
    } finally {
        disableActions(false);
        release("settings");
    }
};

// Event listeners
if (readSettingsBtn) readSettingsBtn.addEventListener("click", readSettings);
if (writeSettingsBtn) writeSettingsBtn.addEventListener("click", writeSettings);

// Subscribe to connection state changes
subscribe((state) => {
    isConnected = state.connected;
    if (connectionDot) {
        connectionDot.dataset.status = state.connected ? "connected" : "disconnected";
    }
    if (connectionLabel) {
        connectionLabel.textContent = state.connected ? "Connected" : "Disconnected";
    }
    if (firmwareEl) {
        firmwareEl.textContent = state.firmwareVersion || "-";
    }
    if (!state.connected) {
        setEditEnabled(false);
    }
    updateActionState();
});

// Initial state
setStatus("Idle.");
setProgress(0, false);
hideModal();
setEditEnabled(false);
