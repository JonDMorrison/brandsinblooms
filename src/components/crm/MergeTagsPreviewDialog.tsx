import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, User, Building } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { useAllPersonas } from '@/hooks/useAllPersonas';
import { processEmailTokens, getDefaultTokenData, type TokenData } from '@/utils/emailTokenProcessor';
import { SafeHtml } from '@/components/ui/safe-html';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MergeTagsPreviewDialogProps {
  children: React.ReactNode;
  emailContent: {
    subject?: string;
    preheader?: string;
    body: string;
  };
  onMergeComplete?: (mergedContent: string, field: 'subject' | 'preheader' | 'body') => void;
}

export const MergeTagsPreviewDialog: React.FC<MergeTagsPreviewDialogProps> = ({
  children,
  emailContent,
  onMergeComplete
}) => {
  const [open, setOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('sample');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewMode, setPreviewMode] = useState<'email' | 'fields'>('email');
  
  const { data: customers, isLoading } = useCustomers();
  const { personas } = useAllPersonas();

  // Get merge data based on selection
  const mergeData = useMemo(() => {
    if (selectedCustomerId === 'sample') {
      // Use sample data
      return getDefaultTokenData({
        name: 'Your Garden Center',
        address: '123 Garden Way, Green Valley, CA 90210',
        phone: '(555) 123-GROW',
        emailDomain: 'yourgardencenter.com'
      });
    }

    // Find selected customer
    const customer = customers?.find(c => c.id === selectedCustomerId);
    if (!customer) return getDefaultTokenData();

    return {
      customerName: customer.first_name || 'Valued Customer',
      customerEmail: customer.email,
      companyName: 'Your Garden Center',
      companyAddress: '123 Garden Way, Green Valley, CA 90210',
      companyPhone: '(555) 123-GROW',
      companyEmail: 'hello@yourgardencenter.com',
      unsubscribeUrl: `https://bloomsuite.app/unsubscribe/${customer.id}`,
      managePreferencesUrl: `https://bloomsuite.app/preferences/${customer.id}`,
    } as TokenData;
  }, [selectedCustomerId, customers]);

  // Process content with merge tags
  const processedContent = useMemo(() => {
    return {
      subject: processEmailTokens(emailContent.subject || '', mergeData),
      preheader: processEmailTokens(emailContent.preheader || '', mergeData),
      body: processEmailTokens(emailContent.body || '', mergeData)
    };
  }, [emailContent, mergeData]);

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
  
  // Look up the selected customer's persona
  const selectedCustomerPersona = useMemo(() => {
    if (!selectedCustomer?.persona_id || !personas) return null;
    return personas.find(p => p.id === selectedCustomer.persona_id);
  }, [selectedCustomer?.persona_id, personas]);

  const handleCopyMerged = (field: 'subject' | 'preheader' | 'body') => {
    const content = processedContent[field];
    navigator.clipboard.writeText(content);
    toast.success(`Merged ${field} copied to clipboard`);
    if (onMergeComplete) {
      onMergeComplete(content, field);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Merge Tags Preview
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <div className="space-y-4 h-full flex flex-col">
            {/* Controls */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Customer Selection */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Customer:</label>
                <select 
                  value={selectedCustomerId} 
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-48 h-9 px-3 py-1 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="sample">Sample Customer</option>
                  {customers?.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.first_name || customer.email} ({customer.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                <Button
                  variant={viewMode === 'desktop' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('desktop')}
                  className="h-8 px-2"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'mobile' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('mobile')}
                  className="h-8 px-2"
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Customer Info Card */}
            {selectedCustomer && (
              <Card className="border-dashed">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {selectedCustomer.first_name} {selectedCustomer.last_name}
                      </span>
                    </div>
                    <Badge variant="outline">{selectedCustomer.email}</Badge>
                    {selectedCustomer.persona_id && selectedCustomerPersona && (
                      <Badge variant="secondary">{selectedCustomerPersona.persona_name}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Preview Tabs */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg mb-4">
                <Button
                  variant={previewMode === 'email' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('email')}
                  className="h-8 px-3"
                >
                  Email Preview
                </Button>
                <Button
                  variant={previewMode === 'fields' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('fields')}
                  className="h-8 px-3"
                >
                  Field by Field
                </Button>
              </div>
              
              {previewMode === 'email' ? (
                <div 
                  className={cn(
                    "transition-all duration-300 mx-auto bg-white border rounded-lg overflow-hidden",
                    viewMode === 'mobile' ? 'max-w-sm' : 'max-w-2xl'
                  )}
                >
                  {/* Email Header */}
                  <div className="p-4 bg-muted/50 border-b space-y-2 text-sm">
                    <div>
                      <span className="font-medium">From:</span> Your Garden Center &lt;hello@yourgardencenter.com&gt;
                    </div>
                    <div>
                      <span className="font-medium">To:</span> {mergeData.customerEmail}
                    </div>
                    <div>
                      <span className="font-medium">Subject:</span> {processedContent.subject}
                    </div>
                    {processedContent.preheader && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Preheader:</span> {processedContent.preheader}
                      </div>
                    )}
                  </div>
                  
                  {/* Email Body */}
                  <div className="p-6 max-h-96 overflow-y-auto">
                    <SafeHtml 
                      content={processedContent.body}
                      className={cn(
                        "prose max-w-none",
                        viewMode === 'mobile' ? 'prose-sm' : ''
                      )}
                    />
                    
                    {/* Footer */}
                    <div className="border-t pt-4 mt-8 text-xs text-muted-foreground space-y-1">
                      <p>
                        You're receiving this email from {mergeData.companyName} because you signed up for updates.
                      </p>
                      <p>
                        <a href={mergeData.unsubscribeUrl} className="underline">Unsubscribe</a> |{' '}
                        <a href={mergeData.managePreferencesUrl} className="underline">Manage Preferences</a>
                      </p>
                      <p>
                        {mergeData.companyName} | {mergeData.companyAddress}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {/* Subject Line */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Subject Line</CardTitle>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleCopyMerged('subject')}
                        >
                          Copy Merged
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Original:</div>
                        <div className="text-sm bg-muted p-2 rounded font-mono">
                          {emailContent.subject || '(no subject)'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Merged:</div>
                        <div className="text-sm bg-green-50 p-2 rounded border border-green-200">
                          {processedContent.subject}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Preheader */}
                  {emailContent.preheader && (
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Preheader</CardTitle>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleCopyMerged('preheader')}
                          >
                            Copy Merged
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Original:</div>
                          <div className="text-sm bg-muted p-2 rounded font-mono">
                            {emailContent.preheader}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Merged:</div>
                          <div className="text-sm bg-green-50 p-2 rounded border border-green-200">
                            {processedContent.preheader}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Email Body */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Email Body</CardTitle>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleCopyMerged('body')}
                        >
                          Copy Merged
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Original:</div>
                        <div className="text-sm bg-muted p-2 rounded font-mono max-h-24 overflow-y-auto">
                          {emailContent.body}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Merged Preview:</div>
                        <div className="text-sm bg-green-50 p-2 rounded border border-green-200 max-h-32 overflow-y-auto">
                          <SafeHtml content={processedContent.body} className="prose prose-sm max-w-none" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};