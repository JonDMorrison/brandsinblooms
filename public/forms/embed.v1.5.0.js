/**
 * BloomSuite Forms Embed Script v1.5.0
 *
 * Features:
 * - No iframe (inline rendering)
 * - Scoped CSS with bs-form- prefix (external CSS file)
 * - CSP-friendly: no 'unsafe-inline' required for styles
 * - Fallback mode for strict CSP environments
 * - Multiple forms per page
 * - Graceful ad-blocker fallback
 * - NEVER pre-checks consent checkboxes
 * - Zero external dependencies
 * - Display modes: inline, modal, slide-in
 * - Display triggers: delay, scroll depth, click selector
 * - MutationObserver for late-loaded containers
 * - Fail-loud UI with diagnostic debug mode
 * - Supabase Storage hosting support
 *
 * Browser Support: Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
 */
(function (window, document) {
  'use strict';

  // ─── Configuration ───────────────────────────────────────────────────────
  var API_BASE = window.BLOOMSUITE_API_BASE || 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1';
  var SCRIPT_VERSION = '1.5.0';
  var INIT_TIMEOUT_MS = 10000;
  var CSS_PREFIX = 'bs-form-';
  var INITIALIZED_ATTR = 'data-bs-initialized';

  // Supported display modes
  var DISPLAY_MODES = {
    INLINE: 'inline',
    MODAL: 'modal',
    SLIDE_IN: 'slide-in'
  };

  // Supported trigger types
  var TRIGGER_TYPES = {
    MANUAL: 'manual',      // Click trigger button (default)
    DELAY: 'delay',        // Show after X milliseconds
    SCROLL: 'scroll',      // Show at X% scroll depth
    CLICK: 'click'         // Show when clicking a selector (modal only)
  };

  // Detect script base URL for loading CSS from same origin
  // Handles: lovableproject.com, supabase.co/storage, cdn.bloomsuite.app, etc.
  var SCRIPT_BASE = (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || '';
      // Match any embed script URL pattern
      if (src.indexOf('/forms/embed') !== -1 || 
          (src.indexOf('embed') !== -1 && (
            src.indexOf('bloomsuite') !== -1 ||
            src.indexOf('supabase.co/storage') !== -1
          ))) {
        // Handle Supabase Storage URLs: .../assets/forms/embed.v1.js
        // Handle standard URLs: .../forms/embed.v1.js
        // Extract base path up to and including /forms/
        var match = src.match(/^(.*\/forms\/)/);
        if (match) {
          return match[1];
        }
        // Fallback: strip embed*.js filename
        return src.replace(/embed[^/]*\.js.*$/, '');
      }
    }
    // Fallback: use current script
    try {
      var currentSrc = document.currentScript.src;
      var currentMatch = currentSrc.match(/^(.*\/forms\/)/);
      if (currentMatch) {
        return currentMatch[1];
      }
      return currentSrc.replace(/embed[^/]*\.js.*$/, '');
    } catch (e) {
      return '';
    }
  })();

  // CSS URL override - allows explicit CSS path when auto-detection fails
  var CSS_URL = window.BLOOMSUITE_CSS_URL || (SCRIPT_BASE + 'embed.css');

  // ─── Minimal Fallback CSS (for CSP-blocked environments) ─────────────────
  // These are absolute minimum styles for a usable form when external CSS fails
  var FALLBACK_STYLES = [
    '.' + CSS_PREFIX + 'container{font-family:sans-serif;line-height:1.5}',
    '.' + CSS_PREFIX + 'field{margin-bottom:1em}',
    '.' + CSS_PREFIX + 'label{display:block;margin-bottom:.25em;font-weight:bold}',
    '.' + CSS_PREFIX + 'input,.' + CSS_PREFIX + 'select{width:100%;padding:.5em;border:1px solid #ccc}',
    '.' + CSS_PREFIX + 'submit{padding:.75em 1.5em;background:#22C55E;color:#fff;border:none;cursor:pointer;width:100%}',
    '.' + CSS_PREFIX + 'checkbox-wrap{display:flex;gap:.5em;align-items:flex-start}',
    '.' + CSS_PREFIX + 'consent{padding:.75em;background:#f5f5f5;border:1px solid #ddd;margin-bottom:1em}',
    '.' + CSS_PREFIX + 'success{text-align:center;padding:2em;background:#f0fdf4;border:1px solid #bbf7d0}',
    '.' + CSS_PREFIX + 'loading{text-align:center;padding:2em;color:#666}',
    '.' + CSS_PREFIX + 'blocked{text-align:center;padding:1.5em;background:#fef2f2;border:1px solid #fecaca;color:#991b1b}',
    '.' + CSS_PREFIX + 'error-box{padding:1em;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b;font-size:14px}',
    '.' + CSS_PREFIX + 'error-box strong{display:block;margin-bottom:.5em}',
    '.' + CSS_PREFIX + 'error-box ul{margin:.5em 0 0;padding-left:1.25em}',
    '.' + CSS_PREFIX + 'error-msg{color:#dc2626;font-size:.875em;margin-top:.25em}',
    '.' + CSS_PREFIX + 'hp{position:absolute!important;left:-9999px!important;opacity:0!important;pointer-events:none!important;height:0!important}',
    '.' + CSS_PREFIX + 'debug-panel{margin-top:1em;padding:.75em;background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;font-family:monospace;font-size:12px}',
    '.' + CSS_PREFIX + 'debug-panel dt{font-weight:bold;color:#0369a1}',
    '.' + CSS_PREFIX + 'debug-panel dd{margin:0 0 .5em 0;color:#334155;word-break:break-all}',
    // Modal styles
    '.' + CSS_PREFIX + 'modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;visibility:hidden;transition:opacity 0.2s,visibility 0.2s}',
    '.' + CSS_PREFIX + 'modal-overlay.bs-form-open{opacity:1;visibility:visible}',
    '.' + CSS_PREFIX + 'modal-content{background:#fff;border-radius:8px;max-width:480px;width:90%;max-height:90vh;overflow-y:auto;position:relative;transform:scale(0.95);transition:transform 0.2s}',
    '.' + CSS_PREFIX + 'modal-overlay.bs-form-open .' + CSS_PREFIX + 'modal-content{transform:scale(1)}',
    '.' + CSS_PREFIX + 'modal-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border:none;background:transparent;cursor:pointer;font-size:24px;line-height:1;color:#666}',
    '.' + CSS_PREFIX + 'modal-close:hover{color:#333}',
    '.' + CSS_PREFIX + 'modal-body{padding:24px}',
    // Slide-in styles
    '.' + CSS_PREFIX + 'slidein-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:9999;opacity:0;visibility:hidden;transition:opacity 0.3s,visibility 0.3s}',
    '.' + CSS_PREFIX + 'slidein-overlay.bs-form-open{opacity:1;visibility:visible}',
    '.' + CSS_PREFIX + 'slidein-panel{position:fixed;top:0;right:0;bottom:0;width:400px;max-width:100%;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,0.15);transform:translateX(100%);transition:transform 0.3s ease;z-index:10000;overflow-y:auto}',
    '.' + CSS_PREFIX + 'slidein-overlay.bs-form-open .' + CSS_PREFIX + 'slidein-panel{transform:translateX(0)}',
    '.' + CSS_PREFIX + 'slidein-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #e5e5e5}',
    '.' + CSS_PREFIX + 'slidein-title{font-weight:600;font-size:18px;margin:0}',
    '.' + CSS_PREFIX + 'slidein-close{width:32px;height:32px;border:none;background:transparent;cursor:pointer;font-size:24px;color:#666}',
    '.' + CSS_PREFIX + 'slidein-close:hover{color:#333}',
    '.' + CSS_PREFIX + 'slidein-body{padding:20px}',
    // Trigger button styles
    '.' + CSS_PREFIX + 'trigger{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:#22C55E;color:#fff;border:none;border-radius:6px;font-size:16px;cursor:pointer;transition:background 0.2s}',
    '.' + CSS_PREFIX + 'trigger:hover{background:#16A34A}'
  ].join('\n');

  // Track CSS loading state
  var cssLoaded = false;
  var cssFailed = false;

  // Track active display mode instances
  var activeModals = {};

  // Track active triggers to prevent duplicates
  var activeTriggers = {};

  // Track MutationObserver instance
  var mutationObserver = null;

  // ─── Display Trigger Engine ──────────────────────────────────────────────

  /**
   * Parse trigger configuration from data attributes
   * Returns { type, value, selector } or null
   */
  function parseTriggerConfig(container) {
    var triggerType = container.getAttribute('data-trigger');
    if (!triggerType) return null;

    var config = { type: triggerType, fired: false };

    switch (triggerType) {
      case TRIGGER_TYPES.DELAY:
        // data-trigger="delay" data-delay="3000"
        config.value = parseInt(container.getAttribute('data-delay'), 10) || 3000;
        break;

      case TRIGGER_TYPES.SCROLL:
        // data-trigger="scroll" data-scroll-depth="50"
        config.value = parseInt(container.getAttribute('data-scroll-depth'), 10) || 50;
        break;

      case TRIGGER_TYPES.CLICK:
        // data-trigger="click" data-click-selector=".my-button"
        config.selector = container.getAttribute('data-click-selector') || null;
        if (!config.selector) {
          console.warn('[BloomSuite] Click trigger requires data-click-selector');
          return null;
        }
        break;

      default:
        return null;
    }

    return config;
  }

  /**
   * Setup delay trigger
   * Opens form after specified milliseconds
   */
  function setupDelayTrigger(triggerId, delayMs, openFn) {
    if (activeTriggers[triggerId]) return;

    activeTriggers[triggerId] = {
      type: 'delay',
      fired: false,
      cleanup: null
    };

    var timeoutId = setTimeout(function () {
      if (!activeTriggers[triggerId].fired) {
        activeTriggers[triggerId].fired = true;
        openFn();
      }
    }, delayMs);

    activeTriggers[triggerId].cleanup = function () {
      clearTimeout(timeoutId);
    };
  }

  /**
   * Setup scroll depth trigger
   * Opens form when user scrolls past X% of page
   */
  function setupScrollTrigger(triggerId, scrollPercent, openFn) {
    if (activeTriggers[triggerId]) return;

    activeTriggers[triggerId] = {
      type: 'scroll',
      fired: false,
      cleanup: null
    };

    var handler = function () {
      if (activeTriggers[triggerId].fired) return;

      // Calculate current scroll percentage
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      ) - window.innerHeight;

      if (docHeight <= 0) return; // Page too short

      var currentPercent = (scrollTop / docHeight) * 100;

      if (currentPercent >= scrollPercent) {
        activeTriggers[triggerId].fired = true;
        openFn();
      }
    };

    // Throttle scroll handler
    var throttled = throttle(handler, 100);
    window.addEventListener('scroll', throttled, { passive: true });

    activeTriggers[triggerId].cleanup = function () {
      window.removeEventListener('scroll', throttled);
    };

    // Check immediately in case page is already scrolled
    handler();
  }

  /**
   * Setup click selector trigger (modal only)
   * Opens form when user clicks matching element
   */
  function setupClickTrigger(triggerId, selector, openFn) {
    if (activeTriggers[triggerId]) return;

    activeTriggers[triggerId] = {
      type: 'click',
      fired: false,
      cleanup: null
    };

    var handler = function (e) {
      // Check if clicked element matches selector
      var target = e.target;
      while (target && target !== document) {
        if (target.matches && target.matches(selector)) {
          e.preventDefault();
          openFn();
          return;
        }
        target = target.parentElement;
      }
    };

    document.addEventListener('click', handler, true);

    activeTriggers[triggerId].cleanup = function () {
      document.removeEventListener('click', handler, true);
    };
  }

  /**
   * Cleanup a trigger
   */
  function cleanupTrigger(triggerId) {
    var trigger = activeTriggers[triggerId];
    if (trigger && trigger.cleanup) {
      trigger.cleanup();
    }
    delete activeTriggers[triggerId];
  }

  /**
   * Simple throttle function
   */
  function throttle(fn, wait) {
    var lastTime = 0;
    return function () {
      var now = Date.now();
      if (now - lastTime >= wait) {
        lastTime = now;
        fn.apply(this, arguments);
      }
    };
  }

  // ─── Accessibility Utilities ─────────────────────────────────────────────

  /**
   * Get all focusable elements within a container
   */
  function getFocusableElements(container) {
    var focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.prototype.slice.call(container.querySelectorAll(focusableSelectors));
  }

  /**
   * Check if an element is inside a specific container
   */
  function isElementInsideContainer(element, container) {
    var node = element;
    while (node) {
      if (node === container) return true;
      node = node.parentElement;
    }
    return false;
  }

  /**
   * Lock body scroll - iOS Safari safe
   * Uses position:fixed + scroll position tracking to prevent iOS bounce
   */
  var savedScrollPosition = 0;
  var scrollLockCount = 0;

  function lockBodyScroll() {
    if (scrollLockCount === 0) {
      savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + savedScrollPosition + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    }
    scrollLockCount++;
  }

  function unlockBodyScroll() {
    scrollLockCount--;
    if (scrollLockCount <= 0) {
      scrollLockCount = 0;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, savedScrollPosition);
    }
  }

  /**
   * Create a focus trap for modal/dialog accessibility
   * Returns cleanup function
   */
  function createFocusTrap(container, closeCallback) {
    var previousActiveElement = document.activeElement;
    var focusableElements = [];
    var firstFocusable = null;
    var lastFocusable = null;
    var containerMadeFocusable = false;

    function updateFocusableElements() {
      focusableElements = getFocusableElements(container);
      firstFocusable = focusableElements[0] || null;
      lastFocusable = focusableElements[focusableElements.length - 1] || null;
    }

    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;

      updateFocusableElements();

      // Fallback: if no focusable elements, trap on container
      if (focusableElements.length === 0) {
        e.preventDefault();
        if (containerMadeFocusable) {
          container.focus();
        }
        return;
      }

      if (e.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }

    // Set initial focus
    function setInitialFocus() {
      updateFocusableElements();
      // Try to focus the close button first, then first focusable
      var closeBtn = container.querySelector('[aria-label="Close form"]');
      if (closeBtn) {
        closeBtn.focus();
      } else if (firstFocusable) {
        firstFocusable.focus();
      } else {
        // Fallback: make container focusable temporarily
        container.setAttribute('tabindex', '-1');
        containerMadeFocusable = true;
        container.focus();
      }
    }

    // Delay initial focus to allow form to render
    setTimeout(setInitialFocus, 100);

    container.addEventListener('keydown', handleKeyDown);

    // Return cleanup function
    return function cleanup() {
      container.removeEventListener('keydown', handleKeyDown);

      // Remove temporary tabindex if we added it
      if (containerMadeFocusable) {
        container.removeAttribute('tabindex');
      }

      // Restore focus to previous element (the trigger)
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        try {
          // Check if element is still in DOM
          if (document.contains(previousActiveElement)) {
            previousActiveElement.focus();
          }
        } catch (e) {
          // Element may no longer be focusable
        }
      }
    };
  }

  /**
   * Announce message to screen readers (debounced to prevent double-announce)
   */
  var lastAnnouncement = '';
  var lastAnnouncementTime = 0;

  function announceToScreenReader(message) {
    // Debounce: skip if same message within 500ms
    var now = Date.now();
    if (message === lastAnnouncement && (now - lastAnnouncementTime) < 500) {
      return;
    }
    lastAnnouncement = message;
    lastAnnouncementTime = now;

    var announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = CSS_PREFIX + 'sr-only';
    announcement.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(function () {
      if (announcement.parentNode) {
        announcement.remove();
      }
    }, 1000);
  }

  // ─── Utility Functions ───────────────────────────────────────────────────

  /**
   * Get URL query parameter
   */
  function getParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name) || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Darken a hex color
   */
  function darkenColor(hex, percent) {
    if (!hex || hex.charAt(0) !== '#') return hex;
    try {
      var num = parseInt(hex.slice(1), 16);
      var r = Math.max(0, (num >> 16) + percent);
      var g = Math.max(0, ((num >> 8) & 0x00FF) + percent);
      var b = Math.max(0, (num & 0x0000FF) + percent);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch (e) {
      return hex;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Create element with class
   */
  function createElement(tag, className, attrs) {
    var el = document.createElement(tag);
    if (className) el.className = CSS_PREFIX + className;
    if (attrs) {
      for (var key in attrs) {
        if (attrs.hasOwnProperty(key)) {
          el.setAttribute(key, attrs[key]);
        }
      }
    }
    return el;
  }

  /**
   * Generate unique ID
   */
  function generateId() {
    return 'bs-' + Math.random().toString(36).substr(2, 9);
  }

  // ─── Style Loading (External CSS with inline fallback) ───────────────────

  /**
   * Load external CSS file from same origin as embed.js
   * Falls back to minimal inline styles if blocked by CSP
   */
  function loadStyles(callback) {
    if (document.getElementById(CSS_PREFIX + 'styles')) {
      callback(true);
      return;
    }

    // Use explicit CSS_URL (supports Supabase Storage, CDN, or custom paths)
    var link = document.createElement('link');
    link.id = CSS_PREFIX + 'styles';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = CSS_URL;

    var timeout = setTimeout(function () {
      // CSS load timeout - fall back to inline
      if (!cssLoaded) {
        cssFailed = true;
        injectFallbackStyles();
        callback(false);
      }
    }, 3000);

    link.onload = function () {
      clearTimeout(timeout);
      cssLoaded = true;
      callback(true);
    };

    link.onerror = function () {
      clearTimeout(timeout);
      cssFailed = true;
      injectFallbackStyles();
      callback(false);
    };

    (document.head || document.documentElement).appendChild(link);
  }

  /**
   * Inject minimal fallback styles (only used if external CSS fails)
   * Uses <style> tag - may be blocked by strict CSP, but form remains usable
   */
  function injectFallbackStyles() {
    if (document.getElementById(CSS_PREFIX + 'fallback-styles')) return;

    try {
      var style = document.createElement('style');
      style.id = CSS_PREFIX + 'fallback-styles';
      style.textContent = FALLBACK_STYLES;
      (document.head || document.documentElement).appendChild(style);
    } catch (e) {
      // CSP blocked inline styles - form will still work with browser defaults
      console.warn('[BloomSuite] Inline styles blocked by CSP. Form will render with default browser styles.');
    }
  }

  /**
   * Legacy function for backward compatibility
   */
  function injectStyles() {
    loadStyles(function () { });
  }

  // ─── API Functions ───────────────────────────────────────────────────────

  /**
   * Fetch form configuration
   * Returns additional diagnostic info for debug mode
   */
  function fetchConfig(embedKey, callback) {
    var url = API_BASE + '/get-form-config?embed_key=' + encodeURIComponent(embedKey);
    var diagnostics = {
      url: url,
      status: null,
      error: null,
      blocked: false
    };

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = INIT_TIMEOUT_MS;

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      diagnostics.status = xhr.status;

      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          callback(null, data, diagnostics);
        } catch (e) {
          diagnostics.error = 'Invalid JSON response';
          callback(new Error('Invalid response'), null, diagnostics);
        }
      } else if (xhr.status === 0) {
        // Network error or blocked
        diagnostics.blocked = true;
        diagnostics.error = 'Request blocked (status 0)';
        callback(new Error('BLOCKED'), null, diagnostics);
      } else if (xhr.status === 404) {
        diagnostics.error = 'Form not found or not published';
        callback(new Error('NOT_FOUND'), null, diagnostics);
      } else {
        diagnostics.error = 'HTTP ' + xhr.status;
        callback(new Error('Form not found'), null, diagnostics);
      }
    };

    xhr.onerror = function () {
      diagnostics.blocked = true;
      diagnostics.error = 'Network error (possibly blocked)';
      callback(new Error('BLOCKED'), null, diagnostics);
    };

    xhr.ontimeout = function () {
      diagnostics.error = 'Request timeout (' + INIT_TIMEOUT_MS + 'ms)';
      callback(new Error('Timeout'), null, diagnostics);
    };

    try {
      xhr.send();
    } catch (e) {
      diagnostics.blocked = true;
      diagnostics.error = 'Send failed: ' + e.message;
      callback(new Error('BLOCKED'), null, diagnostics);
    }
  }

  /**
   * Submit form data
   * NOTE: This is the ONLY submission path. Display modes never duplicate this.
   */
  function submitData(embedKey, formData, meta, callback) {
    var url = API_BASE + '/submit-form';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 30000;

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      try {
        var data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          callback(null, data);
        } else {
          callback(new Error(data.error || 'Submission failed'));
        }
      } catch (e) {
        callback(new Error('Submission failed'));
      }
    };

    xhr.onerror = function () {
      callback(new Error('Network error'));
    };

    xhr.ontimeout = function () {
      callback(new Error('Request timeout'));
    };

    var payload = {
      embed_key: embedKey,
      data: formData,
      meta: meta
    };

    xhr.send(JSON.stringify(payload));
  }

  // ─── Error UI Rendering ──────────────────────────────────────────────────

  /**
   * Render comprehensive error box with troubleshooting tips
   */
  function renderErrorBox(container, errorType, diagnostics, embedKey) {
    var errorBox = createElement('div', 'error-box');
    var title = '';
    var hints = [];

    switch (errorType) {
      case 'BLOCKED':
        title = 'Form Could Not Load';
        hints = [
          'Check if an <strong>ad blocker</strong> or privacy extension is blocking the request',
          'Verify your site\'s <strong>Content Security Policy (CSP)</strong> allows connections to <code>' + escapeHtml(API_BASE.replace('https://', '')) + '</code>',
          'If using a firewall or proxy, ensure API requests are permitted'
        ];
        break;

      case 'NOT_FOUND':
        title = 'Form Not Available';
        hints = [
          'The <strong>embed key</strong> may be invalid or the form is not published',
          'Verify the form exists in your BloomSuite dashboard',
          'Check that the form status is set to <strong>Published</strong>'
        ];
        break;

      case 'INVALID_KEY':
        title = 'Invalid Form Configuration';
        hints = [
          'The embed key format is incorrect',
          'Copy the embed code again from BloomSuite dashboard',
          'Ensure the <code>data-bloomsuite-form</code> attribute contains a valid 32-character key'
        ];
        break;

      case 'TIMEOUT':
        title = 'Connection Timed Out';
        hints = [
          'Check your internet connection',
          'The API server may be temporarily unavailable',
          'Try refreshing the page'
        ];
        break;

      case 'EARLY_LOAD':
        title = 'Script Loaded Too Early';
        hints = [
          'Change the script tag from <code>async</code> to <code>defer</code>',
          'Or add <code>BloomSuiteForms.init()</code> after your page content',
          'This ensures the form container exists before initialization'
        ];
        break;

      default:
        title = 'Form Load Error';
        hints = [
          'An unexpected error occurred',
          'Try refreshing the page',
          'Contact support if the problem persists'
        ];
    }

    var html = '<strong>' + escapeHtml(title) + '</strong>';
    html += '<ul>';
    for (var i = 0; i < hints.length; i++) {
      html += '<li>' + hints[i] + '</li>';
    }
    html += '</ul>';

    errorBox.innerHTML = html;

    // Add debug panel if enabled
    if (container.getAttribute('data-debug') === 'true') {
      var debugPanel = renderDebugPanel(diagnostics, embedKey);
      errorBox.appendChild(debugPanel);
    }

    container.innerHTML = '';
    container.appendChild(errorBox);
  }

  /**
   * Render debug panel with diagnostic information
   */
  function renderDebugPanel(diagnostics, embedKey) {
    var panel = createElement('div', 'debug-panel');

    var dl = document.createElement('dl');
    dl.style.margin = '0';

    var items = [
      ['Version', SCRIPT_VERSION],
      ['API Base', API_BASE],
      ['Embed Key', embedKey ? (embedKey.substring(0, 8) + '...') : '(missing)'],
      ['Config URL', diagnostics && diagnostics.url ? diagnostics.url : '(not fetched)'],
      ['Status', diagnostics && diagnostics.status !== null ? String(diagnostics.status) : 'N/A'],
      ['Blocked', diagnostics && diagnostics.blocked ? 'Yes' : 'No'],
      ['Error', diagnostics && diagnostics.error ? diagnostics.error : 'None']
    ];

    for (var i = 0; i < items.length; i++) {
      var dt = document.createElement('dt');
      dt.textContent = items[i][0];
      var dd = document.createElement('dd');
      dd.textContent = items[i][1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    }

    panel.appendChild(dl);
    return panel;
  }

  /**
   * Render loading state (shown immediately before network call)
   */
  function renderLoadingState(container) {
    container.innerHTML =
      '<div class="' + CSS_PREFIX + 'loading">' +
      '<div class="' + CSS_PREFIX + 'spinner"></div>' +
      '<div>Loading BloomSuite form…</div>' +
      '</div>';
  }

  // ─── Field Rendering ─────────────────────────────────────────────────────

  /**
   * Render a single form field
   */
  function renderField(field, compliance) {
    var wrapper = createElement('div', 'field');
    var fieldId = CSS_PREFIX + 'f-' + field.id;

    // Hidden field
    if (field.type === 'hidden') {
      var hidden = createElement('input', null, {
        type: 'hidden',
        name: field.id,
        value: field.default_value || ''
      });
      wrapper.appendChild(hidden);
      return wrapper;
    }

    // Consent checkboxes (email_consent / sms_consent)
    // CRITICAL: Never pre-checked
    if (field.type === 'email_consent' || field.type === 'sms_consent') {
      wrapper.className = CSS_PREFIX + 'field ' + CSS_PREFIX + 'consent';

      var checkWrap = createElement('div', 'checkbox-wrap');

      var checkbox = createElement('input', 'checkbox', {
        type: 'checkbox',
        id: fieldId,
        name: field.id
      });
      // NEVER pre-check consent checkboxes (CASL/TCPA requirement)
      checkbox.checked = false;
      if (field.required) checkbox.required = true;

      var labelText = createElement('label', 'checkbox-text', { for: fieldId });
      labelText.innerHTML = escapeHtml(field.label);
      if (field.required) {
        labelText.innerHTML += ' <span class="' + CSS_PREFIX + 'required">*</span>';
      }

      checkWrap.appendChild(checkbox);
      checkWrap.appendChild(labelText);
      wrapper.appendChild(checkWrap);
      return wrapper;
    }

    // Regular checkbox
    if (field.type === 'checkbox') {
      var checkWrap2 = createElement('div', 'checkbox-wrap');

      var checkbox2 = createElement('input', 'checkbox', {
        type: 'checkbox',
        id: fieldId,
        name: field.id
      });
      checkbox2.checked = false; // Never pre-checked

      var labelText2 = createElement('label', 'checkbox-text', { for: fieldId });
      labelText2.textContent = field.label;

      checkWrap2.appendChild(checkbox2);
      checkWrap2.appendChild(labelText2);
      wrapper.appendChild(checkWrap2);
      return wrapper;
    }

    // Label for text inputs
    var label = createElement('label', 'label', { for: fieldId });
    label.innerHTML = escapeHtml(field.label);
    if (field.required) {
      label.innerHTML += ' <span class="' + CSS_PREFIX + 'required">*</span>';
    }
    wrapper.appendChild(label);

    // Select dropdown
    if (field.type === 'select') {
      var select = createElement('select', 'select', {
        id: fieldId,
        name: field.id
      });
      if (field.required) select.required = true;

      var defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = field.placeholder || 'Select an option';
      select.appendChild(defaultOpt);

      (field.options || []).forEach(function (opt) {
        var option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
      });

      wrapper.appendChild(select);
      return wrapper;
    }

    // Text/email/phone input
    var input = createElement('input', 'input', {
      id: fieldId,
      name: field.id,
      placeholder: field.placeholder || ''
    });

    if (field.required) input.required = true;

    switch (field.type) {
      case 'email':
        input.type = 'email';
        input.autocomplete = 'email';
        break;
      case 'phone':
        input.type = 'tel';
        input.autocomplete = 'tel';
        break;
      default:
        input.type = 'text';
    }

    wrapper.appendChild(input);
    return wrapper;
  }

  // ─── Form Rendering ──────────────────────────────────────────────────────

  /**
   * Render the complete form into a target element
   * This is the CORE form logic - display modes wrap this, never modify it.
   */
  function renderForm(container, config, embedKey) {
    var fields = config.fields_json || [];
    var settings = config.settings_json || {};
    var compliance = config.compliance_json || {};
    var theme = settings.theme || {};

    // Create container
    var formContainer = createElement('div', 'container');

    // Apply theme CSS variables
    var primaryColor = theme.primary_color || '#22C55E';
    formContainer.style.setProperty('--bs-form-primary', primaryColor);
    formContainer.style.setProperty('--bs-form-primary-hover', darkenColor(primaryColor, -20));
    formContainer.style.setProperty('--bs-form-radius', theme.border_radius || '8px');

    // Create form element
    var formEl = createElement('form', 'wrapper');
    formEl.setAttribute('novalidate', 'true');
    formEl.setAttribute('autocomplete', 'on');

    // Honeypot field (spam trap)
    var honeypot = createElement('div', 'hp');
    honeypot.setAttribute('aria-hidden', 'true');
    honeypot.innerHTML = '<input type="text" name="_hp_website" tabindex="-1" autocomplete="off">';
    formEl.appendChild(honeypot);

    // Headline and subheadline (fall back to form_title/form_description)
    var _headlineText = settings.form_headline || settings.form_title || '';
    var _subheadlineText = settings.form_subheadline || settings.form_description || '';
    if (_headlineText || _subheadlineText) {
      var headerBlock = createElement('div', 'header');
      headerBlock.style.textAlign = 'center';
      headerBlock.style.marginBottom = '16px';

      if (_headlineText) {
        var headlineEl = document.createElement('h2');
        headlineEl.className = CSS_PREFIX + 'headline';
        headlineEl.textContent = _headlineText;
        headlineEl.style.cssText = 'font-size:1.5rem;font-weight:600;line-height:1.3;margin:0 0 4px;color:' + (theme.text_color || '#1f2937');
        if (theme.font_family && theme.font_family !== 'inherit') {
          headlineEl.style.fontFamily = theme.font_family;
        }
        headerBlock.appendChild(headlineEl);
      }

      if (_subheadlineText) {
        var subheadlineEl = document.createElement('p');
        subheadlineEl.className = CSS_PREFIX + 'subheadline';
        subheadlineEl.textContent = _subheadlineText;
        subheadlineEl.style.cssText = 'font-size:1.125rem;line-height:1.75;margin:0;color:#6b7280';
        if (theme.font_family && theme.font_family !== 'inherit') {
          subheadlineEl.style.fontFamily = theme.font_family;
        }
        headerBlock.appendChild(subheadlineEl);
      }

      formEl.appendChild(headerBlock);
    }

    // Render each field
    fields.forEach(function (field) {
      formEl.appendChild(renderField(field, compliance));
    });

    // Submit button
    var submitBtn = createElement('button', 'submit', { type: 'submit' });
    submitBtn.textContent = settings.submit_button_text || 'Submit';

    // Button style variants
    if (theme.button_style === 'outline') {
      submitBtn.className += ' ' + CSS_PREFIX + 'submit-outline';
    } else if (theme.button_style === 'rounded') {
      submitBtn.className += ' ' + CSS_PREFIX + 'submit-rounded';
    }

    // Auto-width centered button
    submitBtn.style.width = 'auto';
    submitBtn.style.display = 'inline-block';
    submitBtn.style.padding = '12px 32px';
    var submitWrap = document.createElement('div');
    submitWrap.style.textAlign = 'center';
    submitWrap.appendChild(submitBtn);
    formEl.appendChild(submitWrap);

    // Branding
    if (settings.show_branding !== false) {
      var branding = createElement('div', 'branding');
      branding.innerHTML = 'Powered by <a href="https://bloomsuite.com" target="_blank" rel="noopener noreferrer">BloomSuite</a>';
      formEl.appendChild(branding);
    }

    // Form submission handler - SINGLE PATH, never duplicated
    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      handleSubmit(formEl, container, embedKey, settings, compliance);
    });

    formContainer.appendChild(formEl);

    // Replace container content
    container.innerHTML = '';
    container.appendChild(formContainer);
  }

  /**
   * Handle form submission
   * NOTE: This is the ONLY submission handler. Display modes never duplicate this.
   */
  function handleSubmit(formEl, container, embedKey, settings, compliance) {
    var submitBtn = formEl.querySelector('.' + CSS_PREFIX + 'submit');
    var originalText = submitBtn.textContent;

    // Collect form data
    var formData = {};
    var inputs = formEl.querySelectorAll('input, select');

    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var name = input.name;
      if (!name || name.charAt(0) === '_') continue; // Skip honeypot

      if (input.type === 'checkbox') {
        formData[name] = input.checked;
      } else {
        formData[name] = input.value;
      }
    }

    // Include honeypot value (empty = human, filled = bot)
    var hpInput = formEl.querySelector('input[name="_hp_website"]');
    if (hpInput && hpInput.value) {
      formData._honeypot = hpInput.value;
    }

    // Collect metadata
    var meta = {
      page_url: window.location.href,
      referrer: document.referrer || null,
      utm_source: getParam('utm_source'),
      utm_medium: getParam('utm_medium'),
      utm_campaign: getParam('utm_campaign'),
      user_agent: navigator.userAgent
    };

    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    // Clear previous errors
    var existingError = formEl.querySelector('.' + CSS_PREFIX + 'error-msg');
    if (existingError) existingError.remove();

    // Submit - SINGLE SUBMISSION PATH
    submitData(embedKey, formData, meta, function (err, result) {
      if (err) {
        // Show error
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        var errorDiv = createElement('div', 'error-msg');
        errorDiv.textContent = err.message || 'Submission failed. Please try again.';
        submitBtn.parentNode.insertBefore(errorDiv, submitBtn);
        return;
      }

      // Success - show message or redirect
      if (result.redirect_url) {
        window.location.href = result.redirect_url;
        return;
      }

      // Show success message
      var successDiv = createElement('div', 'success');
      successDiv.innerHTML =
        '<div class="' + CSS_PREFIX + 'success-icon">' +
        '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M5 13l4 4L19 7"></path>' +
        '</svg>' +
        '</div>' +
        '<p class="' + CSS_PREFIX + 'success-text">' + escapeHtml(result.message || settings.success_message || 'Thank you!') + '</p>';

      container.innerHTML = '';
      container.appendChild(successDiv);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPLAY MODE WRAPPERS
  // These are presentation-only wrappers. They NEVER modify form or submit logic.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create modal wrapper
   * The modal is a presentation container - form rendering happens inside it unchanged
   */
  function createModalWrapper(embedKey, options) {
    var modalId = generateId();
    options = options || {};

    // Create overlay with explicit high z-index for host isolation
    var overlay = createElement('div', 'modal-overlay');
    overlay.id = modalId;
    overlay.style.zIndex = '2147483640'; // Near max 32-bit int for isolation
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', modalId + '-title');
    overlay.setAttribute('aria-describedby', modalId + '-desc');

    // Create modal content
    var content = createElement('div', 'modal-content');
    content.setAttribute('role', 'document');

    // Accessible title (visually hidden if no title provided)
    var titleEl = createElement('h2', 'modal-title');
    titleEl.id = modalId + '-title';
    titleEl.textContent = options.title || 'Form';
    if (!options.title) {
      titleEl.className += ' ' + CSS_PREFIX + 'sr-only';
    }

    // Description for screen readers
    var descEl = createElement('p', 'sr-only');
    descEl.id = modalId + '-desc';
    descEl.textContent = 'Press Escape to close this dialog';

    // Close button - MUST be keyboard accessible and visible
    var closeBtn = createElement('button', 'modal-close', {
      type: 'button',
      'aria-label': 'Close form'
    });
    closeBtn.innerHTML = '<span aria-hidden="true">&times;</span>';
    closeBtn.addEventListener('click', function () {
      closeModal(modalId);
    });

    // Modal body - this is where the form renders (unchanged)
    var body = createElement('div', 'modal-body');
    body.setAttribute('data-bloomsuite-form', embedKey);

    content.appendChild(titleEl);
    content.appendChild(descEl);
    content.appendChild(closeBtn);
    content.appendChild(body);
    overlay.appendChild(content);

    // Close on overlay click (but not on content click)
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeModal(modalId);
      }
    });

    // Close on Escape key - ONLY when modal is open AND focus is inside
    var escHandler = function (e) {
      if (e.key === 'Escape') {
        // Check modal is open
        if (!overlay.classList.contains(CSS_PREFIX + 'open')) return;

        // Check focus is inside the modal OR on body (focus lost)
        var activeEl = document.activeElement;
        var focusInside = isElementInsideContainer(activeEl, overlay);
        var focusOnBody = activeEl === document.body || activeEl === document.documentElement;

        if (focusInside || focusOnBody) {
          e.preventDefault();
          e.stopPropagation();
          closeModal(modalId);
        }
      }
    };
    document.addEventListener('keydown', escHandler, true); // Use capture to fire first

    // Append to body
    document.body.appendChild(overlay);

    // Store reference (focusTrapCleanup added on open)
    activeModals[modalId] = {
      overlay: overlay,
      content: content,
      body: body,
      closeBtn: closeBtn,
      embedKey: embedKey,
      escHandler: escHandler,
      focusTrapCleanup: null,
      type: 'modal'
    };

    return modalId;
  }

  /**
   * Open modal and initialize form inside it
   * Activates focus trap for accessibility
   */
  function openModal(modalId) {
    var modal = activeModals[modalId];
    if (!modal) return;

    // Show overlay with iOS-safe scroll lock
    modal.overlay.classList.add(CSS_PREFIX + 'open');
    lockBodyScroll();

    // Announce to screen readers
    announceToScreenReader('Form dialog opened. Press Escape to close.');

    // Initialize form inside modal body (uses existing renderForm)
    initForm(modal.body);

    // Setup focus trap after form renders
    setTimeout(function () {
      modal.focusTrapCleanup = createFocusTrap(modal.content, function () {
        closeModal(modalId);
      });
    }, 150);
  }

  /**
   * Close modal and cleanup focus trap
   */
  function closeModal(modalId) {
    var modal = activeModals[modalId];
    if (!modal) return;

    // Cleanup focus trap (restores previous focus)
    if (modal.focusTrapCleanup) {
      modal.focusTrapCleanup();
      modal.focusTrapCleanup = null;
    }

    modal.overlay.classList.remove(CSS_PREFIX + 'open');
    unlockBodyScroll();

    // Announce to screen readers
    announceToScreenReader('Form dialog closed.');
  }

  /**
   * Destroy modal and cleanup all handlers
   */
  function destroyModal(modalId) {
    var modal = activeModals[modalId];
    if (!modal) return;

    // Cleanup focus trap
    if (modal.focusTrapCleanup) {
      modal.focusTrapCleanup();
    }

    // Remove ESC handler with capture to match addEventListener
    document.removeEventListener('keydown', modal.escHandler, true);
    modal.overlay.remove();
    delete activeModals[modalId];
  }

  /**
   * Create slide-in panel wrapper
   * The panel is a presentation container - form rendering happens inside it unchanged
   */
  function createSlideInWrapper(embedKey, options) {
    var panelId = generateId();
    options = options || {};

    // Create overlay with explicit high z-index for host isolation
    var overlay = createElement('div', 'slidein-overlay');
    overlay.id = panelId;
    overlay.style.zIndex = '2147483640'; // Near max 32-bit int for isolation

    // Create panel
    var panel = createElement('div', 'slidein-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', panelId + '-title');
    panel.setAttribute('aria-describedby', panelId + '-desc');
    panel.style.zIndex = '2147483641'; // Above overlay

    // Header
    var header = createElement('div', 'slidein-header');

    var title = createElement('h2', 'slidein-title');
    title.textContent = options.title || 'Get in Touch';
    title.id = panelId + '-title';

    // Description for screen readers
    var descEl = createElement('p', 'sr-only');
    descEl.id = panelId + '-desc';
    descEl.textContent = 'Press Escape to close this panel';

    // Close button - MUST be keyboard accessible
    var closeBtn = createElement('button', 'slidein-close', {
      type: 'button',
      'aria-label': 'Close form'
    });
    closeBtn.innerHTML = '<span aria-hidden="true">&times;</span>';
    closeBtn.addEventListener('click', function () {
      closeSlideIn(panelId);
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Body - this is where the form renders (unchanged)
    var body = createElement('div', 'slidein-body');
    body.setAttribute('data-bloomsuite-form', embedKey);

    panel.appendChild(header);
    panel.appendChild(descEl);
    panel.appendChild(body);
    overlay.appendChild(panel);

    // Close on overlay click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeSlideIn(panelId);
      }
    });

    // Close on Escape key - ONLY when panel is open AND focus is inside
    var escHandler = function (e) {
      if (e.key === 'Escape') {
        // Check panel is open
        if (!overlay.classList.contains(CSS_PREFIX + 'open')) return;

        // Check focus is inside the panel OR on body (focus lost)
        var activeEl = document.activeElement;
        var focusInside = isElementInsideContainer(activeEl, panel);
        var focusOnBody = activeEl === document.body || activeEl === document.documentElement;

        if (focusInside || focusOnBody) {
          e.preventDefault();
          e.stopPropagation();
          closeSlideIn(panelId);
        }
      }
    };
    document.addEventListener('keydown', escHandler, true); // Use capture to fire first

    // Append to body
    document.body.appendChild(overlay);

    // Store reference
    activeModals[panelId] = {
      overlay: overlay,
      panel: panel,
      body: body,
      closeBtn: closeBtn,
      embedKey: embedKey,
      escHandler: escHandler,
      focusTrapCleanup: null,
      type: 'slidein'
    };

    return panelId;
  }

  /**
   * Open slide-in panel and initialize form inside it
   * Activates focus trap for accessibility
   */
  function openSlideIn(panelId) {
    var panelData = activeModals[panelId];
    if (!panelData) return;

    // Show overlay with iOS-safe scroll lock
    panelData.overlay.classList.add(CSS_PREFIX + 'open');
    lockBodyScroll();

    // Announce to screen readers
    announceToScreenReader('Form panel opened. Press Escape to close.');

    // Initialize form inside panel body (uses existing renderForm)
    initForm(panelData.body);

    // Setup focus trap after form renders
    setTimeout(function () {
      panelData.focusTrapCleanup = createFocusTrap(panelData.panel, function () {
        closeSlideIn(panelId);
      });
    }, 150);
  }

  /**
   * Close slide-in panel and cleanup focus trap
   */
  function closeSlideIn(panelId) {
    var panelData = activeModals[panelId];
    if (!panelData) return;

    // Cleanup focus trap (restores previous focus)
    if (panelData.focusTrapCleanup) {
      panelData.focusTrapCleanup();
      panelData.focusTrapCleanup = null;
    }

    panelData.overlay.classList.remove(CSS_PREFIX + 'open');
    unlockBodyScroll();

    // Announce to screen readers
    announceToScreenReader('Form panel closed.');
  }

  /**
   * Create trigger button for modal or slide-in
   */
  function createTriggerButton(embedKey, options) {
    options = options || {};
    var mode = options.mode || DISPLAY_MODES.MODAL;
    var buttonText = options.buttonText || 'Open Form';
    var wrapperId = null;

    // Create wrapper based on mode
    if (mode === DISPLAY_MODES.MODAL) {
      wrapperId = createModalWrapper(embedKey, options);
    } else if (mode === DISPLAY_MODES.SLIDE_IN) {
      wrapperId = createSlideInWrapper(embedKey, options);
    }

    // Create trigger button
    var button = createElement('button', 'trigger', { type: 'button' });
    button.textContent = buttonText;

    button.addEventListener('click', function () {
      if (mode === DISPLAY_MODES.MODAL) {
        openModal(wrapperId);
      } else if (mode === DISPLAY_MODES.SLIDE_IN) {
        openSlideIn(wrapperId);
      }
    });

    return {
      button: button,
      wrapperId: wrapperId,
      open: function () {
        if (mode === DISPLAY_MODES.MODAL) openModal(wrapperId);
        else if (mode === DISPLAY_MODES.SLIDE_IN) openSlideIn(wrapperId);
      },
      close: function () {
        if (mode === DISPLAY_MODES.MODAL) closeModal(wrapperId);
        else if (mode === DISPLAY_MODES.SLIDE_IN) closeSlideIn(wrapperId);
      },
      destroy: function () {
        destroyModal(wrapperId);
      }
    };
  }

  // ─── Initialization ──────────────────────────────────────────────────────

  /**
   * Initialize a single form container
   * Reads display mode and trigger from data attributes
   * IDEMPOTENT: Checks for data-bs-initialized marker
   */
  function initForm(container) {
    // Skip if already initialized (idempotency check)
    if (container.getAttribute(INITIALIZED_ATTR) === 'true') {
      return;
    }

    var embedKey = container.getAttribute('data-bloomsuite-form');
    if (!embedKey) return;

    // Mark as initialized immediately to prevent double-init
    container.setAttribute(INITIALIZED_ATTR, 'true');

    // Get display mode (default: inline)
    var displayMode = container.getAttribute('data-display-mode') || DISPLAY_MODES.INLINE;

    // Validate embed key format (32 hex chars)
    if (!/^[a-f0-9]{32}$/i.test(embedKey)) {
      renderErrorBox(container, 'INVALID_KEY', null, embedKey);
      return;
    }

    // For non-inline modes, handle triggers
    if (displayMode === DISPLAY_MODES.MODAL || displayMode === DISPLAY_MODES.SLIDE_IN) {
      var buttonText = container.getAttribute('data-button-text') || 'Open Form';
      var title = container.getAttribute('data-form-title') || 'Get in Touch';
      var triggerId = generateId();

      // Parse trigger configuration
      var triggerConfig = parseTriggerConfig(container);

      // Create the modal/slide-in wrapper
      var wrapperId;
      var openFn;

      if (displayMode === DISPLAY_MODES.MODAL) {
        wrapperId = createModalWrapper(embedKey, { title: title });
        openFn = function () { openModal(wrapperId); };
      } else {
        wrapperId = createSlideInWrapper(embedKey, { title: title });
        openFn = function () { openSlideIn(wrapperId); };
      }

      // If automatic trigger is configured, set it up
      if (triggerConfig) {
        // Hide the container (no button needed for automatic triggers)
        container.style.display = 'none';

        switch (triggerConfig.type) {
          case TRIGGER_TYPES.DELAY:
            setupDelayTrigger(triggerId, triggerConfig.value, openFn);
            break;

          case TRIGGER_TYPES.SCROLL:
            setupScrollTrigger(triggerId, triggerConfig.value, openFn);
            break;

          case TRIGGER_TYPES.CLICK:
            // Click trigger only works with modal
            if (displayMode !== DISPLAY_MODES.MODAL) {
              console.warn('[BloomSuite] Click trigger only supported for modal mode');
            } else {
              setupClickTrigger(triggerId, triggerConfig.selector, openFn);
            }
            break;
        }

        // Store trigger reference
        container._bsTrigger = {
          triggerId: triggerId,
          wrapperId: wrapperId,
          open: openFn,
          close: function () {
            if (displayMode === DISPLAY_MODES.MODAL) closeModal(wrapperId);
            else closeSlideIn(wrapperId);
          },
          destroy: function () {
            cleanupTrigger(triggerId);
            destroyModal(wrapperId);
          }
        };

        return;
      }

      // MANUAL TRIGGER: Create button
      var trigger = createTriggerButton(embedKey, {
        mode: displayMode,
        buttonText: buttonText,
        title: title
      });

      container.innerHTML = '';
      container.appendChild(trigger.button);

      // Store trigger reference on container
      container._bsTrigger = trigger;
      return;
    }

    // INLINE MODE: Render form directly (default behavior)
    // Show loading state IMMEDIATELY (fail-loud pattern)
    renderLoadingState(container);

    // Fetch config
    fetchConfig(embedKey, function (err, config, diagnostics) {
      if (err) {
        var errorType = 'UNKNOWN';
        if (err.message === 'BLOCKED') {
          errorType = 'BLOCKED';
        } else if (err.message === 'NOT_FOUND') {
          errorType = 'NOT_FOUND';
        } else if (err.message === 'Timeout') {
          errorType = 'TIMEOUT';
        }

        renderErrorBox(container, errorType, diagnostics, embedKey);
        return;
      }

      // Render form - UNCHANGED CORE LOGIC
      renderForm(container, config, embedKey);
    });
  }

  /**
   * Initialize all forms on page (idempotent)
   * Safe to call multiple times
   */
  function init() {
    injectStyles();
    var containers = document.querySelectorAll('[data-bloomsuite-form]:not([' + INITIALIZED_ATTR + '="true"])');
    for (var i = 0; i < containers.length; i++) {
      initForm(containers[i]);
    }
  }

  // ─── MutationObserver for Late-Loaded Containers ─────────────────────────

  /**
   * Start watching for dynamically added form containers
   */
  function startObserver() {
    if (mutationObserver) return; // Already running

    if (typeof MutationObserver === 'undefined') {
      // Fallback for old browsers: poll periodically
      setInterval(init, 2000);
      return;
    }

    mutationObserver = new MutationObserver(function (mutations) {
      var shouldInit = false;

      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];

        // Check added nodes for form containers
        if (mutation.addedNodes) {
          for (var j = 0; j < mutation.addedNodes.length; j++) {
            var node = mutation.addedNodes[j];

            // Skip non-element nodes
            if (node.nodeType !== 1) continue;

            // Check if the added node itself is a form container
            if (node.hasAttribute && node.hasAttribute('data-bloomsuite-form')) {
              if (node.getAttribute(INITIALIZED_ATTR) !== 'true') {
                shouldInit = true;
                break;
              }
            }

            // Check descendants of added node
            if (node.querySelectorAll) {
              var descendants = node.querySelectorAll('[data-bloomsuite-form]:not([' + INITIALIZED_ATTR + '="true"])');
              if (descendants.length > 0) {
                shouldInit = true;
                break;
              }
            }
          }
        }

        if (shouldInit) break;
      }

      if (shouldInit) {
        // Debounce: wait a tick before initializing
        setTimeout(init, 10);
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Stop the MutationObserver
   */
  function stopObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────

  /**
   * Full initialization: styles + forms + observer
   */
  function bootstrap() {
    injectStyles();
    init();
    startObserver();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // Expose API for manual control
  window.BloomSuiteForms = {
    version: SCRIPT_VERSION,
    modes: DISPLAY_MODES,
    triggers: TRIGGER_TYPES,
    init: init,
    initForm: initForm,
    // Display mode API
    createModal: createModalWrapper,
    openModal: openModal,
    closeModal: closeModal,
    destroyModal: destroyModal,
    createSlideIn: createSlideInWrapper,
    openSlideIn: openSlideIn,
    closeSlideIn: closeSlideIn,
    createTrigger: createTriggerButton,
    // Trigger management
    cleanupTrigger: cleanupTrigger,
    // Observer management
    startObserver: startObserver,
    stopObserver: stopObserver,
    // Debug info
    getConfig: function () {
      return {
        version: SCRIPT_VERSION,
        apiBase: API_BASE,
        scriptBase: SCRIPT_BASE,
        cssLoaded: cssLoaded,
        cssFailed: cssFailed
      };
    }
  };

})(window, document);
