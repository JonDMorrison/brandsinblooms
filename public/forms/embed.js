/**
 * BloomSuite Forms Embed Script v1.2.0
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
 * 
 * Browser Support: Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
 */
(function(window, document) {
  'use strict';

  // ─── Configuration ───────────────────────────────────────────────────────
  var API_BASE = window.BLOOMSUITE_API_BASE || 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1';
  var SCRIPT_VERSION = '1.2.0';
  var INIT_TIMEOUT_MS = 10000;
  var CSS_PREFIX = 'bs-form-';
  
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
  var SCRIPT_BASE = (function() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || '';
      if (src.indexOf('embed') !== -1 && src.indexOf('bloomsuite') !== -1 || 
          src.indexOf('/forms/embed') !== -1) {
        return src.replace(/embed[^/]*\.js.*$/, '');
      }
    }
    // Fallback: use current script
    try {
      return document.currentScript.src.replace(/embed[^/]*\.js.*$/, '');
    } catch (e) {
      return '';
    }
  })();

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
    '.' + CSS_PREFIX + 'loading{text-align:center;padding:2em}',
    '.' + CSS_PREFIX + 'blocked{text-align:center;padding:1.5em;background:#fef2f2;border:1px solid #fecaca;color:#991b1b}',
    '.' + CSS_PREFIX + 'error-msg{color:#dc2626;font-size:.875em;margin-top:.25em}',
    '.' + CSS_PREFIX + 'hp{position:absolute!important;left:-9999px!important;opacity:0!important;pointer-events:none!important;height:0!important}',
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
    
    var timeoutId = setTimeout(function() {
      if (!activeTriggers[triggerId].fired) {
        activeTriggers[triggerId].fired = true;
        openFn();
      }
    }, delayMs);
    
    activeTriggers[triggerId].cleanup = function() {
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
    
    var handler = function() {
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
    
    activeTriggers[triggerId].cleanup = function() {
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
    
    var handler = function(e) {
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
    
    activeTriggers[triggerId].cleanup = function() {
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
    return function() {
      var now = Date.now();
      if (now - lastTime >= wait) {
        lastTime = now;
        fn.apply(this, arguments);
      }
    };
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

    // Try to load external CSS first (CSP-friendly)
    var cssUrl = SCRIPT_BASE + 'embed.css';
    var link = document.createElement('link');
    link.id = CSS_PREFIX + 'styles';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = cssUrl;

    var timeout = setTimeout(function() {
      // CSS load timeout - fall back to inline
      if (!cssLoaded) {
        cssFailed = true;
        injectFallbackStyles();
        callback(false);
      }
    }, 3000);

    link.onload = function() {
      clearTimeout(timeout);
      cssLoaded = true;
      callback(true);
    };

    link.onerror = function() {
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
    loadStyles(function() {});
  }

  // ─── API Functions ───────────────────────────────────────────────────────

  /**
   * Fetch form configuration
   */
  function fetchConfig(embedKey, callback) {
    var url = API_BASE + '/get-form-config?embed_key=' + encodeURIComponent(embedKey);
    
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = INIT_TIMEOUT_MS;
    
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          callback(null, data);
        } catch (e) {
          callback(new Error('Invalid response'));
        }
      } else if (xhr.status === 0) {
        // Network error or blocked
        callback(new Error('BLOCKED'));
      } else {
        callback(new Error('Form not found'));
      }
    };
    
    xhr.onerror = function() {
      callback(new Error('BLOCKED'));
    };
    
    xhr.ontimeout = function() {
      callback(new Error('Timeout'));
    };
    
    try {
      xhr.send();
    } catch (e) {
      callback(new Error('BLOCKED'));
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
    
    xhr.onreadystatechange = function() {
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
    
    xhr.onerror = function() {
      callback(new Error('Network error'));
    };
    
    xhr.ontimeout = function() {
      callback(new Error('Request timeout'));
    };
    
    var payload = {
      embed_key: embedKey,
      data: formData,
      meta: meta
    };
    
    xhr.send(JSON.stringify(payload));
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
      
      (field.options || []).forEach(function(opt) {
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
    
    // Render each field
    fields.forEach(function(field) {
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
    
    formEl.appendChild(submitBtn);
    
    // Branding
    if (settings.show_branding !== false) {
      var branding = createElement('div', 'branding');
      branding.innerHTML = 'Powered by <a href="https://bloomsuite.com" target="_blank" rel="noopener noreferrer">BloomSuite</a>';
      formEl.appendChild(branding);
    }
    
    // Form submission handler - SINGLE PATH, never duplicated
    formEl.addEventListener('submit', function(e) {
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
    submitData(embedKey, formData, meta, function(err, result) {
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
    
    // Create overlay
    var overlay = createElement('div', 'modal-overlay');
    overlay.id = modalId;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', modalId + '-title');
    
    // Create modal content
    var content = createElement('div', 'modal-content');
    
    // Close button
    var closeBtn = createElement('button', 'modal-close', {
      type: 'button',
      'aria-label': 'Close form'
    });
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function() {
      closeModal(modalId);
    });
    
    // Modal body - this is where the form renders (unchanged)
    var body = createElement('div', 'modal-body');
    body.setAttribute('data-bloomsuite-form', embedKey);
    
    content.appendChild(closeBtn);
    content.appendChild(body);
    overlay.appendChild(content);
    
    // Close on overlay click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        closeModal(modalId);
      }
    });
    
    // Close on Escape key
    var escHandler = function(e) {
      if (e.key === 'Escape' && overlay.classList.contains(CSS_PREFIX + 'open')) {
        closeModal(modalId);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    // Append to body
    document.body.appendChild(overlay);
    
    // Store reference
    activeModals[modalId] = {
      overlay: overlay,
      body: body,
      embedKey: embedKey,
      escHandler: escHandler
    };
    
    return modalId;
  }

  /**
   * Open modal and initialize form inside it
   */
  function openModal(modalId) {
    var modal = activeModals[modalId];
    if (!modal) return;
    
    // Show overlay
    modal.overlay.classList.add(CSS_PREFIX + 'open');
    document.body.style.overflow = 'hidden';
    
    // Initialize form inside modal body (uses existing renderForm)
    initForm(modal.body);
  }

  /**
   * Close modal
   */
  function closeModal(modalId) {
    var modal = activeModals[modalId];
    if (!modal) return;
    
    modal.overlay.classList.remove(CSS_PREFIX + 'open');
    document.body.style.overflow = '';
  }

  /**
   * Destroy modal and cleanup
   */
  function destroyModal(modalId) {
    var modal = activeModals[modalId];
    if (!modal) return;
    
    document.removeEventListener('keydown', modal.escHandler);
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
    
    // Create overlay
    var overlay = createElement('div', 'slidein-overlay');
    overlay.id = panelId;
    
    // Create panel
    var panel = createElement('div', 'slidein-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    
    // Header
    var header = createElement('div', 'slidein-header');
    
    var title = createElement('h2', 'slidein-title');
    title.textContent = options.title || 'Get in Touch';
    title.id = panelId + '-title';
    
    var closeBtn = createElement('button', 'slidein-close', {
      type: 'button',
      'aria-label': 'Close form'
    });
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function() {
      closeSlideIn(panelId);
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Body - this is where the form renders (unchanged)
    var body = createElement('div', 'slidein-body');
    body.setAttribute('data-bloomsuite-form', embedKey);
    
    panel.appendChild(header);
    panel.appendChild(body);
    overlay.appendChild(panel);
    
    // Close on overlay click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        closeSlideIn(panelId);
      }
    });
    
    // Close on Escape key
    var escHandler = function(e) {
      if (e.key === 'Escape' && overlay.classList.contains(CSS_PREFIX + 'open')) {
        closeSlideIn(panelId);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    // Append to body
    document.body.appendChild(overlay);
    
    // Store reference
    activeModals[panelId] = {
      overlay: overlay,
      body: body,
      embedKey: embedKey,
      escHandler: escHandler,
      type: 'slidein'
    };
    
    return panelId;
  }

  /**
   * Open slide-in panel and initialize form inside it
   */
  function openSlideIn(panelId) {
    var panel = activeModals[panelId];
    if (!panel) return;
    
    // Show overlay
    panel.overlay.classList.add(CSS_PREFIX + 'open');
    document.body.style.overflow = 'hidden';
    
    // Initialize form inside panel body (uses existing renderForm)
    initForm(panel.body);
  }

  /**
   * Close slide-in panel
   */
  function closeSlideIn(panelId) {
    var panel = activeModals[panelId];
    if (!panel) return;
    
    panel.overlay.classList.remove(CSS_PREFIX + 'open');
    document.body.style.overflow = '';
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
    
    button.addEventListener('click', function() {
      if (mode === DISPLAY_MODES.MODAL) {
        openModal(wrapperId);
      } else if (mode === DISPLAY_MODES.SLIDE_IN) {
        openSlideIn(wrapperId);
      }
    });
    
    return {
      button: button,
      wrapperId: wrapperId,
      open: function() {
        if (mode === DISPLAY_MODES.MODAL) openModal(wrapperId);
        else if (mode === DISPLAY_MODES.SLIDE_IN) openSlideIn(wrapperId);
      },
      close: function() {
        if (mode === DISPLAY_MODES.MODAL) closeModal(wrapperId);
        else if (mode === DISPLAY_MODES.SLIDE_IN) closeSlideIn(wrapperId);
      },
      destroy: function() {
        destroyModal(wrapperId);
      }
    };
  }

  // ─── Initialization ──────────────────────────────────────────────────────

  /**
   * Initialize a single form container
   * Reads display mode and trigger from data attributes
   */
  function initForm(container) {
    var embedKey = container.getAttribute('data-bloomsuite-form');
    if (!embedKey) return;
    
    // Get display mode (default: inline)
    var displayMode = container.getAttribute('data-display-mode') || DISPLAY_MODES.INLINE;
    
    // Validate embed key format (32 hex chars)
    if (!/^[a-f0-9]{32}$/i.test(embedKey)) {
      container.innerHTML = '<div class="' + CSS_PREFIX + 'error-msg">Invalid form configuration</div>';
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
        openFn = function() { openModal(wrapperId); };
      } else {
        wrapperId = createSlideInWrapper(embedKey, { title: title });
        openFn = function() { openSlideIn(wrapperId); };
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
          close: function() {
            if (displayMode === DISPLAY_MODES.MODAL) closeModal(wrapperId);
            else closeSlideIn(wrapperId);
          },
          destroy: function() {
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
    // Show loading
    container.innerHTML = 
      '<div class="' + CSS_PREFIX + 'loading">' +
        '<div class="' + CSS_PREFIX + 'spinner"></div>' +
        '<div>Loading form...</div>' +
      '</div>';
    
    // Fetch config
    fetchConfig(embedKey, function(err, config) {
      if (err) {
        if (err.message === 'BLOCKED') {
          // Graceful ad-blocker fallback
          container.innerHTML = 
            '<div class="' + CSS_PREFIX + 'blocked">' +
              '<strong>Form Blocked</strong><br>' +
              'Please disable your ad blocker to use this form, or contact us directly.' +
            '</div>';
        } else {
          container.innerHTML = '<div class="' + CSS_PREFIX + 'error-msg">' + escapeHtml(err.message) + '</div>';
        }
        return;
      }
      
      // Render form - UNCHANGED CORE LOGIC
      renderForm(container, config, embedKey);
    });
  }

  /**
   * Initialize all forms on page
   */
  function init() {
    injectStyles();
    var containers = document.querySelectorAll('[data-bloomsuite-form]');
    for (var i = 0; i < containers.length; i++) {
      initForm(containers[i]);
    }
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
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
    cleanupTrigger: cleanupTrigger
  };

})(window, document);
