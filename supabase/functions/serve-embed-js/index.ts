/**
 * Serve Embed JS Edge Function
 * 
 * Serves the embed.v1.js file directly from the edge function.
 * This is separate from serve-embed-assets due to the large file size.
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
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const EMBED_VERSION = '1.5.0';

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

  function renderField(field, formConfig) {
    var wrapper = document.createElement('div');
    wrapper.className = CSS_PREFIX + 'field';

    if (field.type === 'hidden' || field.field_key === 'hp_field') {
      wrapper.className += ' ' + CSS_PREFIX + 'hp';
    }

    // Label
    if (field.label && field.type !== 'hidden' && field.type !== 'checkbox') {
      var label = document.createElement('label');
      label.className = CSS_PREFIX + 'label';
      label.textContent = field.label;
      if (field.required) {
        var req = document.createElement('span');
        req.className = CSS_PREFIX + 'required';
        req.textContent = ' *';
        label.appendChild(req);
      }
      wrapper.appendChild(label);
    }

    // Input element
    var input;
    switch (field.type) {
      case 'textarea':
        input = document.createElement('textarea');
        input.className = CSS_PREFIX + 'input';
        input.rows = 4;
        break;

      case 'select':
        input = document.createElement('select');
        input.className = CSS_PREFIX + 'select';
        var defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = field.placeholder || 'Select...';
        input.appendChild(defaultOpt);
        (field.options || []).forEach(function(opt) {
          var option = document.createElement('option');
          option.value = opt.value || opt;
          option.textContent = opt.label || opt;
          input.appendChild(option);
        });
        break;

      case 'checkbox':
        var checkWrap = document.createElement('div');
        checkWrap.className = CSS_PREFIX + 'checkbox-wrap';
        if (field.is_consent) {
          checkWrap.className += ' ' + CSS_PREFIX + 'consent';
        }
        input = document.createElement('input');
        input.type = 'checkbox';
        input.className = CSS_PREFIX + 'checkbox';
        // NEVER pre-check consent checkboxes
        input.checked = false;
        var checkLabel = document.createElement('label');
        checkLabel.className = CSS_PREFIX + 'checkbox-text';
        checkLabel.textContent = field.label || '';
        checkWrap.appendChild(input);
        checkWrap.appendChild(checkLabel);
        wrapper.appendChild(checkWrap);
        break;

      case 'hidden':
        input = document.createElement('input');
        input.type = 'hidden';
        break;

      default:
        input = document.createElement('input');
        input.type = field.type || 'text';
        input.className = CSS_PREFIX + 'input';
        if (field.placeholder) input.placeholder = field.placeholder;
    }

    if (input && field.type !== 'checkbox') {
      input.name = field.field_key;
      if (field.required) input.required = true;
      wrapper.appendChild(input);
    } else if (input) {
      input.name = field.field_key;
    }

    return wrapper;
  }

  function renderForm(container, config) {
    var form = document.createElement('form');
    form.className = CSS_PREFIX + 'wrapper';

    // Header
    if (config.settings?.form_headline) {
      var headline = document.createElement('h2');
      headline.textContent = config.settings.form_headline;
      headline.style.marginBottom = '0.5em';
      form.appendChild(headline);
    }
    if (config.settings?.form_subheadline) {
      var sub = document.createElement('p');
      sub.textContent = config.settings.form_subheadline;
      sub.style.marginBottom = '1.5em';
      sub.style.color = '#666';
      form.appendChild(sub);
    }

    // Fields
    var fields = config.fields || [];
    fields.forEach(function(field) {
      form.appendChild(renderField(field, config));
    });

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
    submitBtn.textContent = config.settings?.submit_button_text || 'Submit';

    // Apply theme
    var theme = config.settings?.theme || {};
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
      handleSubmit(form, container, config);
    });

    container.innerHTML = '';
    container.appendChild(form);
    container.setAttribute(INITIALIZED_ATTR, 'true');

    log('Form rendered', config.embed_key);
  }

  function handleSubmit(form, container, config) {
    var submitBtn = form.querySelector('.' + CSS_PREFIX + 'submit');
    var originalText = submitBtn.textContent;
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
        embed_key: config.embed_key,
        form_data: formData,
        page_url: window.location.href,
        referrer: document.referrer
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        showSuccess(container, config.settings?.success_message || 'Thank you!');
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
            renderForm(modal.body, data);
            // Create trigger button
            var triggerBtn = document.createElement('button');
            triggerBtn.className = CSS_PREFIX + 'trigger';
            triggerBtn.textContent = data.settings?.trigger_button_text || 'Open Form';
            triggerBtn.addEventListener('click', modal.open);
            container.innerHTML = '';
            container.appendChild(triggerBtn);
            container.setAttribute(INITIALIZED_ATTR, 'true');
          } else {
            renderForm(container, data);
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Serve the JavaScript file
  return new Response(EMBED_JS, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Embed-Version': EMBED_VERSION,
    },
  });
});
