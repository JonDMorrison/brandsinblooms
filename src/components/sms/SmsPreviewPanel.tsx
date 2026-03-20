import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Smartphone, Send, AlertTriangle, Image, ChevronDown, ChevronUp, User, Search, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { renderSmsPreview, sendTestSms, RenderPreviewResponse, SampleCustomer } from '@/lib/sms/smsPreviewService';
import { SmsComplianceSandbox } from './SmsComplianceSandbox';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface SmsPreviewPanelProps {
  messageTemplate: string;
  mediaUrls?: string[];
  imageUrl?: string;
  campaignId?: string;
  segmentId?: string;
  recipientCount?: number;
}

interface CustomerOption {
  id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
}

export const SmsPreviewPanel: React.FC<SmsPreviewPanelProps> = ({
  messageTemplate,
  mediaUrls = [],
  imageUrl,
  campaignId,
  segmentId,
  recipientCount = 0,
}) => {
  const { tenant } = useTenant();
  const [isOpen, setIsOpen] = useState(true);
  const [previewTab, setPreviewTab] = useState<'sample' | 'customer'>('sample');
  
  // Sample customer form
  const [sampleCustomer, setSampleCustomer] = useState<SampleCustomer>({
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone: '+15551234567',
  });
  
  // Real customer selection
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  // Preview state
  const [previewData, setPreviewData] = useState<RenderPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Test SMS state
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Combine all media URLs
  const allMediaUrls = imageUrl ? [imageUrl, ...mediaUrls] : mediaUrls;
  
  // Debounce timer ref
  const debounceRef = useRef<NodeJS.Timeout>();

  // Preview fetch function
  const fetchPreview = useCallback(async (template: string, customerId?: string, sample?: SampleCustomer) => {
    if (!template.trim()) {
      setPreviewData(null);
      return;
    }

    setLoadingPreview(true);
    try {
      const result = await renderSmsPreview({
        messageTemplate: template,
        mediaUrls: allMediaUrls,
        customerId: customerId || undefined,
        sampleCustomer: customerId ? undefined : sample,
      });
      setPreviewData(result);
    } catch (error) {
      console.error('Preview error:', error);
    } finally {
      setLoadingPreview(false);
    }
  }, [allMediaUrls]);

  // Fetch preview when inputs change (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (previewTab === 'customer' && selectedCustomerId) {
        fetchPreview(messageTemplate, selectedCustomerId);
      } else {
        fetchPreview(messageTemplate, undefined, sampleCustomer);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [messageTemplate, previewTab, selectedCustomerId, sampleCustomer, fetchPreview]);

  // Search customers
  const searchCustomers = useCallback(async (query: string) => {
    if (!tenant?.id) return;
    
    setLoadingCustomers(true);
    try {
      let queryBuilder = supabase
        .from('crm_customers')
        .select('id, first_name, last_name, phone, email')
        .eq('tenant_id', tenant.id)
        .eq('sms_opt_in', true)
        .not('phone', 'is', null)
        .limit(20);

      if (query.trim()) {
        // SECURITY: [PostgREST filter injection] - Sanitize user input before interpolation into .or() filter
        const sanitizeForPostgrest = (input: string) => input.replace(/[,.()"'\\]/g, '');
        const safeQuery = sanitizeForPostgrest(query);
        queryBuilder = queryBuilder.or(`first_name.ilike.%${safeQuery}%,last_name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`);
      }

      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      setCustomerOptions(data || []);
    } catch (error) {
      console.error('Customer search error:', error);
    } finally {
      setLoadingCustomers(false);
    }
  }, [tenant?.id]);

  // Initial customer load
  useEffect(() => {
    if (previewTab === 'customer') {
      searchCustomers('');
    }
  }, [previewTab, searchCustomers]);

  // Handle send test
  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setSendingTest(true);
    try {
      const result = await sendTestSms({
        messageTemplate,
        mediaUrls: allMediaUrls,
        testToPhone: testPhone,
        renderAsCustomerId: previewTab === 'customer' ? selectedCustomerId || undefined : undefined,
        bypassConsentForTest: true,
      });

      if (result.success) {
        toast.success(`Test SMS sent! SID: ${result.twilioSid?.slice(-8)}`);
      } else {
        toast.error(result.twilioError || result.error || 'Failed to send test SMS');
      }
    } catch (error) {
      toast.error('Failed to send test SMS');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Preview & Test
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Preview Mode Tabs */}
            <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as 'sample' | 'customer')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sample">Sample Customer</TabsTrigger>
                <TabsTrigger value="customer">Real Customer</TabsTrigger>
              </TabsList>
              
              <TabsContent value="sample" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">First Name</Label>
                    <Input
                      value={sampleCustomer.first_name || ''}
                      onChange={(e) => setSampleCustomer(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder="John"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Last Name</Label>
                    <Input
                      value={sampleCustomer.last_name || ''}
                      onChange={(e) => setSampleCustomer(prev => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Doe"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="customer" className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      searchCustomers(e.target.value);
                    }}
                    placeholder="Search by name or phone..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                
                <div className="max-h-32 overflow-y-auto border rounded-md">
                  {loadingCustomers ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">Loading...</div>
                  ) : customerOptions.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">No customers found</div>
                  ) : (
                    customerOptions.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => setSelectedCustomerId(customer.id)}
                        className={`w-full p-2 text-left text-sm hover:bg-muted flex items-center justify-between ${
                          selectedCustomerId === customer.id ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span>{customer.first_name || ''} {customer.last_name || ''}</span>
                          <span className="text-muted-foreground">{customer.phone}</span>
                        </div>
                        {selectedCustomerId === customer.id && (
                          <Check className="h-3 w-3 text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Phone Preview */}
            <div className="flex justify-center py-2">
              <div className="w-56 bg-gray-900 rounded-2xl p-3 shadow-lg">
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl p-3 min-h-[120px]">
                  <div className="text-center text-xs text-muted-foreground mb-2">SMS Preview</div>
                  
                  {loadingPreview ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* MMS Media Thumbnails */}
                      {previewData?.mms?.isMms && previewData.mms.mediaUrls.length > 0 && (
                        <div className="flex gap-1 mb-2 flex-wrap">
                          {previewData.mms.mediaUrls.map((url, idx) => (
                            <div key={idx} className="relative w-12 h-12 rounded overflow-hidden bg-muted">
                              <img 
                                src={url} 
                                alt={`Media ${idx + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <Image className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Message Bubble */}
                      <div className="bg-primary text-primary-foreground rounded-xl rounded-bl-sm px-3 py-2 text-xs break-words">
                        {previewData?.renderedText || messageTemplate || 'Enter a message to preview'}
                      </div>
                      
                      <div className="text-right text-xs text-muted-foreground mt-1">
                        Delivered
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Segment Info */}
            {previewData?.segmentInfo && (
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge variant="outline" className="text-xs">
                  {previewData.segmentInfo.encoding}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {previewData.segmentInfo.length} chars
                </Badge>
                <Badge 
                  variant={previewData.segmentInfo.segments > 1 ? "destructive" : "secondary"} 
                  className="text-xs"
                >
                  {previewData.segmentInfo.segments} segment{previewData.segmentInfo.segments !== 1 ? 's' : ''}
                </Badge>
                {previewData.mms?.isMms && (
                  <Badge variant="secondary" className="text-xs">MMS</Badge>
                )}
              </div>
            )}

            {/* Missing Tags Warning */}
            {previewData?.mergeMeta?.missingTags && previewData.mergeMeta.missingTags.length > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Missing merge tags:</p>
                  <p className="text-amber-700 dark:text-amber-300">
                    {previewData.mergeMeta.missingTags.join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Send Test */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-medium">Send Test SMS</Label>
              <div className="flex gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="h-9"
                />
                <Button 
                  size="sm" 
                  onClick={handleSendTest}
                  disabled={sendingTest || !messageTemplate.trim()}
                  className="shrink-0"
                >
                  {sendingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Send
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Test sends are free and don't count toward your quota
              </p>
            </div>

            {/* Compliance Sandbox */}
            <SmsComplianceSandbox />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
