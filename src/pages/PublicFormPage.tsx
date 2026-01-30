import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface FormConfig {
  id: string;
  name: string;
  fields_json: any[];
  settings_json: any;
  compliance_json: any;
  tenant_id: string;
}

export default function PublicFormPage() {
  const { embedKey } = useParams<{ embedKey: string }>();
  const [form, setForm] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!embedKey) {
      setError('Invalid form link');
      setLoading(false);
      return;
    }

    const fetchForm = async () => {
      try {
        const response = await fetch(
          `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/get-form-config?key=${embedKey}`
        );
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Form not found');
        }

        const data = await response.json();
        setForm(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load form');
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [embedKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !embedKey) return;

    setSubmitting(true);
    try {
      const response = await fetch(
        'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/submit-form',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embed_key: embedKey,
            data: formData,
            page_url: window.location.href,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      setSubmitted(true);
      
      // Handle redirect if configured
      if (form.settings_json?.success_redirect_url) {
        window.location.href = form.settings_json.success_redirect_url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 text-center">
          <h1 className="text-xl font-semibold text-destructive mb-2">Error</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Thank You!</h1>
          <p className="text-muted-foreground">
            {form?.settings_json?.success_message || "Your submission has been received."}
          </p>
        </div>
      </div>
    );
  }

  if (!form) return null;

  const theme = form.settings_json?.theme || {};
  const primaryColor = theme.primary_color || '#22C55E';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div 
        className="max-w-md w-full bg-card border border-border rounded-lg p-6"
        style={{ '--form-primary': primaryColor } as React.CSSProperties}
      >
        <h1 className="text-2xl font-semibold text-foreground mb-6">{form.name}</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.fields_json.map((field: any) => (
            <div key={field.id} className="space-y-2">
              {field.type === 'email_consent' || field.type === 'sms_consent' ? (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required={field.required}
                    checked={formData[field.id] || false}
                    onChange={(e) => handleInputChange(field.id, e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm text-muted-foreground">
                    {field.type === 'email_consent' 
                      ? form.compliance_json?.email_consent_text || 'I agree to receive emails'
                      : form.compliance_json?.sms_consent_text || 'I agree to receive SMS messages'}
                  </span>
                </label>
              ) : (
                <>
                  <label className="block text-sm font-medium text-foreground">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <input
                    type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                    placeholder={field.placeholder}
                    required={field.required}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-md font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? 'Submitting...' : (form.settings_json?.submit_button_text || 'Submit')}
          </button>
        </form>

        {form.settings_json?.show_branding !== false && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Powered by BloomSuite
          </p>
        )}
      </div>
    </div>
  );
}
