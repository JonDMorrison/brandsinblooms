import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Globe, 
  Code, 
  Copy, 
  Check, 
  AlertTriangle, 
  ExternalLink,
  Loader2,
  Send,
  FileCode,
  BookOpen,
  Shield,
  Zap,
  AlertCircle
} from 'lucide-react';
import { Form, FormField } from '@/types/formBuilder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface FormPublishTabProps {
  form: Form;
  fields: FormField[];
  hasChanges: boolean;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

// Fix 5: Pre-publish validation
function validateForPublish(fields: FormField[]): string[] {
  const errors: string[] = [];
  
  if (fields.length === 0) {
    errors.push('Form must have at least one field');
  }
  
  if (!fields.some(f => f.type === 'email')) {
    errors.push('Form must have an email field (required for customer identification)');
  }
  
  const hasSmsConsent = fields.some(f => f.type === 'sms_consent');
  const hasPhone = fields.some(f => f.type === 'phone');
  if (hasSmsConsent && !hasPhone) {
    errors.push('SMS consent field requires a phone field to be present');
  }
  
  return errors;
}

export function FormPublishTab({ form, fields, hasChanges, onSave, isSaving }: FormPublishTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const isPublished = form.status === 'published';
  // Fix 8: Use window.location.origin instead of hardcoded domain
  const publishedDomain = window.location.origin;
  const formUrl = `${publishedDomain}/f/${form.embed_key}`;
  const embedKey = form.embed_key;
  
  // Fix 5: Validation errors
  const validationErrors = useMemo(() => validateForPublish(fields), [fields]);
  const canPublish = validationErrors.length === 0 && !hasChanges;
  
  // Embed code snippets use published domain for stable embedding
  const iframeCode = `<iframe 
  src="${formUrl}" 
  width="100%" 
  height="500" 
  frameborder="0"
  style="border: none; max-width: 500px;"
></iframe>`;

  // Supabase Edge Function URL for embed script
  const embedScriptUrl = `${import.meta.env.VITE_SUPABASE_URL || 'https://udldmkqwnxhdeztyqcau.supabase.co'}/functions/v1/serve-embed-js`;
  
  const jsEmbedCode = `<!-- BloomSuite Form Embed -->
<div data-bloomsuite-form="${embedKey}"></div>
<script src="${embedScriptUrl}" async></script>`;

  const reactCode = `// React Component
import { useEffect } from 'react';

export function BloomSuiteForm() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${embedScriptUrl}';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  return <div data-bloomsuite-form="${embedKey}" />;
}`;

  const handlePublish = async () => {
    if (hasChanges) {
      toast({
        title: 'Save changes first',
        description: 'Please save your changes before publishing.',
        variant: 'destructive',
      });
      return;
    }

    if (validationErrors.length > 0) {
      toast({
        title: 'Cannot publish',
        description: 'Please fix the validation errors first.',
        variant: 'destructive',
      });
      return;
    }

    setIsPublishing(true);
    try {
      const { error } = await supabase
        .from('forms')
        .update({ status: 'published' })
        .eq('id', form.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['form', form.id] });
      queryClient.invalidateQueries({ queryKey: ['forms'] });

      toast({
        title: 'Form published!',
        description: 'Your form is now live and accepting submissions.',
      });
    } catch (err: any) {
      toast({
        title: 'Error publishing form',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setIsPublishing(true);
    try {
      const { error } = await supabase
        .from('forms')
        .update({ status: 'draft' })
        .eq('id', form.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['form', form.id] });
      queryClient.invalidateQueries({ queryKey: ['forms'] });

      toast({
        title: 'Form unpublished',
        description: 'Your form is now a draft and no longer accepting submissions.',
      });
    } catch (err: any) {
      toast({
        title: 'Error unpublishing form',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 2000);
    toast({
      title: 'Copied!',
      description: 'Code copied to clipboard.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Publish Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Publish Status
            </span>
            <Badge 
              variant={isPublished ? 'default' : 'secondary'}
              className={isPublished ? 'bg-green-100 text-green-800' : ''}
            >
              {isPublished ? 'Published' : 'Draft'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasChanges && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You have unsaved changes. Save before publishing.
              </AlertDescription>
            </Alert>
          )}

          {/* Fix 5: Show validation errors */}
          {!isPublished && validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-1">Cannot publish — fix these issues:</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-4">
            {isPublished ? (
              <Button 
                variant="outline" 
                onClick={handleUnpublish}
                disabled={isPublishing}
              >
                {isPublishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Unpublish
              </Button>
            ) : (
              <Button 
                onClick={handlePublish}
                disabled={isPublishing || !canPublish}
              >
                {isPublishing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-2" />
                )}
                Publish Form
              </Button>
            )}

            {isPublished && (
              <Button variant="outline" asChild>
                <a href={formUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Live Form
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Share & Embed Options */}
      {isPublished && (
        <>
          {/* Direct Link */}
          <Card>
            <CardHeader>
              <CardTitle>Direct Link</CardTitle>
              <CardDescription>
                Share this link directly with your audience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={formUrl} readOnly className="font-mono text-sm" />
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(formUrl, 'link')}
                >
                  {copiedItem === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Embed Code Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Embed Code
              </CardTitle>
              <CardDescription>
                Add this code to your website to embed the form
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="iframe" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="iframe" className="flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    iFrame
                  </TabsTrigger>
                  <TabsTrigger value="js" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    JavaScript
                  </TabsTrigger>
                  <TabsTrigger value="react" className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    React
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="iframe" className="mt-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <Check className="h-4 w-4 text-primary mt-0.5" />
                      <div className="text-sm text-foreground">
                        <strong>Recommended:</strong> Simple to add - just paste the code. Works on most websites.
                      </div>
                    </div>
                    <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                      <code>{iframeCode}</code>
                    </pre>
                    <Button 
                      variant="outline" 
                      onClick={() => copyToClipboard(iframeCode, 'iframe')}
                    >
                      {copiedItem === 'iframe' ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      Copy Code
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="js" className="mt-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 p-3 bg-muted border border-border rounded-lg">
                      <Zap className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="text-sm text-muted-foreground">
                        <strong>Advanced:</strong> Inline rendering, better performance. Requires CSP configuration on some websites.
                      </div>
                    </div>
                    <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                      <code>{jsEmbedCode}</code>
                    </pre>
                    <Button 
                      variant="outline" 
                      onClick={() => copyToClipboard(jsEmbedCode, 'js')}
                    >
                      {copiedItem === 'js' ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      Copy Code
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="react" className="mt-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 p-3 bg-muted border border-border rounded-lg">
                      <Code className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="text-sm text-muted-foreground">
                        <strong>Developers:</strong> For React/Next.js applications.
                      </div>
                    </div>
                    <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                      <code>{reactCode}</code>
                    </pre>
                    <Button 
                      variant="outline" 
                      onClick={() => copyToClipboard(reactCode, 'react')}
                    >
                      {copiedItem === 'react' ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      Copy Code
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Integration Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Integration Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    Consent & Compliance
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Consent checkboxes are never pre-checked</li>
                    <li>• All consent proofs stored in database</li>
                    <li>• CASL & TCPA compliant by default</li>
                    <li>• Existing opt-ins never downgraded</li>
                  </ul>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-blue-600" />
                    Features
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Automatic UTM parameter capture</li>
                    <li>• Spam protection with honeypot</li>
                    <li>• Rate limiting (5/min per IP)</li>
                    <li>• Real-time submission tracking</li>
                  </ul>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Content Security Policy (CSP)</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  If your site uses CSP and you're using the JavaScript embed, add these directives:
                </p>
                <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                  <code>{`script-src 'self' ${import.meta.env.VITE_SUPABASE_URL || 'https://udldmkqwnxhdeztyqcau.supabase.co'};`}</code>
                  {'\n'}
                  <code>{`connect-src 'self' ${import.meta.env.VITE_SUPABASE_URL || 'https://udldmkqwnxhdeztyqcau.supabase.co'};`}</code>
                  {'\n'}
                  <code>{`frame-src 'self' ${window.location.hostname};`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Test Submission */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test Submission
          </CardTitle>
          <CardDescription>
            Submit a test entry to verify your form works correctly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {isPublished 
              ? 'Click the button below to open your form in a new tab and test it.'
              : 'Publish your form first to test submissions.'
            }
          </p>
          <Button 
            variant="outline" 
            disabled={!isPublished}
            asChild={isPublished}
          >
            {isPublished ? (
              <a href={formUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Form for Testing
              </a>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Publish to Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
