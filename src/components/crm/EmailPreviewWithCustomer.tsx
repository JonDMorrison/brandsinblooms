/**
 * Email Preview with Customer Selector
 * 
 * Allows previewing email content rendered with actual customer data
 * using the same server-side renderer used for sending.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui-legacy/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui-legacy/alert';
import { Badge } from '@/components/ui-legacy/badge';
import { NativeSelect } from '@/components/ui-legacy/native-select';
import { Input } from '@/components/ui-legacy/input';
import { Label } from '@/components/ui-legacy/label';
import { Loader2, AlertTriangle, User, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useQuery } from '@tanstack/react-query';

interface EmailPreviewWithCustomerProps {
  html: string;
  subject?: string;
  onRenderedPreview?: (html: string, subject: string) => void;
}

interface PreviewDiagnostics {
  usedTags: string[];
  missingTags: string[];
  emptyResolvedTags: string[];
  legacyTagsConverted: number;
}

interface CustomerOption {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}

type PreviewMode = 'sample' | 'customer';

export function EmailPreviewWithCustomer({ 
  html, 
  subject = '',
  onRenderedPreview 
}: EmailPreviewWithCustomerProps) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const [previewMode, setPreviewMode] = useState<PreviewMode>('sample');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [renderedSubject, setRenderedSubject] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<PreviewDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch customers for selector
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['crm-customers-preview', tenantId, customerSearch],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from('crm_customers')
        .select('id, email, first_name, last_name')
        .eq('tenant_id', tenantId)
        .not('email', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (customerSearch) {
        // SECURITY: [PostgREST filter injection] - Sanitize user input before interpolation into .or() filter
        const sanitizeForPostgrest = (input: string) => input.replace(/[,.()"'\\]/g, '');
        const safeSearch = sanitizeForPostgrest(customerSearch);
        query = query.or(`email.ilike.%${safeSearch}%,first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomerOption[];
    },
    enabled: !!tenantId && previewMode === 'customer',
  });

  const renderPreview = useCallback(async () => {
    if (!html) return;
    
    setIsRendering(true);
    setError(null);
    
    try {
      const body: Record<string, unknown> = {
        html,
        subject,
      };
      
      if (previewMode === 'customer' && selectedCustomerId) {
        body.customerId = selectedCustomerId;
      } else {
        // Use sample customer data
        body.sampleCustomer = {
          first_name: 'Jane',
          last_name: 'Gardener',
          email: 'jane@example.com',
          phone: '(555) 123-4567',
        };
      }
      
      const { data, error: fnError } = await supabase.functions.invoke('render-email-preview', {
        body,
      });
      
      if (fnError) throw fnError;
      
      setRenderedHtml(data.renderedHtml);
      setRenderedSubject(data.renderedSubject);
      setDiagnostics(data.diagnostics);
      
      onRenderedPreview?.(data.renderedHtml, data.renderedSubject);
    } catch (err) {
      console.error('Preview render error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render preview');
    } finally {
      setIsRendering(false);
    }
  }, [html, subject, previewMode, selectedCustomerId, onRenderedPreview]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const hasWarnings = diagnostics && (diagnostics.missingTags.length > 0 || diagnostics.emptyResolvedTags.length > 0);

  return (
    <div className="space-y-4">
      {/* Preview Mode Selector */}
      <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg flex-wrap">
        <Label className="text-sm font-medium">Preview as:</Label>
        <NativeSelect 
          value={previewMode} 
          onChange={(e) => setPreviewMode(e.target.value as PreviewMode)}
          className="w-[180px]"
        >
          <option value="sample">Sample Customer</option>
          <option value="customer">Real Customer</option>
        </NativeSelect>

        {previewMode === 'customer' && (
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              placeholder="Search customers..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-[180px]"
            />
            <NativeSelect 
              value={selectedCustomerId} 
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              disabled={customersLoading}
              className="w-[250px]"
            >
              <option value="">Select customer...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.first_name || customer.last_name 
                    ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
                    : customer.email
                  } ({customer.email})
                </option>
              ))}
            </NativeSelect>
          </div>
        )}

        <Button 
          onClick={renderPreview} 
          disabled={isRendering || (previewMode === 'customer' && !selectedCustomerId)}
          size="sm"
        >
          {isRendering ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Render Preview
        </Button>
      </div>

      {/* Customer Info Badge */}
      {previewMode === 'customer' && selectedCustomer && (
        <Badge variant="secondary" className="gap-1">
          <User className="h-3 w-3" />
          Previewing as: {selectedCustomer.first_name} {selectedCustomer.last_name} ({selectedCustomer.email})
        </Badge>
      )}
      
      {previewMode === 'sample' && (
        <Badge variant="outline" className="gap-1">
          <User className="h-3 w-3" />
          Previewing as: Jane Gardener (jane@example.com)
        </Badge>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Render Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Diagnostics Warning */}
      {hasWarnings && (
        <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            Personalization Issues Detected
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <div className="space-y-1 mt-2">
              {diagnostics.missingTags.length > 0 && (
                <div>
                  <strong>Missing fields:</strong>{' '}
                  {diagnostics.missingTags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="mr-1 text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              {diagnostics.emptyResolvedTags.length > 0 && (
                <div>
                  <strong>Empty values:</strong>{' '}
                  {diagnostics.emptyResolvedTags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="mr-1 text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Diagnostics Summary */}
      {diagnostics && !hasWarnings && diagnostics.usedTags.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="text-xs">
            {diagnostics.usedTags.length} merge tags used
          </Badge>
          {diagnostics.legacyTagsConverted > 0 && (
            <Badge variant="outline" className="text-xs">
              {diagnostics.legacyTagsConverted} legacy tags converted
            </Badge>
          )}
        </div>
      )}

      {/* Rendered Subject Preview */}
      {renderedSubject && (
        <div className="p-2 bg-muted rounded text-sm">
          <span className="font-medium">Subject:</span> {renderedSubject}
        </div>
      )}
    </div>
  );
}
