import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Globe, 
  Code, 
  Copy, 
  Check, 
  AlertTriangle, 
  ExternalLink,
  Loader2,
  Send
} from 'lucide-react';
import { Form } from '@/types/formBuilder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface FormPublishTabProps {
  form: Form;
  hasChanges: boolean;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function FormPublishTab({ form, hasChanges, onSave, isSaving }: FormPublishTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isPublished = form.status === 'published';
  const formUrl = `${window.location.origin}/f/${form.embed_key}`;
  
  const embedCode = `<iframe 
  src="${formUrl}" 
  width="100%" 
  height="500" 
  frameborder="0"
  style="border: none; max-width: 500px;"
></iframe>`;

  const handlePublish = async () => {
    if (hasChanges) {
      toast({
        title: 'Save changes first',
        description: 'Please save your changes before publishing.',
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

  const copyToClipboard = async (text: string, type: 'embed' | 'link') => {
    await navigator.clipboard.writeText(text);
    if (type === 'embed') {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
    toast({
      title: 'Copied!',
      description: type === 'embed' ? 'Embed code copied to clipboard' : 'Link copied to clipboard',
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

          <div className="flex items-center gap-4">
            {isPublished ? (
              <Button 
                variant="outline" 
                onClick={handleUnpublish}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Unpublish
              </Button>
            ) : (
              <Button 
                onClick={handlePublish}
                disabled={isPublishing || hasChanges}
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

      {/* Share Options */}
      {isPublished && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Direct Link</CardTitle>
              <CardDescription>
                Share this link directly with your audience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={formUrl} readOnly />
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(formUrl, 'link')}
                >
                  {copiedLink ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

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
              <div className="space-y-3">
                <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                  <code>{embedCode}</code>
                </pre>
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(embedCode, 'embed')}
                >
                  {copiedEmbed ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Embed Code
                    </>
                  )}
                </Button>
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
