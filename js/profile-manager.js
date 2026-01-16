/**
 * Profile Manager
 * Manages firmware profiles for different K5 firmware versions and TK11
 */

import { IJV_PROFILE } from "./profiles/ijv-x360.js";
import { F4HWN_V43_PROFILE } from "./profiles/f4hwn-v43.js";
import { STOCK_PROFILE } from "./profiles/stock.js";
import { MATOZ_PROFILE } from "./profiles/matoz.js";
import { JOAQUIM_PROFILE } from "./profiles/joaquim.js";
import { FAGCI_PROFILE } from "./profiles/fagci.js";
import { TK11_PROFILE } from "./profiles/tk11.js";

// K5/K1 profiles - ordered by popularity/usage
const K5_PROFILES = {
    joaquim: JOAQUIM_PROFILE,
    f4hwn_v43: F4HWN_V43_PROFILE,
    ijv: IJV_PROFILE,
    matoz: MATOZ_PROFILE,
    fagci: FAGCI_PROFILE,
    stock: STOCK_PROFILE
};

// TK11 profiles
const TK11_PROFILES = {
    tk11: TK11_PROFILE
};

// All profiles combined for backwards compatibility
const PROFILES = { ...K5_PROFILES, ...TK11_PROFILES };

let currentProfile = null;
let profileContainer = null;

/**
 * Initialize the profile manager
 * @param {string} containerId - ID of the container element for profile settings
 */
export function init(containerId) {
    profileContainer = document.getElementById(containerId);
    if (!profileContainer) {
        console.error("Profile container not found:", containerId);
    }
}

/**
 * Get list of available profiles
 * @returns {Array} Array of {id, name} objects
 */
export function getProfileList() {
    return Object.entries(PROFILES).map(([id, profile]) => ({
        id,
        name: profile.name
    }));
}

/**
 * Get current profile
 * @returns {Object|null} Current profile object or null
 */
export function getCurrentProfile() {
    return currentProfile;
}

/**
 * Get current profile ID
 * @returns {string|null} Current profile ID or null
 */
export function getCurrentProfileId() {
    return currentProfile ? currentProfile.id : null;
}

/**
 * Switch to a different profile
 * @param {string} profileId - Profile ID to switch to
 */
export function switchProfile(profileId) {
    const profile = PROFILES[profileId];
    if (!profile) {
        console.error("Profile not found:", profileId);
        return false;
    }
    
    currentProfile = profile;
    
    // Clear and regenerate HTML
    if (profileContainer) {
        profileContainer.innerHTML = profile.generateHTML();
        profile.initDropdowns();
    }
    
    console.log("Switched to profile:", profile.name);
    return true;
}

/**
 * Get profile by ID
 * @param {string} profileId - Profile ID
 * @returns {Object|null} Profile object or null
 */
export function getProfile(profileId) {
    return PROFILES[profileId] || null;
}

/**
 * Check if a profile uses extended addresses (0x1FF2 range)
 * @param {string} profileId - Profile ID
 * @returns {boolean}
 */
export function hasExtendedAddresses(profileId) {
    const profile = PROFILES[profileId];
    return profile && profile.addresses && (profile.addresses.f4hwn_ext || profile.addresses.joaquim_ext);
}

/**
 * Check if profile is IJV (uses different address structure)
 * @param {string} profileId - Profile ID
 * @returns {boolean}
 */
export function isIJVProfile(profileId) {
    return profileId === "ijv";
}

/**
 * Check if profile is Fagci (uses unique address structure starting at 0x0000)
 * @param {string} profileId - Profile ID
 * @returns {boolean}
 */
export function isFagciProfile(profileId) {
    return profileId === "fagci";
}

/**
 * Check if profile is TK11
 * @param {string} profileId - Profile ID
 * @returns {boolean}
 */
export function isTK11Profile(profileId) {
    return profileId === "tk11";
}

/**
 * Get profiles for a specific radio type
 * @param {string} radioType - 'K5' or 'TK11'
 * @returns {Object} Profiles object
 */
export function getProfilesForRadio(radioType) {
    return radioType === 'TK11' ? TK11_PROFILES : K5_PROFILES;
}

/**
 * Get profile list for a specific radio type
 * @param {string} radioType - 'K5' or 'TK11'
 * @returns {Array} Array of {id, name} objects
 */
export function getProfileListForRadio(radioType) {
    const profiles = getProfilesForRadio(radioType);
    return Object.entries(profiles).map(([id, profile]) => ({
        id,
        name: profile.name
    }));
}

/**
 * Get the memory blocks needed for a profile
 * @param {string} profileId - Profile ID
 * @returns {Object} Object with block names and addresses
 */
export function getRequiredBlocks(profileId) {
    const profile = PROFILES[profileId];
    if (!profile) return {};
    
    const blocks = {};
    
    if (profileId === "tk11") {
        // TK11 uses internal memory with different layout
        blocks.channels = { start: 0x00000, size: 0x11000 };  // 999 channels
        blocks.channelUsage = { start: 0x11000, size: 0x400 };
        blocks.settings = { start: 0x13000, size: 0x100 };
    } else if (profileId === "ijv") {
        // IJV uses different addresses starting at 0x0000
        blocks.settings = { start: 0x0000, size: 0x60 };
        blocks.logo = { start: 0x0150, size: 0x20 };
    } else if (profileId === "fagci") {
        // Fagci R3b0rn uses unique memory layout starting at 0x0000
        blocks.settings = { start: 0x0000, size: 0x15 };  // 21 bytes for settings
    } else {
        // Stock, F4HWN, Matoz, Joaquim use similar addresses
        blocks.e70 = { start: 0x0E70, size: 0x10 };
        blocks.e80 = { start: 0x0E80, size: 0x10 };
        blocks.e90 = { start: 0x0E90, size: 0x10 };
        blocks.ea0 = { start: 0x0EA0, size: 0x08 };
        blocks.ea8 = { start: 0x0EA8, size: 0x08 };
        blocks.logo = { start: 0x0EB0, size: 0x20 };
        blocks.f40 = { start: 0x0F40, size: 0x08 };
        
        // Extended settings at 0x1FF2 for F4HWN v4.3 and Joaquim
        if (profileId === "f4hwn_v43" || profileId === "joaquim") {
            blocks.ff2 = { start: 0x1FF2, size: 0x08 };
        }
    }
    
    return blocks;
}

export default {
    init,
    getProfileList,
    getCurrentProfile,
    getCurrentProfileId,
    switchProfile,
    getProfile,
    hasExtendedAddresses,
    isIJVProfile,
    isFagciProfile,
    isTK11Profile,
    getProfilesForRadio,
    getProfileListForRadio,
    getRequiredBlocks,
    K5_PROFILES,
    TK11_PROFILES
};
