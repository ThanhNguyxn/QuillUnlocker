/* QuillUnlocker - Enhanced Popup JavaScript */

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadStats();
    await loadVersion();
    setupEventListeners();
});

// Load settings
async function loadSettings() {
    try {
        const { settings } = await chrome.storage.local.get('settings');
        const enableToggle = document.getElementById('enableToggle');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');

        if (settings) {
            enableToggle.checked = settings.enabled ?? true;
            updateStatusUI(settings.enabled);
        }
    } catch (e) {
        console.error('[QuillUnlocker] Error loading settings:', e);
    }
}

// Load statistics
async function loadStats() {
    try {
        const { stats } = await chrome.storage.local.get('stats');

        if (stats) {
            document.getElementById('todayWords').textContent = formatNumber(stats.todayWords || 0);
            document.getElementById('totalWords').textContent = formatNumber(stats.totalWords || 0);
            document.getElementById('totalParaphrases').textContent = formatNumber(stats.totalParaphrases || 0);
        }
    } catch (e) {
        console.error('[QuillUnlocker] Error loading stats:', e);
    }
}

// Load version
async function loadVersion() {
    const manifest = chrome.runtime.getManifest();
    document.getElementById('version').textContent = 'v' + manifest.version;
}

// Format numbers
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Update status UI
function updateStatusUI(enabled) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    if (enabled) {
        statusIndicator.classList.add('active');
        statusIndicator.classList.remove('inactive');
        statusText.textContent = 'Premium Unlocked';
        statusText.style.color = '#00d4aa';
    } else {
        statusIndicator.classList.remove('active');
        statusIndicator.classList.add('inactive');
        statusText.textContent = 'Disabled';
        statusText.style.color = '#f44336';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Enable toggle
    document.getElementById('enableToggle').addEventListener('change', async (e) => {
        const { settings } = await chrome.storage.local.get('settings');
        settings.enabled = e.target.checked;
        await chrome.storage.local.set({ settings });
        updateStatusUI(settings.enabled);

        // Notify content scripts
        const tabs = await chrome.tabs.query({ url: 'https://quillbot.com/*' });
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'toggleExtension',
                enabled: settings.enabled
            }).catch(() => { });
        });
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Open QuillBot button
    document.getElementById('openQuillBot').addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://quillbot.com' });
    });

    // Paraphrase current page button  
    document.getElementById('paraphraseTab').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.tabs.sendMessage(tab.id, { action: 'paraphrasePage' }).catch(() => {
                // If not on QuillBot, open QuillBot
                chrome.tabs.create({ url: 'https://quillbot.com/summarizer' });
            });
        }
    });
}
