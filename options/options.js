/* QuillUnlocker - Options Page JavaScript */

// Load settings and stats on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadStats();
    setupEventListeners();
});

// Load settings from storage
async function loadSettings() {
    const { settings } = await chrome.storage.local.get('settings');

    if (settings) {
        document.getElementById('enabled').checked = settings.enabled ?? true;
        document.getElementById('showBadge').checked = settings.showBadge ?? true;
        document.getElementById('showNotifications').checked = settings.showNotifications ?? true;
        document.getElementById('trackStats').checked = settings.trackStats ?? true;
        document.getElementById('floatingToolbar').checked = settings.floatingToolbar ?? true;
    }
}

// Load statistics from storage
async function loadStats() {
    const { stats } = await chrome.storage.local.get('stats');

    if (stats) {
        document.getElementById('totalWords').textContent = formatNumber(stats.totalWords || 0);
        document.getElementById('totalParaphrases').textContent = formatNumber(stats.totalParaphrases || 0);
        document.getElementById('todayWords').textContent = formatNumber(stats.todayWords || 0);
        document.getElementById('todayParaphrases').textContent = formatNumber(stats.todayParaphrases || 0);
    }
}

// Format large numbers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Setup event listeners
function setupEventListeners() {
    // Save button
    document.getElementById('saveBtn').addEventListener('click', saveSettings);

    // Reset button
    document.getElementById('resetBtn').addEventListener('click', resetSettings);

    // Clear stats button
    document.getElementById('clearStatsBtn').addEventListener('click', clearStats);

    // Auto-save on toggle change
    document.querySelectorAll('.toggle input').forEach(toggle => {
        toggle.addEventListener('change', saveSettings);
    });
}

// Save settings
async function saveSettings() {
    const settings = {
        enabled: document.getElementById('enabled').checked,
        showBadge: document.getElementById('showBadge').checked,
        showNotifications: document.getElementById('showNotifications').checked,
        trackStats: document.getElementById('trackStats').checked,
        floatingToolbar: document.getElementById('floatingToolbar').checked,
        theme: 'dark'
    };

    await chrome.storage.local.set({ settings });
    showToast('✅ Settings saved!');
}

// Reset settings to default
async function resetSettings() {
    const defaultSettings = {
        enabled: true,
        showBadge: true,
        showNotifications: true,
        trackStats: true,
        floatingToolbar: true,
        theme: 'dark'
    };

    await chrome.storage.local.set({ settings: defaultSettings });
    await loadSettings();
    showToast('🔄 Settings reset to default!');
}

// Clear statistics
async function clearStats() {
    if (confirm('Are you sure you want to clear all statistics? This cannot be undone.')) {
        await chrome.storage.local.set({
            stats: {
                totalWords: 0,
                totalParaphrases: 0,
                todayWords: 0,
                todayParaphrases: 0,
                lastResetDate: new Date().toDateString(),
                history: []
            }
        });
        await loadStats();
        showToast('🗑️ Statistics cleared!');
    }
}

// Show toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}
