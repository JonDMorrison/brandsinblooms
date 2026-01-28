/**
 * BloomSuite Forms Embed Script
 * @version 1.0.0
 * @license MIT
 * 
 * PRODUCTION FILE - Hosted on Supabase Storage
 * URL: https://cdn.bloomsuite.app/forms/embed.v1.0.0.js
 * 
 * Features:
 * - No iframe (inline rendering)
 * - Scoped CSS with bs-form- prefix
 * - Multiple forms per page
 * - Graceful ad-blocker fallback
 * - NEVER pre-checks consent checkboxes (CASL/TCPA compliant)
 * - Zero external dependencies
 * 
 * Browser Support: Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
 */
(function(window, document) {
  'use strict';

  // ─── Version & Configuration ────────────────────────────────────────────
  var VERSION = '1.0.0';
  var API_BASE = window.BLOOMSUITE_API_BASE || 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1';
  var INIT_TIMEOUT_MS = 10000;
  var CSS_PREFIX = 'bs-form-';
  
  // Expose version for debugging
  window.BloomSuiteForms = window.BloomSuiteForms || {};
  window.BloomSuiteForms.version = VERSION;
  
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
  
  function getParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name) || null;
    } catch (e) {
      return null;
    }
  }

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

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

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

  function renderField(field, compliance) {
    var wrapper = createElement('div', 'field');
    var fieldId = CSS_PREFIX + 'f-' + field.id;

    if (field.type === 'hidden') {
      var hidden = createElement('input', null, {
        type: 'hidden',
        name: field.id,
        value: field.default_value || ''
      });
      wrapper.appendChild(hidden);
      return wrapper;
    }

    // Consent checkboxes - NEVER pre-checked (CASL/TCPA)
    if (field.type === 'email_consent' || field.type === 'sms_consent') {
      wrapper.className = CSS_PREFIX + 'field ' + CSS_PREFIX + 'consent';
      
      var checkWrap = createElement('div', 'checkbox-wrap');
      
      var checkbox = createElement('input', 'checkbox', {
        type: 'checkbox',
        id: fieldId,
        name: field.id
      });
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

    if (field.type === 'checkbox') {
      var checkWrap2 = createElement('div', 'checkbox-wrap');
      
      var checkbox2 = createElement('input', 'checkbox', {
        type: 'checkbox',
        id: fieldId,
        name: field.id
      });
      checkbox2.checked = false;
      
      var labelText2 = createElement('label', 'checkbox-text', { for: fieldId });
      labelText2.textContent = field.label;
      
      checkWrap2.appendChild(checkbox2);
      checkWrap2.appendChild(labelText2);
      wrapper.appendChild(checkWrap2);
      return wrapper;
    }

    var label = createElement('label', 'label', { for: fieldId });
    label.innerHTML = escapeHtml(field.label);
    if (field.required) {
      label.innerHTML += ' <span class="' + CSS_PREFIX + 'required">*</span>';
    }
    wrapper.appendChild(label);

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

  function renderForm(container, config, embedKey) {
    var fields = config.fields_json || [];
    var settings = config.settings_json || {};
    var compliance = config.compliance_json || {};
    var theme = settings.theme || {};
    
    var formContainer = createElement('div', 'container');
    
    var primaryColor = theme.primary_color || '#22C55E';
    formContainer.style.setProperty('--bs-form-primary', primaryColor);
    formContainer.style.setProperty('--bs-form-primary-hover', darkenColor(primaryColor, -20));
    formContainer.style.setProperty('--bs-form-radius', theme.border_radius || '8px');
    
    var formEl = createElement('form', 'wrapper');
    formEl.setAttribute('novalidate', 'true');
    formEl.setAttribute('autocomplete', 'on');
    
    // Honeypot
    var honeypot = createElement('div', 'hp');
    honeypot.setAttribute('aria-hidden', 'true');
    honeypot.innerHTML = '<input type="text" name="_hp_website" tabindex="-1" autocomplete="off">';
    formEl.appendChild(honeypot);
    
    fields.forEach(function(field) {
      formEl.appendChild(renderField(field, compliance));
    });
    
    var submitBtn = createElement('button', 'submit', { type: 'submit' });
    submitBtn.textContent = settings.submit_button_text || 'Submit';
    
    if (theme.button_style === 'outline') {
      submitBtn.className += ' ' + CSS_PREFIX + 'submit-outline';
    } else if (theme.button_style === 'rounded') {
      submitBtn.className += ' ' + CSS_PREFIX + 'submit-rounded';
    }
    
    formEl.appendChild(submitBtn);
    
    if (settings.show_branding !== false) {
      var branding = createElement('div', 'branding');
      branding.innerHTML = 'Powered by <a href="https://bloomsuite.com" target="_blank" rel="noopener noreferrer">BloomSuite</a>';
      formEl.appendChild(branding);
    }
    
    formEl.addEventListener('submit', function(e) {
      e.preventDefault();
      handleSubmit(formEl, container, embedKey, settings, compliance);
    });
    
    formContainer.appendChild(formEl);
    
    container.innerHTML = '';
    container.appendChild(formContainer);
  }

  // ─── Form Submission ─────────────────────────────────────────────────────

  function handleSubmit(formEl, container, embedKey, settings, compliance) {
    var submitBtn = formEl.querySelector('.' + CSS_PREFIX + 'submit');
    var originalText = submitBtn.textContent;
    
    // Honeypot check
    var honeypotValue = formEl.querySelector('input[name="_hp_website"]');
    if (honeypotValue && honeypotValue.value) {
      showSuccess(container, settings);
      return;
    }
    
    // Collect form data
    var formData = {};
    var inputs = formEl.querySelectorAll('input, select, textarea');
    
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var name = input.name;
      
      if (!name || name === '_hp_website') continue;
      
      if (input.type === 'checkbox') {
        formData[name] = input.checked;
      } else {
        formData[name] = input.value;
      }
    }
    
    // Collect metadata
    var meta = {
      page_url: window.location.href,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      utm_source: getParam('utm_source'),
      utm_medium: getParam('utm_medium'),
      utm_campaign: getParam('utm_campaign'),
      utm_term: getParam('utm_term'),
      utm_content: getParam('utm_content'),
      embed_version: VERSION
    };
    
    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    // Submit
    submitData(embedKey, formData, meta, function(err, response) {
      if (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        showError(formEl, err.message);
        return;
      }
      
      // Handle redirect
      if (settings.success_redirect_url) {
        window.location.href = settings.success_redirect_url;
        return;
      }
      
      // Show success
      showSuccess(container, settings);
    });
  }

  function showSuccess(container, settings) {
    var successDiv = createElement('div', 'success');
    
    var iconDiv = createElement('div', 'success-icon');
    iconDiv.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    
    var textP = createElement('p', 'success-text');
    textP.textContent = settings.success_message || 'Thank you! Your submission has been received.';
    
    successDiv.appendChild(iconDiv);
    successDiv.appendChild(textP);
    
    container.innerHTML = '';
    container.appendChild(successDiv);
  }

  function showError(formEl, message) {
    var existingError = formEl.querySelector('.' + CSS_PREFIX + 'error-msg');
    if (existingError) existingError.remove();
    
    var errorDiv = createElement('div', 'error-msg');
    errorDiv.textContent = message || 'Something went wrong. Please try again.';
    errorDiv.style.marginBottom = '16px';
    
    var firstField = formEl.querySelector('.' + CSS_PREFIX + 'field');
    if (firstField) {
      formEl.insertBefore(errorDiv, firstField);
    }
  }

  // ─── Initialization ──────────────────────────────────────────────────────

  function initForm(container) {
    var embedKey = container.getAttribute('data-bloomsuite-form');
    if (!embedKey) return;
    
    container.innerHTML = '<div class="' + CSS_PREFIX + 'loading"><div class="' + CSS_PREFIX + 'spinner"></div><div>Loading form...</div></div>';
    
    fetchConfig(embedKey, function(err, config) {
      if (err) {
        if (err.message === 'BLOCKED') {
          container.innerHTML = '<div class="' + CSS_PREFIX + 'blocked">This form could not be loaded. Please disable your ad blocker or try again later.</div>';
        } else {
          container.innerHTML = '<div class="' + CSS_PREFIX + 'blocked">' + escapeHtml(err.message) + '</div>';
        }
        return;
      }
      
      renderForm(container, config, embedKey);
    });
  }

  function initAll() {
    injectStyles();
    var containers = document.querySelectorAll('[data-bloomsuite-form]');
    for (var i = 0; i < containers.length; i++) {
      initForm(containers[i]);
    }
  }

  // ─── Auto-init ───────────────────────────────────────────────────────────
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
  
  // Expose for manual init
  window.BloomSuiteForms.init = initAll;
  window.BloomSuiteForms.initForm = initForm;

})(window, document);
