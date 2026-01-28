/**
 * BloomSuite Forms Embed Script
 * Lightweight loader that renders forms and handles submissions
 */
(function() {
  'use strict';

  // Configuration
  const API_BASE = window.BLOOMSUITE_API_BASE || 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1';
  
  // Styles for the embedded form
  const FORM_STYLES = `
    .bloomsuite-form {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 100%;
      box-sizing: border-box;
    }
    .bloomsuite-form * {
      box-sizing: border-box;
    }
    .bloomsuite-form-field {
      margin-bottom: 16px;
    }
    .bloomsuite-form-label {
      display: block;
      font-weight: 500;
      margin-bottom: 6px;
      font-size: 14px;
      color: #374151;
    }
    .bloomsuite-form-label .required {
      color: #ef4444;
      margin-left: 2px;
    }
    .bloomsuite-form-input,
    .bloomsuite-form-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: var(--bs-radius, 8px);
      font-size: 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: white;
    }
    .bloomsuite-form-input:focus,
    .bloomsuite-form-select:focus {
      outline: none;
      border-color: var(--bs-primary, #22C55E);
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
    }
    .bloomsuite-form-checkbox-wrapper {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .bloomsuite-form-checkbox {
      width: 18px;
      height: 18px;
      margin-top: 2px;
      accent-color: var(--bs-primary, #22C55E);
    }
    .bloomsuite-form-checkbox-label {
      font-size: 14px;
      color: #4b5563;
      line-height: 1.4;
    }
    .bloomsuite-form-submit {
      width: 100%;
      padding: 12px 24px;
      background-color: var(--bs-primary, #22C55E);
      color: white;
      border: none;
      border-radius: var(--bs-radius, 8px);
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s, transform 0.1s;
    }
    .bloomsuite-form-submit:hover {
      background-color: var(--bs-primary-hover, #16a34a);
    }
    .bloomsuite-form-submit:active {
      transform: scale(0.98);
    }
    .bloomsuite-form-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .bloomsuite-form-error {
      color: #ef4444;
      font-size: 13px;
      margin-top: 4px;
    }
    .bloomsuite-form-success {
      text-align: center;
      padding: 24px;
      background: #f0fdf4;
      border-radius: var(--bs-radius, 8px);
      border: 1px solid #bbf7d0;
    }
    .bloomsuite-form-success-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 12px;
      background: #22C55E;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bloomsuite-form-success-icon svg {
      width: 24px;
      height: 24px;
      color: white;
    }
    .bloomsuite-form-success-message {
      font-size: 16px;
      color: #166534;
      font-weight: 500;
    }
    .bloomsuite-form-loading {
      text-align: center;
      padding: 40px;
      color: #6b7280;
    }
    .bloomsuite-form-branding {
      text-align: center;
      margin-top: 16px;
      font-size: 12px;
      color: #9ca3af;
    }
    .bloomsuite-form-branding a {
      color: #6b7280;
      text-decoration: none;
    }
    .bloomsuite-form-branding a:hover {
      text-decoration: underline;
    }
    .bloomsuite-honeypot {
      position: absolute;
      left: -9999px;
      opacity: 0;
      pointer-events: none;
    }
  `;

  /**
   * Inject styles into the page
   */
  function injectStyles() {
    if (document.getElementById('bloomsuite-form-styles')) return;
    const style = document.createElement('style');
    style.id = 'bloomsuite-form-styles';
    style.textContent = FORM_STYLES;
    document.head.appendChild(style);
  }

  /**
   * Fetch form configuration
   */
  async function fetchFormConfig(embedKey) {
    const response = await fetch(`${API_BASE}/get-form-config?embed_key=${embedKey}`);
    if (!response.ok) {
      throw new Error('Form not found');
    }
    return response.json();
  }

  /**
   * Submit form data
   */
  async function submitForm(embedKey, data, meta) {
    const response = await fetch(`${API_BASE}/submit-form`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embed_key: embedKey,
        data,
        meta,
        honeypot: data._hp_field,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Submission failed');
    }
    
    return result;
  }

  /**
   * Render a form field
   */
  function renderField(field, theme) {
    const wrapper = document.createElement('div');
    wrapper.className = 'bloomsuite-form-field';

    // Skip hidden fields in visible render
    if (field.type === 'hidden') {
      wrapper.innerHTML = `<input type="hidden" name="${field.id}" value="${field.default_value || ''}">`;
      return wrapper;
    }

    // Consent checkboxes
    if (field.type === 'email_consent' || field.type === 'sms_consent') {
      wrapper.innerHTML = `
        <div class="bloomsuite-form-checkbox-wrapper">
          <input type="checkbox" id="field-${field.id}" name="${field.id}" class="bloomsuite-form-checkbox" ${field.required ? 'required' : ''}>
          <label for="field-${field.id}" class="bloomsuite-form-checkbox-label">
            ${field.label}${field.required ? ' <span class="required">*</span>' : ''}
          </label>
        </div>
      `;
      return wrapper;
    }

    // Checkbox field
    if (field.type === 'checkbox') {
      wrapper.innerHTML = `
        <div class="bloomsuite-form-checkbox-wrapper">
          <input type="checkbox" id="field-${field.id}" name="${field.id}" class="bloomsuite-form-checkbox">
          <label for="field-${field.id}" class="bloomsuite-form-checkbox-label">${field.label}</label>
        </div>
      `;
      return wrapper;
    }

    // Label
    const label = document.createElement('label');
    label.className = 'bloomsuite-form-label';
    label.htmlFor = `field-${field.id}`;
    label.innerHTML = `${field.label}${field.required ? ' <span class="required">*</span>' : ''}`;
    wrapper.appendChild(label);

    // Select field
    if (field.type === 'select') {
      const select = document.createElement('select');
      select.className = 'bloomsuite-form-select';
      select.id = `field-${field.id}`;
      select.name = field.id;
      if (field.required) select.required = true;

      select.innerHTML = `<option value="">${field.placeholder || 'Select an option'}</option>`;
      (field.options || []).forEach(opt => {
        select.innerHTML += `<option value="${opt}">${opt}</option>`;
      });
      wrapper.appendChild(select);
      return wrapper;
    }

    // Input fields (email, text, phone)
    const input = document.createElement('input');
    input.className = 'bloomsuite-form-input';
    input.id = `field-${field.id}`;
    input.name = field.id;
    input.placeholder = field.placeholder || '';
    if (field.required) input.required = true;

    switch (field.type) {
      case 'email':
        input.type = 'email';
        break;
      case 'phone':
        input.type = 'tel';
        break;
      default:
        input.type = 'text';
    }

    wrapper.appendChild(input);
    return wrapper;
  }

  /**
   * Render the complete form
   */
  function renderForm(container, config, embedKey) {
    const { form } = config;
    const { fields, settings, compliance } = form;
    const theme = settings.theme || {};

    // Apply theme CSS variables
    container.style.setProperty('--bs-primary', theme.primary_color || '#22C55E');
    container.style.setProperty('--bs-primary-hover', adjustColor(theme.primary_color || '#22C55E', -20));
    container.style.setProperty('--bs-radius', theme.border_radius || '8px');

    const formEl = document.createElement('form');
    formEl.className = 'bloomsuite-form';
    formEl.noValidate = true;

    // Honeypot field for spam detection
    formEl.innerHTML = `
      <div class="bloomsuite-honeypot">
        <input type="text" name="_hp_field" tabindex="-1" autocomplete="off">
      </div>
    `;

    // Render each field
    fields.forEach(field => {
      formEl.appendChild(renderField(field, theme));
    });

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'bloomsuite-form-submit';
    submitBtn.textContent = settings.submit_button_text || 'Submit';

    // Apply button style
    if (theme.button_style === 'outline') {
      submitBtn.style.background = 'transparent';
      submitBtn.style.border = `2px solid ${theme.primary_color || '#22C55E'}`;
      submitBtn.style.color = theme.primary_color || '#22C55E';
    } else if (theme.button_style === 'rounded') {
      submitBtn.style.borderRadius = '9999px';
    }

    formEl.appendChild(submitBtn);

    // Branding
    if (settings.show_branding !== false) {
      const branding = document.createElement('div');
      branding.className = 'bloomsuite-form-branding';
      branding.innerHTML = 'Powered by <a href="https://bloomsuite.com" target="_blank" rel="noopener">BloomSuite</a>';
      formEl.appendChild(branding);
    }

    // Form submission handler
    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(formEl);
      const data = {};
      for (const [key, value] of formData.entries()) {
        // Handle checkboxes
        const input = formEl.querySelector(`[name="${key}"]`);
        if (input && input.type === 'checkbox') {
          data[key] = input.checked;
        } else {
          data[key] = value;
        }
      }

      // Collect metadata
      const meta = {
        page_url: window.location.href,
        referrer: document.referrer,
        utm_source: getUrlParam('utm_source'),
        utm_medium: getUrlParam('utm_medium'),
        utm_campaign: getUrlParam('utm_campaign'),
      };

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        const result = await submitForm(embedKey, data, meta);
        
        // Show success message
        container.innerHTML = `
          <div class="bloomsuite-form-success">
            <div class="bloomsuite-form-success-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div class="bloomsuite-form-success-message">${result.message}</div>
          </div>
        `;

        // Redirect if configured
        if (result.redirect_url) {
          setTimeout(() => {
            window.location.href = result.redirect_url;
          }, 1500);
        }
      } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = settings.submit_button_text || 'Submit';
        
        // Show error
        let errorDiv = formEl.querySelector('.bloomsuite-form-error');
        if (!errorDiv) {
          errorDiv = document.createElement('div');
          errorDiv.className = 'bloomsuite-form-error';
          formEl.insertBefore(errorDiv, submitBtn);
        }
        errorDiv.textContent = error.message || 'Submission failed. Please try again.';
      }
    });

    container.innerHTML = '';
    container.appendChild(formEl);
  }

  /**
   * Initialize a form container
   */
  async function initForm(container) {
    const embedKey = container.dataset.bloomsuiteForm;
    if (!embedKey) return;

    // Show loading state
    container.innerHTML = '<div class="bloomsuite-form-loading">Loading form...</div>';

    try {
      const config = await fetchFormConfig(embedKey);
      renderForm(container, config, embedKey);
    } catch (error) {
      console.error('[BloomSuite] Failed to load form:', error);
      container.innerHTML = '<div class="bloomsuite-form-error">Failed to load form</div>';
    }
  }

  /**
   * Utility: Get URL parameter
   */
  function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || null;
  }

  /**
   * Utility: Adjust color brightness
   */
  function adjustColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
  }

  /**
   * Initialize all forms on the page
   */
  function init() {
    injectStyles();
    const containers = document.querySelectorAll('[data-bloomsuite-form]');
    containers.forEach(initForm);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual initialization
  window.BloomSuiteForms = { init, initForm };
})();
