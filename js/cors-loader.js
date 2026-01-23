// =============================================================================
// CORS-Enabled Firmware Loader
// Handles GitHub releases and other CORS-blocked URLs
// =============================================================================

/**
 * Load firmware from URL with automatic CORS proxy for GitHub releases
 * @param {string} url - Firmware URL
 * @returns {Promise<Uint8Array>} - Firmware data
 */
window.loadFirmwareWithCORS = async function(url) {
  console.log(`[CORS Loader] Loading firmware from: ${url}`);
  
  // Detect GitHub release URLs
  const isGitHubRelease = url.includes('github.com') && url.includes('/releases/download/');
  
  let finalUrl = url;
  
  if (isGitHubRelease) {
    // Use CORS proxy for GitHub releases
    finalUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    console.log(`[CORS Loader] GitHub release detected - using CORS proxy`);
    console.log(`[CORS Loader] Proxy URL: ${finalUrl}`);
  }
  
  try {
    const response = await fetch(finalUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const size = uint8Array.length;
    
    console.log(`[CORS Loader] ✅ Downloaded ${size} bytes`);
    return uint8Array;
    
  } catch (error) {
    console.error(`[CORS Loader] ❌ Failed to load firmware:`, error);
    throw error;
  }
};

console.log('[CORS Loader] ✅ Loaded successfully');
