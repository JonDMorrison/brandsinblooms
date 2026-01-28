/**
 * BloomSuite Forms Embed Script v1.0
 * 
 * Features:
 * - No iframe (inline rendering)
 * - Scoped CSS with bs-form- prefix
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
  var SCRIPT_VERSION = '1.0.0';
  var INIT_TIMEOUT_MS = 10000;
  var CSS_PREFIX = 'bs-form-';
  
  // ─── Scoped CSS (all classes prefixed with bs-form-) ─────────────────────
  var SCOPED_STYLES = [
    // Reset & container
    '.' + CSS_PREFIX + 'container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1f2937; max-width: 100%; }',
    '.' + CSS_PREFIX + 'container *, .' + CSS_PREFIX + 'container *::before, .' + CSS_PREFIX + 'container *::after { box-sizing: border-box; }',
    
    // Form wrapper
    '.' + CSS_PREFIX + 'wrapper { background: #ffffff; padding: 0; }',
    
    // Field wrapper
    '.' + CSS_PREFIX + 'field { margin-bottom: 16px; }',
    '.' + CSS_PREFIX + 'field:last-of-type { margin-bottom: 20px; }',
    
    // Labels
    '.' + CSS_PREFIX + 'label { display: block; font-weight: 500; font-size: 14px; color: #374151; margin-bottom: 6px; }',
    '.' + CSS_PREFIX + 'required { color: #dc2626; margin-left: 2px; }',
    
    // Text inputs
    '.' + CSS_PREFIX + 'input { display: block; width: 100%; padding: 10px 12px; font-size: 14px; line-height: 1.5; color: #1f2937; background-color: #ffffff; border: 1px solid #d1d5db; border-radius: var(--bs-form-radius, 8px); transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out; -webkit-appearance: none; appearance: none; }',
    '.' + CSS_PREFIX + 'input:focus { outline: none; border-color: var(--bs-form-primary, #22C55E); box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15); }',
    '.' + CSS_PREFIX + 'input::placeholder { color: #9ca3af; }',
    '.' + CSS_PREFIX + 'input:disabled { background-color: #f3f4f6; cursor: not-allowed; }',
    
    // Select
    '.' + CSS_PREFIX + 'select { display: block; width: 100%; padding: 10px 36px 10px 12px; font-size: 14px; line-height: 1.5; color: #1f2937; background-color: #ffffff; background-image: url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e"); background-position: right 12px center; background-repeat: no-repeat; background-size: 16px 12px; border: 1px solid #d1d5db; border-radius: var(--bs-form-radius, 8px); -webkit-appearance: none; appearance: none; cursor: pointer; }',
    '.' + CSS_PREFIX + 'select:focus { outline: none; border-color: var(--bs-form-primary, #22C55E); box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15); }',
    
    // Checkbox wrapper
    '.' + CSS_PREFIX + 'checkbox-wrap { display: flex; align-items: flex-start; gap: 10px; }',
    '.' + CSS_PREFIX + 'checkbox { flex-shrink: 0; width: 18px; height: 18px; margin-top: 2px; accent-color: var(--bs-form-primary, #22C55E); cursor: pointer; }',
    '.' + CSS_PREFIX + 'checkbox-text { font-size: 14px; color: #4b5563; line-height: 1.5; cursor: pointer; -webkit-user-select: none; user-select: none; }',
    
    // Consent fields (special styling)
    '.' + CSS_PREFIX + 'consent { background: #f9fafb; padding: 12px; border-radius: var(--bs-form-radius, 8px); border: 1px solid #e5e7eb; }',
    '.' + CSS_PREFIX + 'consent .' + CSS_PREFIX + 'checkbox-text { font-size: 13px; color: #6b7280; }',
    
    // Submit button
    '.' + CSS_PREFIX + 'submit { display: block; width: 100%; padding: 12px 24px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: var(--bs-form-primary, #22C55E); border: none; border-radius: var(--bs-form-radius, 8px); cursor: pointer; transition: background-color 0.15s ease-in-out, transform 0.1s ease-in-out; -webkit-appearance: none; appearance: none; }',
    '.' + CSS_PREFIX + 'submit:hover { background-color: var(--bs-form-primary-hover, #16a34a); }',
    '.' + CSS_PREFIX + 'submit:active { transform: scale(0.98); }',
    '.' + CSS_PREFIX + 'submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }',
    '.' + CSS_PREFIX + 'submit-outline { background-color: transparent; border: 2px solid var(--bs-form-primary, #22C55E); color: var(--bs-form-primary, #22C55E); }',
    '.' + CSS_PREFIX + 'submit-outline:hover { background-color: var(--bs-form-primary, #22C55E); color: #ffffff; }',
    '.' + CSS_PREFIX + 'submit-rounded { border-radius: 9999px; }',
    
    // Error states
    '.' + CSS_PREFIX + 'error-msg { color: #dc2626; font-size: 13px; margin-top: 6px; }',
    '.' + CSS_PREFIX + 'input-error { border-color: #dc2626; }',
    '.' + CSS_PREFIX + 'input-error:focus { box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15); }',
    
    // Success state
    '.' + CSS_PREFIX + 'success { text-align: center; padding: 32px 24px; background: #f0fdf4; border-radius: var(--bs-form-radius, 8px); border: 1px solid #bbf7d0; }',
    '.' + CSS_PREFIX + 'success-icon { width: 56px; height: 56px; margin: 0 auto 16px; background: #22C55E; border-radius: 50%; display: flex; align-items: center; justify-content: center; }',
    '.' + CSS_PREFIX + 'success-icon svg { width: 28px; height: 28px; stroke: #ffffff; fill: none; }',
    '.' + CSS_PREFIX + 'success-text { font-size: 18px; font-weight: 600; color: #166534; margin: 0; }',
    
    // Loading state
    '.' + CSS_PREFIX + 'loading { text-align: center; padding: 48px 24px; color: #6b7280; font-size: 14px; }',
    '.' + CSS_PREFIX + 'spinner { display: inline-block; width: 24px; height: 24px; border: 2px solid #e5e7eb; border-top-color: var(--bs-form-primary, #22C55E); border-radius: 50%; animation: ' + CSS_PREFIX + 'spin 0.8s linear infinite; margin-bottom: 12px; }',
    '@keyframes ' + CSS_PREFIX + 'spin { to { transform: rotate(360deg); } }',
    
    // Branding
    '.' + CSS_PREFIX + 'branding { text-align: center; margin-top: 16px; font-size: 12px; color: #9ca3af; }',
    '.' + CSS_PREFIX + 'branding a { color: #6b7280; text-decoration: none; }',
    '.' + CSS_PREFIX + 'branding a:hover { text-decoration: underline; }',
    
    // Honeypot (hidden from users & screen readers)
    '.' + CSS_PREFIX + 'hp { position: absolute !important; left: -9999px !important; top: -9999px !important; opacity: 0 !important; pointer-events: none !important; height: 0 !important; overflow: hidden !important; }',
    
    // Blocked/error fallback
    '.' + CSS_PREFIX + 'blocked { text-align: center; padding: 24px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; color: #991b1b; font-size: 14px; }'
  ].join('\n');

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

  // ─── Style Injection ─────────────────────────────────────────────────────
  
  function injectStyles() {
    if (document.getElementById(CSS_PREFIX + 'styles')) return;
    var style = document.createElement('style');
    style.id = CSS_PREFIX + 'styles';
    style.textContent = SCOPED_STYLES;
    (document.head || document.documentElement).appendChild(style);
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
