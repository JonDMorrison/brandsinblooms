/**
 * BloomSuite Forms Embed Script v1.0.1
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
 * 
 * Browser Support: Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
 */
(function(window, document) {
  'use strict';

  // ─── Configuration ───────────────────────────────────────────────────────
  var API_BASE = window.BLOOMSUITE_API_BASE || 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1';
  var SCRIPT_VERSION = '1.0.1';
  var INIT_TIMEOUT_MS = 10000;
  var CSS_PREFIX = 'bs-form-';
  
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
    '.' + CSS_PREFIX + 'hp{position:absolute!important;left:-9999px!important;opacity:0!important;pointer-events:none!important;height:0!important}'
  ].join('\n');

  // Track CSS loading state
  var cssLoaded = false;
  var cssFailed = false;

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
   * Render the complete form
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
    
    // Form submission handler
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
    
    // Submit
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

  // ─── Initialization ──────────────────────────────────────────────────────

  /**
   * Initialize a single form container
   */
  function initForm(container) {
    var embedKey = container.getAttribute('data-bloomsuite-form');
    if (!embedKey) return;
    
    // Validate embed key format (32 hex chars)
    if (!/^[a-f0-9]{32}$/i.test(embedKey)) {
      container.innerHTML = '<div class="' + CSS_PREFIX + 'error-msg">Invalid form configuration</div>';
      return;
    }
    
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
    init: init,
    initForm: initForm
  };

})(window, document);
