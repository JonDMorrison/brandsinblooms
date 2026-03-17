import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { FormPreviewRenderer } from '@/components/forms/preview/FormPreviewRenderer';
import { FormField, FormSettings, FormCompliance, DEFAULT_FORM_SETTINGS, DEFAULT_FORM_COMPLIANCE } from '@/types/formBuilder';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://udldmkqwnxhdeztyqcau.supabase.co';

interface FormConfig {
  id: string;
  name: string;
  fields_json: FormField[];
  settings_json: FormSettings;
  compliance_json: FormCompliance;
  tenant_id: string;
}

export default function PublicFormPage() {
  const { embedKey } = useParams<{ embedKey: string }>();
  const [form, setForm] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!embedKey) {
      setError('Invalid form link');
      setLoading(false);
      return;
    }

    const fetchForm = async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/get-form-config?embed_key=${embedKey}`
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

  const handleSubmit = async (formData: Record<string, any>) => {
    if (!form || !embedKey) return;

    // Include hidden field default values in submission
    const enrichedData = { ...formData };
    form.fields_json.forEach(field => {
      if (field.type === 'hidden' && field.default_value) {
        enrichedData[field.mapping_key || field.id] = field.default_value;
      }
    });

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/submit-form`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embed_key: embedKey,
            data: enrichedData,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !form) {
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

  const formSettings = form.settings_json || DEFAULT_FORM_SETTINGS;
  const formCompliance = form.compliance_json || DEFAULT_FORM_COMPLIANCE;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <FormPreviewRenderer
          fields={form.fields_json || []}
          settings={formSettings}
          compliance={formCompliance}
          mode="embed"
          onSubmit={handleSubmit}
          isSubmitting={submitting}
        />
        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
