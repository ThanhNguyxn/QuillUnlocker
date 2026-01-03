/*
 * QuillUnlocker - Advanced Unlock Logic
 * Based on research from:
 * - blueagler/QuillBot-Helper (proxy rules pattern)
 * - Ragug/quillbot-premium-for-free 
 * - GreasyFork userscripts
 * 
 * Features:
 * - API interception for premium unlock
 * - Settings integration
 * - Floating quick toolbar
 * - Stats tracking
 * - Keyboard shortcuts support
 */

(function () {
    'use strict';

    // State
    let settings = {
        enabled: true,
        showBadge: true,
        floatingToolbar: true
    };

    // Store original methods
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;
    const originalFetch = window.fetch;

    // API patterns
    const API_PATTERNS = {
        accountDetails: /get-account-details/,
        tracking: /api\/tracking/,
        premiumParaphrase: /api\/paraphraser\/single-paraphrase\/(9|10|6|8|7)/,
        paraphrase: /api\/paraphraser/
    };

    // Premium modes
    const MODES = {
        0: 'Standard', 2: 'Fluency', 6: 'Formal',
        7: 'Simple', 8: 'Creative', 9: 'Expand', 10: 'Shorten'
    };

    /**
     * Load settings from extension
     */
    async function loadSettings() {
        try {
            window.dispatchEvent(new CustomEvent('QuillUnlocker-Send', {
                detail: { method: 'getSettings' }
            }));
        } catch (e) {
            console.warn('[QuillUnlocker] Could not load settings');
        }
    }

    // Listen for settings response
    window.addEventListener('QuillUnlocker-Receive', (e) => {
        if (e.detail) {
            settings = { ...settings, ...e.detail };
            applySettings();
        }
    });

    /**
     * Apply current settings
     */
    function applySettings() {
        const badge = document.querySelector('.quillunlocker-badge');
        const toolbar = document.querySelector('.quillunlocker-toolbar');

        if (badge) badge.style.display = settings.showBadge ? 'flex' : 'none';
        if (toolbar) toolbar.style.display = settings.floatingToolbar ? 'flex' : 'none';
    }

    /**
     * Modify account details to enable premium
     */
    function modifyAccountDetails(responseText) {
        try {
            const result = JSON.parse(responseText);

            if (result.data?.profile) {
                result.data.profile.premium = true;
                result.data.profile.planName = 'Premium';
                result.data.profile.subscription = {
                    active: true,
                    plan: 'premium',
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
                };
            }

            if (result.data?.user) {
                result.data.user.premium = true;
                result.data.user.isPremium = true;
            }

            return JSON.stringify(result);
        } catch (e) {
            return responseText;
        }
    }

    /**
     * Get fake tracking response
     */
    function getTrackingResponse() {
        return JSON.stringify({
            message: "tracker action server success",
            traceID: "0",
            code: "TRACKER_SUCCESS",
            data: {},
            status: 200
        });
    }

    /**
     * Update usage stats
     */
    function updateStats(text) {
        if (!text) return;
        const words = text.trim().split(/\s+/).length;

        try {
            window.dispatchEvent(new CustomEvent('QuillUnlocker-Send', {
                detail: { method: 'updateStats', words }
            }));
        } catch (e) { }
    }

    /**
     * Override XMLHttpRequest
     */
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._quUrl = url;
        this._quMethod = method;

        if (API_PATTERNS.tracking.test(url)) {
            this._quBlocked = true;
        }

        return originalXhrOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (payload, ...rest) {
        if (!settings.enabled) {
            return originalXhrSend.call(this, payload, ...rest);
        }

        const url = this._quUrl || '';

        // Block tracking
        if (this._quBlocked) {
            Object.defineProperty(this, 'readyState', { get: () => 4 });
            Object.defineProperty(this, 'status', { get: () => 200 });
            Object.defineProperty(this, 'responseText', { get: () => getTrackingResponse() });
            setTimeout(() => {
                this.dispatchEvent(new Event('readystatechange'));
                this.dispatchEvent(new Event('load'));
            }, 10);
            return;
        }

        // Intercept account details
        if (API_PATTERNS.accountDetails.test(url)) {
            this.addEventListener('readystatechange', function () {
                if (this.readyState === 4 && this.status === 200) {
                    const modified = modifyAccountDetails(this.responseText);
                    Object.defineProperty(this, 'responseText', { get: () => modified, configurable: true });
                    Object.defineProperty(this, 'response', { get: () => modified, configurable: true });
                }
            });
        }

        // Track paraphrase usage
        if (API_PATTERNS.paraphrase.test(url) && payload) {
            try {
                const data = JSON.parse(payload);
                if (data.qupiText || data.text) {
                    updateStats(data.qupiText || data.text);
                }
            } catch (e) { }
        }

        return originalXhrSend.call(this, payload, ...rest);
    };

    /**
     * Override fetch
     */
    window.fetch = async function (resource, options) {
        if (!settings.enabled) {
            return originalFetch.apply(this, arguments);
        }

        const url = typeof resource === 'string' ? resource : resource.url;

        // Block tracking
        if (API_PATTERNS.tracking.test(url)) {
            return new Response(getTrackingResponse(), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const response = await originalFetch.apply(this, arguments);

        // Intercept account details
        if (API_PATTERNS.accountDetails.test(url)) {
            try {
                const text = await response.clone().text();
                return new Response(modifyAccountDetails(text), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            } catch (e) { }
        }

        return response;
    };

    /**
     * Inject styles
     */
    function injectStyles() {
        if (document.getElementById('quillunlocker-styles')) return;

        const style = document.createElement('style');
        style.id = 'quillunlocker-styles';
        style.textContent = `
      /* Hide upgrade prompts */
      [class*="upgrade" i], [class*="paywall" i], [class*="premium-prompt" i] {
        display: none !important;
      }
      
      /* Enable disabled buttons */
      [class*="mode"][disabled], button[disabled][class*="paraphrase"] {
        pointer-events: auto !important;
        opacity: 1 !important;
      }
      
      /* Badge */
      .quillunlocker-badge {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #00d4aa 0%, #00a885 100%);
        color: white;
        padding: 10px 16px;
        border-radius: 25px;
        font-size: 12px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        z-index: 9999;
        box-shadow: 0 4px 20px rgba(0, 212, 170, 0.4);
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .quillunlocker-badge:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(0, 212, 170, 0.5);
      }
      
      /* Floating Toolbar */
      .quillunlocker-toolbar {
        position: fixed;
        bottom: 70px;
        right: 20px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 8px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 6px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s ease;
        pointer-events: none;
      }
      
      .quillunlocker-badge:hover + .quillunlocker-toolbar,
      .quillunlocker-toolbar:hover {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      
      .quillunlocker-toolbar-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
      }
      
      .quillunlocker-toolbar-btn:hover {
        background: rgba(0, 212, 170, 0.3);
      }
      
      /* Notification */
      .quillunlocker-notif {
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: #00d4aa;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-family: -apple-system, sans-serif;
        z-index: 10001;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        animation: quSlideIn 0.3s ease;
      }
      
      @keyframes quSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
        document.head.appendChild(style);
    }

    /**
     * Add UI elements
     */
    function addUI() {
        if (document.querySelector('.quillunlocker-badge')) return;

        // Badge
        const badge = document.createElement('div');
        badge.className = 'quillunlocker-badge';
        badge.innerHTML = '✨ QuillUnlocker';
        badge.title = 'Hover for quick actions';
        document.body.appendChild(badge);

        // Floating toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'quillunlocker-toolbar';
        toolbar.innerHTML = `
      <button class="quillunlocker-toolbar-btn" data-action="paraphrase">📝 Paraphrase</button>
      <button class="quillunlocker-toolbar-btn" data-action="summarize">📊 Summarize</button>
      <button class="quillunlocker-toolbar-btn" data-action="grammar">✓ Grammar</button>
      <button class="quillunlocker-toolbar-btn" data-action="settings">⚙️ Settings</button>
      <button class="quillunlocker-toolbar-btn" data-action="sponsor">💖 Support</button>
    `;
        document.body.appendChild(toolbar);

        // Toolbar click handlers
        toolbar.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (!action) return;

            switch (action) {
                case 'paraphrase':
                    window.location.href = 'https://quillbot.com';
                    break;
                case 'summarize':
                    window.location.href = 'https://quillbot.com/summarize';
                    break;
                case 'grammar':
                    window.location.href = 'https://quillbot.com/grammar-check';
                    break;
                case 'settings':
                    window.dispatchEvent(new CustomEvent('QuillUnlocker-Send', {
                        detail: { method: 'openOptions' }
                    }));
                    break;
                case 'sponsor':
                    window.open('https://github.com/sponsors/ThanhNguyxn', '_blank');
                    break;
            }
        });
    }

    /**
     * Show notification
     */
    function showNotification(message) {
        const notif = document.createElement('div');
        notif.className = 'quillunlocker-notif';
        notif.textContent = `✨ ${message}`;
        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.animation = 'quSlideIn 0.3s ease reverse';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    /**
     * Handle messages from extension
     */
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'quillunlocker-toggle') {
            settings.enabled = e.data.enabled;
        }
    });

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+P - Quick paraphrase
        if (e.ctrlKey && e.shiftKey && e.key === 'P') {
            e.preventDefault();
            const selection = window.getSelection().toString();
            if (selection) {
                const encoded = encodeURIComponent(selection);
                window.open(`https://quillbot.com/paraphraser?text=${encoded}`, '_blank');
            }
        }
    });

    /**
     * Initialize
     */
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                injectStyles();
                addUI();
            });
        } else {
            injectStyles();
            addUI();
        }

        loadSettings();

        console.log(
            '%c[QuillUnlocker]%c Premium unlocked! ✨',
            'background: #00d4aa; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
            'color: inherit;'
        );

        showNotification('Premium features activated!');
    }

    init();

})();
