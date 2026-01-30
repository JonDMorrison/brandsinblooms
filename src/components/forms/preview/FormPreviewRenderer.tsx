import React, { useState, useMemo } from 'react';
import { FormField, FormSettings, FormCompliance, FormTheme } from '@/types/formBuilder';
import { Check, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormPreviewRendererProps {
  fields: FormField[];
  settings: FormSettings;
  compliance: FormCompliance;
  mode?: 'preview' | 'embed';
  onSubmit?: (data: Record<string, any>) => void;
  changedIds?: Set<string>;
}

// Extended settings interface matching FormDesignTab
interface ExtendedSettings extends FormSettings {
  form_title?: string;
  form_description?: string;
  form_headline?: string;
  form_subheadline?: string;
  form_width?: 'narrow' | 'medium' | 'wide' | 'full';
  label_position?: 'above' | 'inline' | 'floating';
  columns?: number;
  theme: ExtendedTheme;
}

interface ExtendedTheme extends FormTheme {
  secondary_color?: string;
  text_color?: string;
  background_color?: string;
  input_style?: 'default' | 'underline' | 'filled';
}

const SPACING_MAP: Record<string, string> = {
  compact: '12px',
  normal: '16px',
  relaxed: '24px',
};

const WIDTH_MAP: Record<string, string> = {
  narrow: '400px',
  medium: '500px',
  wide: '600px',
  full: '100%',
};

export function FormPreviewRenderer({
  fields,
  settings,
  compliance,
  mode = 'preview',
  onSubmit,
  changedIds = new Set(),
}: FormPreviewRendererProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const extSettings = settings as ExtendedSettings;
  const theme = extSettings.theme || {};

  // Compute CSS variables from theme
  const cssVars = useMemo(() => ({
    '--bs-form-primary': theme.primary_color || '#22C55E',
    '--bs-form-primary-hover': adjustColor(theme.primary_color || '#22C55E', -15),
    '--bs-form-radius': theme.border_radius || '8px',
    '--bs-form-spacing': SPACING_MAP[theme.spacing || 'normal'] || '16px',
    '--bs-form-text': theme.text_color || '#1f2937',
    '--bs-form-bg': theme.background_color || '#ffffff',
    '--bs-form-font': theme.font_family || 'inherit',
  } as React.CSSProperties), [theme]);

  const containerWidth = WIDTH_MAP[extSettings.form_width || 'medium'] || '500px';

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error when user types
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      const value = formData[field.id];

      if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
        newErrors[field.id] = 'This field is required';
      }

      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors[field.id] = 'Please enter a valid email';
      }

      if (field.type === 'phone' && value && !/^[\d\s\-+()]+$/.test(value)) {
        newErrors[field.id] = 'Please enter a valid phone number';
      }
    });

    // Check consent fields
    if (compliance.email_consent_required && !formData['__email_consent']) {
      newErrors['__email_consent'] = 'Email consent is required';
    }
    if (compliance.sms_consent_required && !formData['__sms_consent']) {
      newErrors['__sms_consent'] = 'SMS consent is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (mode === 'preview') {
      // In preview mode, just show success state
      setIsSubmitted(true);
    } else if (onSubmit) {
      onSubmit(formData);
    }
  };

  const resetPreview = () => {
    setIsSubmitted(false);
    setFormData({});
    setErrors({});
  };

  // Check if any email/sms consent is needed
  const hasEmailField = fields.some((f) => f.type === 'email');
  const hasPhoneField = fields.some((f) => f.type === 'phone');
  const showEmailConsent = hasEmailField && compliance.email_consent_text;
  const showSmsConsent = hasPhoneField && compliance.sms_consent_text;
  const hasAnyConsent = showEmailConsent || showSmsConsent;

  // Check if any fields are required
  const hasRequiredFields = fields.some((f) => f.required) || 
    compliance.email_consent_required || 
    compliance.sms_consent_required;

  if (isSubmitted) {
    return (
      <div
        className="bs-form-container"
        style={{ ...cssVars, maxWidth: containerWidth, margin: '0 auto' }}
      >
        <div className="bs-form-success">
          <div className="bs-form-success-icon">
            <Check className="w-7 h-7 text-white" />
          </div>
          <p className="bs-form-success-text">{settings.success_message}</p>
        </div>
        {mode === 'preview' && (
          <button
            type="button"
            onClick={resetPreview}
            className="mt-4 text-sm text-muted-foreground underline hover:no-underline block mx-auto"
          >
            Reset preview
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="bs-form-container"
      style={{ ...cssVars, maxWidth: containerWidth, margin: '0 auto' }}
    >
      <form onSubmit={handleSubmit} className="bs-form-wrapper" noValidate>
        {/* Headline (H2) & Subheadline (H4) - Main message above the form */}
        {(extSettings.form_headline || extSettings.form_subheadline) && (
          <div 
            className={cn(
              "bs-form-headline-section text-center transition-all duration-300",
              changedIds.has('__headline') && "ring-2 ring-primary/50 ring-offset-2 rounded-md"
            )} 
            style={{ marginBottom: 'var(--bs-form-spacing)' }}
          >
            {extSettings.form_headline && (
              <h2
                className="bs-form-headline"
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  marginBottom: extSettings.form_subheadline ? '0.5rem' : '0',
                  color: 'var(--bs-form-text)',
                  lineHeight: 1.3,
                }}
              >
                {extSettings.form_headline}
              </h2>
            )}
            {extSettings.form_subheadline && (
              <h4
                className="bs-form-subheadline"
                style={{ 
                  fontSize: '1rem',
                  fontWeight: 400,
                  color: '#6b7280',
                  lineHeight: 1.4,
                }}
              >
                {extSettings.form_subheadline}
              </h4>
            )}
          </div>
        )}

        {/* Form Title & Description */}
        {(extSettings.form_title || extSettings.form_description) && (
          <div 
            className={cn(
              "bs-form-header transition-all duration-300",
              changedIds.has('__settings') && "ring-2 ring-primary/50 ring-offset-2 rounded-md"
            )} 
            style={{ marginBottom: 'var(--bs-form-spacing)' }}
          >
            {extSettings.form_title && (
              <h3
                className="bs-form-title"
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--bs-form-text)',
                }}
              >
                {extSettings.form_title}
              </h3>
            )}
            {extSettings.form_description && (
              <p
                className="bs-form-description"
                style={{ fontSize: '0.875rem', color: '#6b7280' }}
              >
                {extSettings.form_description}
              </p>
            )}
          </div>
        )}

        {/* Preview Helper Text - Required Fields Indicator */}
        {mode === 'preview' && hasRequiredFields && (
          <p className="text-xs text-muted-foreground mb-4" style={{ fontStyle: 'italic' }}>
            Fields marked with <span className="text-destructive">*</span> are required
          </p>
        )}

        {/* Form Fields */}
        <div
          className="bs-form-fields"
          style={{
            display: 'grid',
            gridTemplateColumns: extSettings.columns === 2 ? 'repeat(2, 1fr)' : '1fr',
            gap: 'var(--bs-form-spacing)',
          }}
        >
          {fields
            .filter((f) => f.type !== 'hidden' && f.type !== 'email_consent' && f.type !== 'sms_consent')
            .map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={formData[field.id] || ''}
                onChange={(val) => handleInputChange(field.id, val)}
                error={errors[field.id]}
                theme={theme}
                labelPosition={extSettings.label_position}
                isHighlighted={changedIds.has(field.id)}
              />
            ))}
        </div>

        {/* Marketing Permissions Section */}
        {hasAnyConsent && (
          <div 
            className={cn(
              "bs-form-consents-section mt-5 p-4 rounded-lg transition-all duration-300",
              changedIds.has('__compliance') && "ring-2 ring-primary/50 ring-offset-2"
            )}
            style={{ 
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Marketing Permissions</h3>
            </div>
            <div className="space-y-2">
              {showEmailConsent && (
                <ConsentCheckbox
                  id="__email_consent"
                  text={compliance.email_consent_text}
                  required={compliance.email_consent_required}
                  checked={!!formData['__email_consent']}
                  onChange={(checked) => handleInputChange('__email_consent', checked)}
                  error={errors['__email_consent']}
                  theme={theme}
                />
              )}
              {showSmsConsent && (
                <ConsentCheckbox
                  id="__sms_consent"
                  text={compliance.sms_consent_text}
                  required={compliance.sms_consent_required}
                  checked={!!formData['__sms_consent']}
                  onChange={(checked) => handleInputChange('__sms_consent', checked)}
                  error={errors['__sms_consent']}
                  theme={theme}
                />
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className={cn(
            getButtonClasses(theme.button_style),
            changedIds.has('__settings') && "ring-2 ring-primary/50 ring-offset-2"
          )}
          style={{
            marginTop: 'var(--bs-form-spacing)',
            backgroundColor:
              theme.button_style === 'outline' ? 'transparent' : 'var(--bs-form-primary)',
            borderColor: 'var(--bs-form-primary)',
            color: theme.button_style === 'outline' ? 'var(--bs-form-primary)' : '#ffffff',
            borderRadius:
              theme.button_style === 'rounded' ? '9999px' : 'var(--bs-form-radius)',
          }}
        >
          {settings.submit_button_text || 'Submit'}
        </button>

        {/* Preview Helper Text - Privacy Notice */}
        {mode === 'preview' && (
          <p className="text-xs text-muted-foreground text-center mt-4" style={{ fontStyle: 'italic' }}>
            We respect your privacy. Unsubscribe anytime.
          </p>
        )}

        {/* Branding */}
        {settings.show_branding && (
          <div className="bs-form-branding" style={{ marginTop: '16px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              Powered by{' '}
              <a
                href="https://bloomsuite.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#6b7280', textDecoration: 'none' }}
              >
                BloomSuite
              </a>
            </span>
          </div>
        )}
      </form>
    </div>
  );
}

// Field Renderer Component
interface FieldRendererProps {
  field: FormField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  theme: ExtendedTheme;
  labelPosition?: 'above' | 'inline' | 'floating';
  isHighlighted?: boolean;
}

function FieldRenderer({ field, value, onChange, error, theme, labelPosition = 'above', isHighlighted }: FieldRendererProps) {
  const inputClasses = getInputClasses(theme.input_style, !!error);

  const label = (
    <label
      htmlFor={field.id}
      className="bs-form-label"
      style={{
        display: 'block',
        fontWeight: 500,
        fontSize: '14px',
        color: 'var(--bs-form-text)',
        marginBottom: labelPosition === 'above' ? '6px' : '0',
      }}
    >
      {field.label}
      {field.required && <span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span>}
    </label>
  );

  const renderInput = () => {
    switch (field.type) {
      case 'select':
        return (
          <select
            id={field.id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
            style={getInputStyles(theme)}
          >
            <option value="">{field.placeholder || 'Select an option'}</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <div className="bs-form-checkbox-wrap" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <input
              type="checkbox"
              id={field.id}
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="bs-form-checkbox"
              style={{
                flexShrink: 0,
                width: '18px',
                height: '18px',
                marginTop: '2px',
                accentColor: 'var(--bs-form-primary)',
              }}
            />
            <label htmlFor={field.id} className="bs-form-checkbox-text" style={{ fontSize: '14px', color: '#4b5563' }}>
              {field.label}
              {field.required && <span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span>}
            </label>
          </div>
        );

      case 'phone':
        return (
          <input
            type="tel"
            id={field.id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClasses}
            style={getInputStyles(theme)}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            id={field.id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClasses}
            style={getInputStyles(theme)}
          />
        );

      default:
        return (
          <input
            type="text"
            id={field.id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClasses}
            style={getInputStyles(theme)}
          />
        );
    }
  };

  if (field.type === 'checkbox') {
    return (
      <div 
        className={cn(
          "bs-form-field transition-all duration-300",
          isHighlighted && "ring-2 ring-primary/50 ring-offset-2 rounded-md p-2 -m-2"
        )}
      >
        {renderInput()}
        {error && <p className="bs-form-error-msg" style={{ color: '#dc2626', fontSize: '13px', marginTop: '6px' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "bs-form-field transition-all duration-300",
        isHighlighted && "ring-2 ring-primary/50 ring-offset-2 rounded-md p-2 -m-2"
      )}
    >
      {label}
      {renderInput()}
      {error && <p className="bs-form-error-msg" style={{ color: '#dc2626', fontSize: '13px', marginTop: '6px' }}>{error}</p>}
    </div>
  );
}

// Consent Checkbox Component
interface ConsentCheckboxProps {
  id: string;
  text: string;
  required: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  theme: ExtendedTheme;
}

function ConsentCheckbox({ id, text, required, checked, onChange, error, theme }: ConsentCheckboxProps) {
  return (
    <div
      className="bs-form-consent"
      style={{
        padding: '8px 0',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <div className="bs-form-checkbox-wrap" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="bs-form-checkbox"
          style={{
            flexShrink: 0,
            width: '16px',
            height: '16px',
            marginTop: '2px',
            accentColor: 'var(--bs-form-primary)',
          }}
        />
        <label 
          htmlFor={id} 
          className="bs-form-checkbox-text" 
          style={{ 
            fontSize: '12px', 
            color: '#6b7280',
            lineHeight: 1.4,
          }}
        >
          {text}
          {required && <span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span>}
        </label>
      </div>
      {error && <p className="bs-form-error-msg" style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px', marginLeft: '26px' }}>{error}</p>}
    </div>
  );
}

// Helper Functions
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function getInputClasses(style?: string, hasError?: boolean): string {
  const base = 'bs-form-input';
  return `${base}${hasError ? ' bs-form-input-error' : ''}`;
}

function getInputStyles(theme: ExtendedTheme): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    lineHeight: 1.5,
    color: 'var(--bs-form-text)',
    backgroundColor: theme.input_style === 'filled' ? '#f3f4f6' : '#ffffff',
    border: theme.input_style === 'underline' ? 'none' : '1px solid #d1d5db',
    borderBottom: theme.input_style === 'underline' ? '2px solid #d1d5db' : undefined,
    borderRadius: theme.input_style === 'underline' ? '0' : 'var(--bs-form-radius)',
    fontFamily: 'var(--bs-form-font)',
  };
  return base;
}

function getButtonClasses(style?: string): string {
  const base = 'bs-form-submit';
  return `${base} w-full py-3 px-4 font-medium text-sm border-2 transition-all duration-200 hover:opacity-90`;
}

export default FormPreviewRenderer;
