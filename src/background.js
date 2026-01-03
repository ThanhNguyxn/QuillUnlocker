/*
 * QuillUnlocker - Enhanced Background Service Worker
 * Features:
 * - Context menu integration
 * - Usage statistics tracking
 * - Keyboard shortcuts
 * - Notifications
 */

// Default settings
const DEFAULT_SETTINGS = {
    enabled: true,
    showBadge: true,
    showNotifications: true,
    trackStats: true,
    floatingToolbar: true,
    theme: 'dark'
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
    // Initialize storage
    const settings = await chrome.storage.local.get('settings');
    if (!settings.settings) {
        await chrome.storage.local.set({
            settings: DEFAULT_SETTINGS,
            stats: {
                totalWords: 0,
                totalParaphrases: 0,
                todayWords: 0,
                todayParaphrases: 0,
                lastResetDate: new Date().toDateString(),
                history: []
            }
        });
    }

    // Create context menus
    createContextMenus();

    // Show welcome page on first install
    if (details.reason === 'install') {
        chrome.tabs.create({ url: 'popup/welcome.html' });
        showNotification('QuillUnlocker Installed', 'Premium features are now unlocked!');
    } else if (details.reason === 'update') {
        const manifest = chrome.runtime.getManifest();
        showNotification('QuillUnlocker Updated', `Updated to version ${manifest.version}`);
    }
});

// Create context menus
function createContextMenus() {
    chrome.contextMenus.removeAll(() => {
        // Main menu
        chrome.contextMenus.create({
            id: 'quillunlocker-main',
            title: '✨ QuillUnlocker',
            contexts: ['selection']
        });

        // Paraphrase submenu
        chrome.contextMenus.create({
            id: 'paraphrase-standard',
            parentId: 'quillunlocker-main',
            title: '📝 Paraphrase (Standard)',
            contexts: ['selection']
        });

        chrome.contextMenus.create({
            id: 'paraphrase-fluency',
            parentId: 'quillunlocker-main',
            title: '✨ Paraphrase (Fluency)',
            contexts: ['selection']
        });

        chrome.contextMenus.create({
            id: 'paraphrase-formal',
            parentId: 'quillunlocker-main',
            title: '🎩 Paraphrase (Formal)',
            contexts: ['selection']
        });

        chrome.contextMenus.create({
            id: 'paraphrase-creative',
            parentId: 'quillunlocker-main',
            title: '🎨 Paraphrase (Creative)',
            contexts: ['selection']
        });

        // Separator
        chrome.contextMenus.create({
            id: 'separator',
            parentId: 'quillunlocker-main',
            type: 'separator',
            contexts: ['selection']
        });

        // Open QuillBot
        chrome.contextMenus.create({
            id: 'open-quillbot',
            parentId: 'quillunlocker-main',
            title: '🚀 Open in QuillBot',
            contexts: ['selection']
        });
    });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    const selectedText = info.selectionText;

    if (info.menuItemId === 'open-quillbot') {
        // Open QuillBot with selected text
        const encodedText = encodeURIComponent(selectedText);
        chrome.tabs.create({
            url: `https://quillbot.com/paraphraser?text=${encodedText}`
        });
        updateStats(selectedText.split(/\s+/).length);
    } else if (info.menuItemId.startsWith('paraphrase-')) {
        const mode = info.menuItemId.replace('paraphrase-', '');
        const encodedText = encodeURIComponent(selectedText);
        chrome.tabs.create({
            url: `https://quillbot.com/paraphraser?text=${encodedText}&mode=${mode}`
        });
        updateStats(selectedText.split(/\s+/).length);
    }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'quick-paraphrase') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.tabs.sendMessage(tab.id, { action: 'quickParaphrase' });
        }
    } else if (command === 'toggle-extension') {
        const { settings } = await chrome.storage.local.get('settings');
        settings.enabled = !settings.enabled;
        await chrome.storage.local.set({ settings });
        showNotification(
            'QuillUnlocker',
            settings.enabled ? 'Extension enabled' : 'Extension disabled'
        );
    }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.method) {
        case 'proxyFetch':
            handleProxyFetch(message.params)
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'getSettings':
            chrome.storage.local.get('settings')
                .then(data => sendResponse(data.settings || DEFAULT_SETTINGS));
            return true;

        case 'getStats':
            chrome.storage.local.get('stats')
                .then(data => sendResponse(data.stats));
            return true;

        case 'updateStats':
            updateStats(message.words || 0)
                .then(() => sendResponse({ success: true }));
            return true;

        case 'ping':
            sendResponse({ success: true, version: chrome.runtime.getManifest().version });
            return true;

        default:
            sendResponse({ success: false, error: 'Unknown method' });
    }
});

// Proxy fetch for bypassing CORS
async function handleProxyFetch({ url, config }) {
    const response = await fetch(url, config);
    return await response.text();
}

// Update usage statistics
async function updateStats(words = 0) {
    const { stats } = await chrome.storage.local.get('stats');
    const today = new Date().toDateString();

    // Reset daily stats if new day
    if (stats.lastResetDate !== today) {
        stats.todayWords = 0;
        stats.todayParaphrases = 0;
        stats.lastResetDate = today;
    }

    stats.totalWords += words;
    stats.todayWords += words;
    stats.totalParaphrases += 1;
    stats.todayParaphrases += 1;

    // Keep last 30 days history
    stats.history.push({
        date: today,
        words,
        timestamp: Date.now()
    });
    if (stats.history.length > 100) {
        stats.history = stats.history.slice(-100);
    }

    await chrome.storage.local.set({ stats });
}

// Show notification
function showNotification(title, message) {
    try {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title,
            message
        }, (notificationId) => {
            if (chrome.runtime.lastError) {
                console.warn('[QuillUnlocker] Notification error:', chrome.runtime.lastError.message);
            }
        });
    } catch (e) {
        console.log('[QuillUnlocker]', title, '-', message);
    }
}

console.log('[QuillUnlocker] Background service worker initialized');
