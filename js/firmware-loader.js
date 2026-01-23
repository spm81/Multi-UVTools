/**
 * Firmware Loader Module
 * Loads firmware database from JSON and populates dropdowns for K5, K1, and RT890
 */

/**
 * Loads GitHub Release assets using GitHub API (CORS-enabled)
 * Handles URLs like: github.com/user/repo/releases/download/tag/file.bin
 */
async function loadFirmwareWithCORS(releaseUrl) {
  console.log('[GitHub] Loading release asset from:', releaseUrl);
  
  // Parse: github.com/USER/REPO/releases/download/TAG/FILENAME
  const match = releaseUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/releases\/download\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid GitHub release URL');
  }
  
  const [, user, repo, tag, filename] = match;
  console.log(`[GitHub] Parsed: ${user}/${repo} @ ${tag} → ${filename}`);
  
  // Step 1: Get release info from GitHub API
  const apiUrl = `https://api.github.com/repos/${user}/${repo}/releases/tags/${tag}`;
  console.log('[GitHub] Fetching release info from API...');
  
  const releaseResponse = await fetch(apiUrl);
  if (!releaseResponse.ok) {
    throw new Error(`GitHub API error: ${releaseResponse.status}`);
  }
  
  const releaseData = await releaseResponse.json();
  
  // Step 2: Find matching asset
  const asset = releaseData.assets.find(a => a.name === filename);
  if (!asset) {
    throw new Error(`Asset "${filename}" not found in release "${tag}"`);
  }
  
  console.log(`[GitHub] Found asset ID ${asset.id}: ${asset.name} (${asset.size} bytes)`);
  
  // Step 3: Download via API (has CORS!)
  const assetUrl = asset.url;
  console.log('[GitHub] Downloading asset via API...');
  
  const assetResponse = await fetch(assetUrl, {
    headers: {
      'Accept': 'application/octet-stream'
    }
  });
  
  if (!assetResponse.ok) {
    throw new Error(`Asset download failed: ${assetResponse.status}`);
  }
  
  const arrayBuffer = await assetResponse.arrayBuffer();
  console.log(`[GitHub] ✅ Downloaded ${arrayBuffer.byteLength} bytes`);
  
  return new Uint8Array(arrayBuffer);
}

/**
 * Converts GitHub blob/raw URLs to jsDelivr CDN URLs
 * Avoids CORS issues when downloading from GitHub
 */
function convertGitHubUrl(url) {
  if (!url.includes('github.com')) {
    return url;
  }

  // Convert GitHub blob URL to jsDelivr CDN
  // https://github.com/user/repo/blob/branch/path → https://cdn.jsdelivr.net/gh/user/repo@branch/path
  const blobMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/);
  if (blobMatch) {
    const [, user, repo, branch, path] = blobMatch;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
  }

  // Convert GitHub raw URL to jsDelivr CDN
  const rawMatch = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
  if (rawMatch) {
    const [, user, repo, branch, path] = rawMatch;
    return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
  }

  return url;
}

/**
 * Loads firmware database and populates K5 dropdown
 */
export async function initK5FirmwareDropdown() {
  const dropdown = document.getElementById('k5FirmwareSelect');
  if (!dropdown) {
    console.warn('[Firmware Loader] Dropdown #k5FirmwareSelect not found');
    return;
  }

  try {
    console.log('[Firmware Loader] Loading firmwares.json...');
    const response = await fetch('js/firmwares.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Firmware Loader] Loaded ${data.k5_firmwares.length} K5 groups`);

    // Clear existing options (except placeholder)
    dropdown.innerHTML = '<option value="">Select Firmware</option>';

    // Populate dropdown with groups
    data.k5_firmwares.forEach(group => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.group;

      group.firmwares.forEach(fw => {
        const option = document.createElement('option');
        option.value = convertGitHubUrl(fw.path);
        option.textContent = fw.name;
        option.dataset.profile = fw.profile || 'k5-stock'; // Default to stock profile
        optgroup.appendChild(option);
      });

      dropdown.appendChild(optgroup);
    });

    console.log('[Firmware Loader] ✅ K5 dropdown populated successfully');

  } catch (error) {
    console.error('[Firmware Loader] Failed to load K5 firmwares:', error);
    dropdown.innerHTML = '<option value="">⚠️ Failed to load firmware list</option>';
  }
}

/**
 * Loads firmware database and populates K1 dropdown
 */
export async function initK1FirmwareDropdown() {
  const dropdown = document.getElementById('k1FirmwareSelect');
  if (!dropdown) {
    console.warn('[Firmware Loader] Dropdown #k1FirmwareSelect not found');
    return;
  }

  try {
    console.log('[Firmware Loader] Loading K1 firmwares from firmwares.json...');
    const response = await fetch('js/firmwares.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Firmware Loader] Loaded ${data.k1_firmwares.length} K1 groups`);

    // Clear existing options (except placeholder)
    dropdown.innerHTML = '<option value="">-- Select firmware --</option>';

    // Populate dropdown with groups
    data.k1_firmwares.forEach(group => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.group;

      group.firmwares.forEach(fw => {
        const option = document.createElement('option');
        option.value = convertGitHubUrl(fw.path);
        option.textContent = fw.name;
        option.dataset.profile = fw.profile || 'k1-stock';
        optgroup.appendChild(option);
      });

      dropdown.appendChild(optgroup);
    });

    console.log('[Firmware Loader] ✅ K1 dropdown populated successfully');

  } catch (error) {
    console.error('[Firmware Loader] Failed to load K1 firmwares:', error);
    dropdown.innerHTML = '<option value="">⚠️ Failed to load firmware list</option>';
  }
}

/**
 * Loads firmware database and populates RT890 dropdown
 */
export async function initRT890FirmwareDropdown() {
  const dropdown = document.getElementById('rt890FirmwareSelect');
  if (!dropdown) {
    console.warn('[Firmware Loader] Dropdown #rt890FirmwareSelect not found');
    return;
  }

  try {
    console.log('[Firmware Loader] Loading RT890 firmwares from firmwares.json...');
    const response = await fetch('js/firmwares.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Firmware Loader] Loaded ${data.rt890_firmwares.length} RT890 groups`);

    // Clear existing options (except first option)
    const firstOption = dropdown.options[0]?.cloneNode(true);
    dropdown.innerHTML = '';
    if (firstOption) dropdown.appendChild(firstOption);

    // Populate dropdown with groups
    data.rt890_firmwares.forEach(group => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.group;

      group.firmwares.forEach(fw => {
        const option = document.createElement('option');
        option.value = convertGitHubUrl(fw.path);
        option.textContent = fw.name;
        option.dataset.profile = fw.profile || 'rt890-stock';
        optgroup.appendChild(option);
      });

      dropdown.appendChild(optgroup);
    });

    console.log('[Firmware Loader] ✅ RT890 dropdown populated successfully');

  } catch (error) {
    console.error('[Firmware Loader] Failed to load RT890 firmwares:', error);
    const errorOption = document.createElement('option');
    errorOption.value = '';
    errorOption.textContent = '⚠️ Failed to load firmware list';
    dropdown.appendChild(errorOption);
  }
}

/**
 * Legacy function for backward compatibility
 * Initializes K5 dropdown (renamed from initFirmwareDropdown)
 */
export async function initFirmwareDropdown() {
  await initK5FirmwareDropdown();
}

/**
 * Gets the profile associated with selected firmware
 * @param {string} dropdownId - ID of dropdown element
 * @returns {string} Profile ID (e.g., 'k5-stock', 'k5-f4hwn', 'k1-stock', 'rt890-stock')
 */
export function getSelectedProfile(dropdownId = 'k5FirmwareSelect') {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return 'k5-stock';

  const selectedOption = dropdown.options[dropdown.selectedIndex];
  if (!selectedOption || !selectedOption.dataset.profile) {
    return dropdownId.includes('k1') ? 'k1-stock' : 
           dropdownId.includes('rt890') ? 'rt890-stock' : 
           'k5-stock';
  }

  return selectedOption.dataset.profile;
}
