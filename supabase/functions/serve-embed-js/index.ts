/**
 * Serve Embed JS Edge Function
 *
 * Serves the embed.v1.js file directly from the edge function.
 * This is a deprecated compatibility path. New embeds should use the
 * storage-hosted runtime instead of this edge-served copy.
 *
 * URL: https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/serve-embed-js
 *
 * When updating:
 * 1. Update public/forms/embed.v1.js (source of truth)
 * 2. Update EMBED_JS constant in this file
 * 3. Changes auto-deploy with the edge function
 *
 * Version: 1.5.0
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers":
    "Deprecation, Link, X-Embed-Version, X-BloomSuite-Deprecated, X-BloomSuite-Successor",
};

const EMBED_VERSION = "1.5.0";
const STATIC_EMBED_RUNTIME_URL = `https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/assets/forms/embed.v${EMBED_VERSION}.js`;

// ─── Embed JS Content ──────────────────────────────────────────────────────
// This is the compiled embed.js content
// When making changes, update public/forms/embed.v1.js first, then copy here
const EMBED_JS = `/**
 * BloomSuite Forms Embed Script v${EMBED_VERSION}
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
 * - Edge function serving support
 *
 * Browser Support: Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
 */
(function (window, document) {
  'use strict';

  // ─── Configuration ───────────────────────────────────────────────────────
  var API_BASE = window.BLOOMSUITE_API_BASE || 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1';
  var SCRIPT_VERSION = '${EMBED_VERSION}';
  var INIT_TIMEOUT_MS = 10000;
  var CSS_PREFIX = 'bs-form-';
  var INITIALIZED_ATTR = 'data-bs-initialized';

  // CSS URL - detect from edge function or storage
  var CSS_URL = window.BLOOMSUITE_CSS_URL || (function() {
    // Try to detect from current script
    try {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i].src || '';
        if (src.indexOf('serve-embed-js') !== -1) {
          // Edge function serving - use companion CSS function
          return src.replace('serve-embed-js', 'serve-embed-assets') + '?file=embed.css';
        }
        if (src.indexOf('/forms/embed') !== -1) {
          // Storage/CDN serving
          return src.replace(/embed[^/]*\\.js.*$/, 'embed.css');
        }
      }
    } catch (e) {}
    // Fallback to edge function
    return API_BASE.replace('/functions/v1', '/functions/v1/serve-embed-assets?file=embed.css');
  })();

  // Supported display modes
  var DISPLAY_MODES = {
    INLINE: 'inline',
    MODAL: 'modal',
    SLIDE_IN: 'slide-in'
  };

  // Supported trigger types
  var TRIGGER_TYPES = {
    MANUAL: 'manual',
    DELAY: 'delay',
    SCROLL: 'scroll',
    CLICK: 'click'
  };

  // ─── Minimal Fallback CSS ────────────────────────────────────────────────
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
    '.' + CSS_PREFIX + 'error-msg{color:#dc2626;font-size:.875em;margin-top:.25em}',
    '.' + CSS_PREFIX + 'hp{position:absolute!important;left:-9999px!important;opacity:0!important;pointer-events:none!important;height:0!important}'
  ].join('\\n');

  // Track state
  var cssLoaded = false;
  var cssFailed = false;
  var activeModals = {};
  var activeTriggers = {};

  // ─── Utility Functions ───────────────────────────────────────────────────

  function log(msg, data) {
    if (window.BLOOMSUITE_DEBUG) {
      console.log('[BloomSuite] ' + msg, data || '');
    }
  }

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

  // ─── CSS Loading ─────────────────────────────────────────────────────────

  function loadCSS(callback) {
    if (cssLoaded) {
      callback && callback(true);
      return;
    }
    if (cssFailed) {
      callback && callback(false);
      return;
    }

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    link.id = 'bs-form-styles';

    link.onload = function() {
      cssLoaded = true;
      log('CSS loaded from: ' + CSS_URL);
      callback && callback(true);
    };

    link.onerror = function() {
      cssFailed = true;
      log('CSS failed to load, using fallback');
      injectFallbackStyles();
      callback && callback(false);
    };

    document.head.appendChild(link);
  }

  function injectFallbackStyles() {
    var style = document.createElement('style');
    style.id = 'bs-form-fallback-styles';
    style.textContent = FALLBACK_STYLES;
    document.head.appendChild(style);
  }

  // ─── Form Rendering ──────────────────────────────────────────────────────

  function getFieldName(field) {
    return field.mapping_key || field.id || field.field_key;
  }

  function getConfigFields(config) {
    return config.fields_json || config.fields || [];
  }

  function getConfigSettings(config) {
    return config.settings_json || config.settings || {};
  }

  function getConfigCompliance(config) {
    return config.compliance_json || config.compliance || {};
  }

  function isCheckboxField(field) {
    return field.type === 'checkbox' || field.type === 'email_consent' || field.type === 'sms_consent';
  }

  function getFieldDefaultValue(field) {
    if (field.type === 'email_consent' || field.type === 'sms_consent') {
      return false;
    }

    if (field.type === 'checkbox') {
      return field.default_value === true;
    }

    return typeof field.default_value === 'string' ? field.default_value : '';
  }

  function getFieldTextValue(value) {
    if (value === undefined || value === null) {
      return '';
    }

    return String(value);
  }

  function getFieldMaxLength(field) {
    return field && field.rules && typeof field.rules.max_length === 'number' && field.rules.max_length > 0
      ? field.rules.max_length
      : null;
  }

  function getConsentText(field, compliance) {
    if (field.type === 'email_consent') {
      return (compliance && compliance.email_consent_text) || field.label || 'I agree to receive email communications';
    }

    if (field.type === 'sms_consent') {
      return (compliance && compliance.sms_consent_text) || field.label || 'I agree to receive SMS communications';
    }

    return field.label || '';
  }

  function getOptionValue(option) {
    if (option && typeof option === 'object') {
      if (option.value !== undefined && option.value !== null) {
        return String(option.value);
      }

      if (option.label !== undefined && option.label !== null) {
        return String(option.label);
      }
    }

    return getFieldTextValue(option);
  }

  function getOptionLabel(option) {
    if (option && typeof option === 'object' && option.label !== undefined && option.label !== null) {
      return String(option.label);
    }

    return getOptionValue(option);
  }

  function getFieldInput(formEl, fieldName) {
    var inputs = formEl.querySelectorAll('input, select, textarea');

    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].name === fieldName) {
        return inputs[i];
      }
    }

    return null;
  }

  function getFieldWrapper(formEl, fieldName) {
    var wrappers = formEl.querySelectorAll('.' + CSS_PREFIX + 'field');

    for (var i = 0; i < wrappers.length; i++) {
      if (wrappers[i].getAttribute('data-field-name') === fieldName) {
        return wrappers[i];
      }
    }

    return null;
  }

  function getFieldErrorElement(formEl, fieldName) {
    var wrapper = getFieldWrapper(formEl, fieldName);
    if (!wrapper) {
      return null;
    }

    var errors = wrapper.querySelectorAll('[data-field-error]');
    for (var i = 0; i < errors.length; i++) {
      if (errors[i].getAttribute('data-field-error') === fieldName) {
        return errors[i];
      }
    }

    return null;
  }

  function getInputValue(field, input) {
    if (!input) {
      return getFieldDefaultValue(field);
    }

    if (isCheckboxField(field)) {
      return input.checked === true;
    }

    return input.value || '';
  }

  function clearFieldError(formEl, fieldName) {
    var input = getFieldInput(formEl, fieldName);
    var errorEl = getFieldErrorElement(formEl, fieldName);

    if (errorEl && errorEl.parentNode) {
      errorEl.parentNode.removeChild(errorEl);
    }

    if (input) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function clearSubmissionError(formEl) {
    var errors = formEl.querySelectorAll('[data-form-error="true"]');

    for (var i = 0; i < errors.length; i++) {
      if (errors[i].parentNode) {
        errors[i].parentNode.removeChild(errors[i]);
      }
    }
  }

  function showFieldError(formEl, fieldName, message) {
    var wrapper = getFieldWrapper(formEl, fieldName);
    var input = getFieldInput(formEl, fieldName);
    var errorEl = getFieldErrorElement(formEl, fieldName);

    if (!wrapper) {
      return;
    }

    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = CSS_PREFIX + 'error-msg';
      errorEl.setAttribute('data-field-error', fieldName);
      wrapper.appendChild(errorEl);
    }

    errorEl.id = CSS_PREFIX + 'error-' + fieldName;
    errorEl.textContent = message;

    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorEl.id);
    }
  }

  function validateFieldValue(field, rawValue, compliance) {
    var isRequired = field.required === true;

    if (field.type === 'email_consent' && compliance && compliance.email_consent_required) {
      isRequired = true;
    }

    if (field.type === 'sms_consent' && compliance && compliance.sms_consent_required) {
      isRequired = true;
    }

    if (isCheckboxField(field)) {
      if (isRequired && rawValue !== true) {
        if (field.type === 'email_consent') {
          return 'Email consent is required';
        }

        if (field.type === 'sms_consent') {
          return 'SMS consent is required';
        }

        return 'This field is required';
      }

      return null;
    }

    var textValue = getFieldTextValue(rawValue);
    var trimmedValue = textValue.trim();

    if (isRequired && !trimmedValue) {
      return 'This field is required';
    }

    if (!trimmedValue) {
      return null;
    }

    if (field.type === 'email' && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(trimmedValue)) {
      return 'Please enter a valid email';
    }

    if (field.type === 'phone') {
      if (!/^[\\d\\s\\-+()]+$/.test(trimmedValue)) {
        return 'Please enter a valid phone number';
      }

      if (trimmedValue.replace(/\\D/g, '').length < 10) {
        return 'Please enter a valid phone number';
      }
    }

    var minLength = field.rules && field.rules.min_length;
    if (typeof minLength === 'number' && minLength > 0 && textValue.length < minLength) {
      return 'Please enter at least ' + minLength + ' characters';
    }

    var maxLength = getFieldMaxLength(field);
    if (typeof maxLength === 'number' && textValue.length > maxLength) {
      return 'Please keep this answer under ' + maxLength + ' characters';
    }

    var pattern = field.rules && field.rules.pattern;
    if (pattern) {
      try {
        if (!(new RegExp(pattern)).test(textValue)) {
          if (
            field.rules &&
            typeof field.rules.pattern_message === 'string' &&
            field.rules.pattern_message.trim()
          ) {
            return field.rules.pattern_message.trim();
          }

          return 'Please match the expected format';
        }
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  function validateFormFields(formEl, fields, compliance) {
    var firstInvalidInput = null;
    var isValid = true;

    fields.forEach(function(field) {
      if (field.type === 'hidden' || field.field_key === 'hp_field') {
        return;
      }

      var fieldName = getFieldName(field);
      clearFieldError(formEl, fieldName);

      var input = getFieldInput(formEl, fieldName);
      var error = validateFieldValue(field, getInputValue(field, input), compliance);

      if (error) {
        isValid = false;
        showFieldError(formEl, fieldName, error);

        if (!firstInvalidInput && input && typeof input.focus === 'function') {
          firstInvalidInput = input;
        }
      }
    });

    return {
      valid: isValid,
      firstInvalidInput: firstInvalidInput
    };
  }

  function attachValidationListeners(formEl, fields, compliance) {
    fields.forEach(function(field) {
      if (field.type === 'hidden' || field.field_key === 'hp_field') {
        return;
      }

      var fieldName = getFieldName(field);
      var input = getFieldInput(formEl, fieldName);
      if (!input) {
        return;
      }

      var revalidate = function() {
        var hasError = getFieldErrorElement(formEl, fieldName);
        if (!hasError) {
          return;
        }

        var nextError = validateFieldValue(field, getInputValue(field, input), compliance);
        if (nextError) {
          showFieldError(formEl, fieldName, nextError);
        } else {
          clearFieldError(formEl, fieldName);
        }
      };

      var eventName = isCheckboxField(field) || field.type === 'select' ? 'change' : 'input';
      input.addEventListener(eventName, revalidate);
      input.addEventListener('blur', function() {
        var nextError = validateFieldValue(field, getInputValue(field, input), compliance);
        if (nextError) {
          showFieldError(formEl, fieldName, nextError);
        } else {
          clearFieldError(formEl, fieldName);
        }
      });
    });
  }

  function renderField(field, compliance) {
    var wrapper = document.createElement('div');
    var fieldName = getFieldName(field);
    var defaultValue = getFieldDefaultValue(field);

    wrapper.className = CSS_PREFIX + 'field';
    wrapper.setAttribute('data-field-name', fieldName);

    if (field.type === 'hidden' || field.field_key === 'hp_field') {
      wrapper.className += ' ' + CSS_PREFIX + 'hp';

      var hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = fieldName;
      hidden.value = typeof defaultValue === 'string' ? defaultValue : '';
      wrapper.appendChild(hidden);
      return wrapper;
    }

    if (field.type === 'email_consent' || field.type === 'sms_consent') {
      wrapper.className += ' ' + CSS_PREFIX + 'consent';

      var consentWrap = document.createElement('div');
      consentWrap.className = CSS_PREFIX + 'checkbox-wrap';

      var consentCheckbox = document.createElement('input');
      consentCheckbox.type = 'checkbox';
      consentCheckbox.className = CSS_PREFIX + 'checkbox';
      consentCheckbox.name = fieldName;
      consentCheckbox.id = CSS_PREFIX + 'f-' + field.id;
      consentCheckbox.checked = false;

      if (
        field.required ||
        (field.type === 'email_consent' && compliance && compliance.email_consent_required) ||
        (field.type === 'sms_consent' && compliance && compliance.sms_consent_required)
      ) {
        consentCheckbox.required = true;
      }

      var consentLabel = document.createElement('label');
      consentLabel.className = CSS_PREFIX + 'checkbox-text';
      consentLabel.setAttribute('for', consentCheckbox.id);
      consentLabel.textContent = getConsentText(field, compliance);

      if (consentCheckbox.required) {
        var consentReq = document.createElement('span');
        consentReq.className = CSS_PREFIX + 'required';
        consentReq.textContent = ' *';
        consentLabel.appendChild(consentReq);
      }

      consentWrap.appendChild(consentCheckbox);
      consentWrap.appendChild(consentLabel);
      wrapper.appendChild(consentWrap);
      return wrapper;
    }

    if (field.type === 'checkbox') {
      var checkWrap = document.createElement('div');
      checkWrap.className = CSS_PREFIX + 'checkbox-wrap';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = CSS_PREFIX + 'checkbox';
      checkbox.name = fieldName;
      checkbox.id = CSS_PREFIX + 'f-' + field.id;
      checkbox.checked = defaultValue === true;
      if (field.required) checkbox.required = true;

      var checkLabel = document.createElement('label');
      checkLabel.className = CSS_PREFIX + 'checkbox-text';
      checkLabel.setAttribute('for', checkbox.id);
      checkLabel.textContent = field.label || '';

      if (field.required) {
        var checkReq = document.createElement('span');
        checkReq.className = CSS_PREFIX + 'required';
        checkReq.textContent = ' *';
        checkLabel.appendChild(checkReq);
      }

      checkWrap.appendChild(checkbox);
      checkWrap.appendChild(checkLabel);
      wrapper.appendChild(checkWrap);
      return wrapper;
    }

    if (field.label) {
      var label = document.createElement('label');
      label.className = CSS_PREFIX + 'label';
      label.setAttribute('for', CSS_PREFIX + 'f-' + field.id);
      label.textContent = field.label;

      if (field.required) {
        var req = document.createElement('span');
        req.className = CSS_PREFIX + 'required';
        req.textContent = ' *';
        label.appendChild(req);
      }

      wrapper.appendChild(label);
    }

    if (field.type === 'select') {
      var select = document.createElement('select');
      select.className = CSS_PREFIX + 'select';
      select.name = fieldName;
      select.id = CSS_PREFIX + 'f-' + field.id;
      if (field.required) select.required = true;

      var defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = field.placeholder || 'Select...';
      select.appendChild(defaultOpt);

      (field.options || []).forEach(function(opt) {
        var option = document.createElement('option');
        option.value = getOptionValue(opt);
        option.textContent = getOptionLabel(opt);
        select.appendChild(option);
      });

      if (typeof defaultValue === 'string' && defaultValue) {
        select.value = defaultValue;
      }

      wrapper.appendChild(select);
      return wrapper;
    }

    var input = document.createElement(field.type === 'textarea' ? 'textarea' : 'input');
    input.className = CSS_PREFIX + 'input';
    input.name = fieldName;
    input.id = CSS_PREFIX + 'f-' + field.id;
    if (field.required) input.required = true;
    if (field.placeholder) input.placeholder = field.placeholder;

    if (field.type === 'textarea') {
      input.rows = 4;
    } else if (field.type === 'email') {
      input.type = 'email';
    } else if (field.type === 'phone') {
      input.type = 'tel';
    } else {
      input.type = 'text';
    }

    if (typeof defaultValue === 'string' && defaultValue) {
      input.value = defaultValue;
    }

    var maxLength = getFieldMaxLength(field);
    if (typeof maxLength === 'number') {
      input.maxLength = maxLength;
    }

    wrapper.appendChild(input);
    return wrapper;
  }

  function renderForm(container, config, embedKey) {
    var settings = getConfigSettings(config);
    var compliance = getConfigCompliance(config);
    var fields = getConfigFields(config);
    var form = document.createElement('form');
    form.className = CSS_PREFIX + 'wrapper';
    form.setAttribute('novalidate', 'true');

    // Header
    if (settings.form_headline) {
      var headline = document.createElement('h2');
      headline.textContent = settings.form_headline;
      headline.style.marginBottom = '0.5em';
      form.appendChild(headline);
    }
    if (settings.form_subheadline) {
      var sub = document.createElement('p');
      sub.textContent = settings.form_subheadline;
      sub.style.marginBottom = '1.5em';
      sub.style.color = '#666';
      form.appendChild(sub);
    }

    // Fields
    fields.forEach(function(field) {
      form.appendChild(renderField(field, compliance));
    });

    attachValidationListeners(form, fields, compliance);

    // Add honeypot
    var hp = document.createElement('div');
    hp.className = CSS_PREFIX + 'hp';
    var hpInput = document.createElement('input');
    hpInput.type = 'text';
    hpInput.name = 'hp_field';
    hpInput.tabIndex = -1;
    hpInput.autocomplete = 'off';
    hp.appendChild(hpInput);
    form.appendChild(hp);

    // Submit button
    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = CSS_PREFIX + 'submit';
    submitBtn.textContent = settings.submit_button_text || 'Submit';

    // Apply theme
    var theme = settings.theme || {};
    if (theme.primary_color) {
      submitBtn.style.backgroundColor = theme.primary_color;
    }
    if (theme.button_style === 'outline') {
      submitBtn.classList.add(CSS_PREFIX + 'submit-outline');
    }
    if (theme.button_style === 'rounded') {
      submitBtn.classList.add(CSS_PREFIX + 'submit-rounded');
    }

    form.appendChild(submitBtn);

    // Form submission
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      handleSubmit(form, container, embedKey, settings, compliance, fields);
    });

    container.innerHTML = '';
    container.appendChild(form);
    container.setAttribute(INITIALIZED_ATTR, 'true');

    log('Form rendered', embedKey);
  }

  function handleSubmit(form, container, embedKey, settings, compliance, fields) {
    var submitBtn = form.querySelector('.' + CSS_PREFIX + 'submit');
    var originalText = submitBtn.textContent;

    clearSubmissionError(form);

    var validationResult = validateFormFields(form, fields || [], compliance || {});
    if (!validationResult.valid) {
      if (validationResult.firstInvalidInput) {
        validationResult.firstInvalidInput.focus();
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    // Collect form data
    var formData = {};
    var inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(function(input) {
      if (input.type === 'checkbox') {
        formData[input.name] = input.checked;
      } else {
        formData[input.name] = input.value;
      }
    });

    // Check honeypot
    if (formData.hp_field) {
      showError(container, 'Submission blocked');
      return;
    }
    delete formData.hp_field;

    // Submit to API
    fetch(API_BASE + '/submit-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embed_key: embedKey,
        data: formData,
        meta: {
          page_url: window.location.href,
          referrer: document.referrer,
          user_agent: navigator.userAgent
        }
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        showSuccess(container, settings.success_message || 'Thank you!');
      } else {
        showError(container, data.error || 'Submission failed');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    })
    .catch(function(err) {
      showError(container, 'Network error. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    });
  }

  function showSuccess(container, message) {
    container.innerHTML = '<div class="' + CSS_PREFIX + 'success">' +
      '<div class="' + CSS_PREFIX + 'success-icon"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '<p class="' + CSS_PREFIX + 'success-text">' + message + '</p></div>';
  }

  function showError(container, message) {
    var errorBox = container.querySelector('.' + CSS_PREFIX + 'error-box');
    if (!errorBox) {
      errorBox = document.createElement('div');
      errorBox.className = CSS_PREFIX + 'error-box';
      container.insertBefore(errorBox, container.firstChild);
    }
    errorBox.innerHTML = '<strong>Error</strong>' + message;
  }

  function showBlocked(container, reason, embedKey) {
    container.innerHTML = '<div class="' + CSS_PREFIX + 'blocked">' +
      '<strong>' + reason + '</strong>' +
      '<p>Form could not be loaded. Please try again later.</p>' +
      (window.BLOOMSUITE_DEBUG ? '<small>Key: ' + embedKey + '</small>' : '') +
      '</div>';
  }

  // ─── Display Modes ───────────────────────────────────────────────────────

  function createModal(container, config) {
    var overlay = document.createElement('div');
    overlay.className = CSS_PREFIX + 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var content = document.createElement('div');
    content.className = CSS_PREFIX + 'modal-content';

    var closeBtn = document.createElement('button');
    closeBtn.className = CSS_PREFIX + 'modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close form');

    var body = document.createElement('div');
    body.className = CSS_PREFIX + 'modal-body';

    content.appendChild(closeBtn);
    content.appendChild(body);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    function open() {
      overlay.classList.add(CSS_PREFIX + 'open');
      document.body.style.overflow = 'hidden';
    }

    function close() {
      overlay.classList.remove(CSS_PREFIX + 'open');
      document.body.style.overflow = '';
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay.classList.contains(CSS_PREFIX + 'open')) {
        close();
      }
    });

    return { overlay: overlay, body: body, open: open, close: close };
  }

  // ─── Initialization ──────────────────────────────────────────────────────

  function initForm(container) {
    if (container.hasAttribute(INITIALIZED_ATTR)) return;

    var embedKey = container.getAttribute('data-bloomsuite-form');
    if (!embedKey) return;

    var displayMode = container.getAttribute('data-display') || DISPLAY_MODES.INLINE;

    container.innerHTML = '<div class="' + CSS_PREFIX + 'loading"><div class="' + CSS_PREFIX + 'spinner"></div>Loading form...</div>';

    // Fetch form config
    fetch(API_BASE + '/get-form-config?embed_key=' + encodeURIComponent(embedKey))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.error) {
          showBlocked(container, 'NOT_FOUND', embedKey);
          return;
        }

        loadCSS(function() {
          if (displayMode === DISPLAY_MODES.MODAL) {
            var modal = createModal(container, data);
            renderForm(modal.body, data, embedKey);
            // Create trigger button
            var triggerBtn = document.createElement('button');
            triggerBtn.className = CSS_PREFIX + 'trigger';
            triggerBtn.textContent = getConfigSettings(data).trigger_button_text || 'Open Form';
            triggerBtn.addEventListener('click', modal.open);
            container.innerHTML = '';
            container.appendChild(triggerBtn);
            container.setAttribute(INITIALIZED_ATTR, 'true');
          } else {
            renderForm(container, data, embedKey);
          }
        });
      })
      .catch(function(err) {
        log('Error loading form', err);
        showBlocked(container, 'TIMEOUT', embedKey);
      });
  }

  function initAll() {
    var containers = document.querySelectorAll('[data-bloomsuite-form]:not([' + INITIALIZED_ATTR + '])');
    containers.forEach(initForm);
  }

  // ─── Auto-init ───────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Watch for dynamically added forms
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            if (node.hasAttribute && node.hasAttribute('data-bloomsuite-form')) {
              initForm(node);
            }
            var nested = node.querySelectorAll && node.querySelectorAll('[data-bloomsuite-form]');
            if (nested) nested.forEach(initForm);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Expose API
  window.BloomSuite = {
    init: initAll,
    initForm: initForm,
    version: SCRIPT_VERSION
  };

})(window, document);`;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Serve the JavaScript file
  return new Response(EMBED_JS, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      Deprecation: "true",
      Link: `<${STATIC_EMBED_RUNTIME_URL}>; rel="successor-version"`,
      "X-Embed-Version": EMBED_VERSION,
      "X-BloomSuite-Deprecated":
        "serve-embed-js is deprecated; use the storage-hosted embed runtime",
      "X-BloomSuite-Successor": STATIC_EMBED_RUNTIME_URL,
    },
  });
});
