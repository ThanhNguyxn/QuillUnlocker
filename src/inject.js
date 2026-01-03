/*
 * QuillUnlocker - Inject Script
 * Injects the unlock script into QuillBot pages
 */

// Cross-browser compatibility
const browser = chrome ?? window.browser;

// Inject the unlock script
const script = document.createElement('script');
script.src = browser.runtime.getURL('src/unlock.js');
script.onload = function () {
    this.remove();
};
(document.head || document.documentElement).prepend(script);

// Handle communication between page and extension
window.addEventListener('QuillUnlocker-Send', async function ({ detail }) {
    try {
        const response = await browser.runtime.sendMessage(detail);
        window.dispatchEvent(new CustomEvent('QuillUnlocker-Receive', {
            detail: response
        }));
    } catch (error) {
        console.error('[QuillUnlocker] Communication error:', error);
    }
}, false);

// Log successful injection
console.log('%c[QuillUnlocker]%c Extension loaded successfully!',
    'color: #00d4aa; font-weight: bold;',
    'color: inherit;'
);
