import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { 
  ArrowLeft,
  Send,
  Save,
  Sparkles,
  Eye,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Mail,
  Loader2,
  Plus,
  GripVertical,
  Trash2,
  Copy,
  Type,
  Image,
  ExternalLink,
  Minus,
  ShoppingCart
} from 'lucide-react';
import { EmailBlockEditor } from './email-blocks/EmailBlockEditor';
import { EmailPreview } from './EmailPreview';
import { CampaignPreview } from './CampaignPreview';
import { TestEmailModal } from './TestEmailModal';
import { useSenderConfiguration } from '@/hooks/useSenderConfiguration';
import { SenderStatusIndicator } from '../campaigns/SenderStatusIndicator';
import { SharedSenderConfirmationModal } from '../campaigns/SharedSenderConfirmationModal';

interface Segment {
  id: string;
  name: string;
  customer_count: number;
}

interface EmailBlock {
  id: string;
  type: 'heading' | 'text' | 'image' | 'button' | 'divider' | 'product';
  content: any;
  order: number;
}

interface CampaignData {
  name: string;
  subject_line: string;
  segment_id: string;
  content: string;
  status: 'draft' | 'scheduled' | 'sent';
  scheduled_at?: string;
}

export const EmailCampaignComposer: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { senderConfig, loading: senderLoading } = useSenderConfiguration();
  const [searchParams] = useSearchParams();
  
  const [segments, setSegments] = useState<Segment[]>([]);
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [showSenderConfirmation, setShowSenderConfirmation] = useState(false);
  
  // Form data
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    subject_line: '',
    segment_id: '',
    content: '',
    status: 'draft'
  });

  useEffect(() => {
    if (user) {
      loadSegments();
      initializeBlocks();
    }
  }, [user]);

  const loadSegments = async () => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (userData?.tenant_id) {
        const { data, error } = await supabase
          .from('crm_segments')
          .select('id, name, customer_count')
          .eq('tenant_id', userData.tenant_id)
          .order('name');

        if (error) throw error;
        setSegments(data || []);
      }
    } catch (error) {
      console.error('Error loading segments:', error);
      toast({
        title: "Error",
        description: "Failed to load segments",
        variant: "destructive"
      });
    }
  };

  const initializeBlocks = () => {
    const defaultBlocks: EmailBlock[] = [
      {
        id: 'header-1',
        type: 'heading',
        content: { text: 'Welcome to Our Garden Center!', level: 1, align: 'center' },
        order: 0
      },
      {
        id: 'text-1',
        type: 'text',
        content: { text: 'We\'re excited to share our latest plants and gardening tips with you.' },
        order: 1
      }
    ];
    setBlocks(defaultBlocks);
  };

  const addBlock = (type: EmailBlock['type']) => {
    const newBlock: EmailBlock = {
      id: `${type}-${Date.now()}`,
      type,
      content: getDefaultContent(type),
      order: blocks.length
    };
    setBlocks([...blocks, newBlock]);
  };

  const getDefaultContent = (type: EmailBlock['type']) => {
    switch (type) {
      case 'heading':
        return { text: 'Your heading here', level: 2, align: 'left' };
      case 'text':
        return { text: 'Add your content here...' };
      case 'image':
        return { src: '', alt: '', caption: '', align: 'center' };
      case 'button':
        return { text: 'Click Here', url: '', style: 'primary', align: 'center' };
      case 'divider':
        return { style: 'solid', color: '#e5e7eb' };
      case 'product':
        return { 
          name: 'Featured Plant',
          description: 'Beautiful plant for your garden',
          price: '$19.99',
          image: '',
          url: ''
        };
      default:
        return {};
    }
  };

  const updateBlock = (id: string, content: any) => {
    setBlocks(blocks.map(block => 
      block.id === id ? { ...block, content } : block
    ));
  };

  const duplicateBlock = (id: string) => {
    const blockToDuplicate = blocks.find(block => block.id === id);
    if (!blockToDuplicate) return;
    
    const newBlock: EmailBlock = {
      ...blockToDuplicate,
      id: `${blockToDuplicate.type}-${Date.now()}`,
      order: blockToDuplicate.order + 1
    };
    
    const updatedBlocks = blocks.map(block => 
      block.order > blockToDuplicate.order 
        ? { ...block, order: block.order + 1 }
        : block
    );
    
    setBlocks([...updatedBlocks, newBlock].sort((a, b) => a.order - b.order));
  };

  const deleteBlock = (id: string) => {
    const blockToDelete = blocks.find(block => block.id === id);
    if (!blockToDelete) return;
    
    const updatedBlocks = blocks
      .filter(block => block.id !== id)
      .map(block => 
        block.order > blockToDelete.order 
          ? { ...block, order: block.order - 1 }
          : block
      );
    
    setBlocks(updatedBlocks);
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const reorderedBlocks = Array.from(blocks);
    const [removed] = reorderedBlocks.splice(result.source.index, 1);
    reorderedBlocks.splice(result.destination.index, 0, removed);
    
    const updatedBlocks = reorderedBlocks.map((block, index) => ({
      ...block,
      order: index
    }));
    
    setBlocks(updatedBlocks);
  };

  const generateHTML = () => {
    // Convert blocks to HTML email template
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${campaignData.subject_line}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; }
        .content { padding: 40px 30px; }
        h1, h2, h3 { color: #1f2937; margin: 0 0 16px 0; }
        h1 { font-size: 28px; }
        h2 { font-size: 24px; }
        h3 { font-size: 20px; }
        p { color: #4b5563; line-height: 1.6; margin: 0 0 16px 0; }
        .button { display: inline-block; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
        .button-primary { background-color: #47B881; color: white; }
        .button-secondary { background-color: #e5e7eb; color: #374151; }
        .divider { height: 1px; margin: 24px 0; }
        .product-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; }
        .product-image { width: 100%; max-width: 200px; height: auto; border-radius: 6px; }
        .product-name { font-size: 18px; font-weight: 600; color: #1f2937; margin: 12px 0 8px 0; }
        .product-description { color: #6b7280; margin: 0 0 12px 0; }
        .product-price { font-size: 20px; font-weight: 700; color: #47B881; margin: 8px 0; }
        .footer { background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center; }
        .footer p { color: #6b7280; font-size: 12px; margin: 4px 0; }
        .unsubscribe { color: #6b7280; text-decoration: none; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
    `;

    blocks.forEach(block => {
      switch (block.type) {
        case 'heading':
          const headingTag = `h${block.content.level}`;
          html += `<${headingTag} class="text-${block.content.align}">${block.content.text}</${headingTag}>`;
          break;
        case 'text':
          html += `<p>${block.content.text}</p>`;
          break;
        case 'image':
          html += `
            <div class="text-${block.content.align}">
              <img src="${block.content.src}" alt="${block.content.alt}" style="max-width: 100%; height: auto; border-radius: 6px;">
              ${block.content.caption ? `<p style="font-size: 14px; color: #6b7280; margin-top: 8px;">${block.content.caption}</p>` : ''}
            </div>
          `;
          break;
        case 'button':
          html += `
            <div class="text-${block.content.align}">
              <a href="${block.content.url}" class="button button-${block.content.style}">${block.content.text}</a>
            </div>
          `;
          break;
        case 'divider':
          html += `<div class="divider" style="background-color: ${block.content.color};"></div>`;
          break;
        case 'product':
          html += `
            <div class="product-card">
              ${block.content.image ? `<img src="${block.content.image}" alt="${block.content.name}" class="product-image">` : ''}
              <div class="product-name">${block.content.name}</div>
              <div class="product-description">${block.content.description}</div>
              <div class="product-price">${block.content.price}</div>
              ${block.content.url ? `<a href="${block.content.url}" class="button button-primary">View Product</a>` : ''}
            </div>
          `;
          break;
      }
    });

    html += `
        </div>
        <div class="footer">
          <p>You're receiving this email because you're a valued customer of our garden center.</p>
          <p><a href="{{unsubscribe_url}}" class="unsubscribe">Unsubscribe</a> | View in browser</p>
          <p>© 2024 Garden Center. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    return html;
  };

  const saveCampaign = async (sendNow = false) => {
    if (!campaignData.name || !campaignData.subject_line || !campaignData.segment_id) {
      toast({
        title: "Missing Information",
        description: "Please fill in campaign name, subject line, and select a segment",
        variant: "destructive"
      });
      return;
    }

    // If sending now and using shared sender, show confirmation
    if (sendNow && !senderConfig.isVerified) {
      setShowSenderConfirmation(true);
      return;
    }

    await executeCSend(sendNow);
  };

  const executeCSend = async (sendNow = false) => {

    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.tenant_id) return;

      const htmlContent = generateHTML();
      let scheduled_at = null;
      
      if (!sendNow && scheduledDate && scheduledTime) {
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        const datetime = new Date(scheduledDate);
        datetime.setHours(hours, minutes, 0, 0);
        scheduled_at = datetime.toISOString();
      }

      const campaignToSave = {
        ...campaignData,
        content: htmlContent,
        status: sendNow ? 'sent' : (scheduled_at ? 'scheduled' : 'draft'),
        scheduled_at,
        tenant_id: userData.tenant_id,
        user_id: user?.id,
        delivery_method: senderConfig.deliveryMethod,
        sender_display_name: senderConfig.displayName,
        actual_sender_email: senderConfig.senderEmail
      };

      const { error } = await supabase
        .from('crm_campaigns')
        .insert(campaignToSave);

      if (error) throw error;

      toast({
        title: sendNow ? "Campaign Sent!" : "Campaign Saved!",
        description: sendNow 
          ? "Your email campaign has been sent successfully" 
          : "Your campaign has been saved and can be sent later"
      });

      navigate('/crm/campaigns');
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Error",
        description: "Failed to save campaign",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const blockTypes = [
    { type: 'heading' as const, icon: Type, label: 'Heading' },
    { type: 'text' as const, icon: Type, label: 'Text' },
    { type: 'image' as const, icon: Image, label: 'Image' },
    { type: 'button' as const, icon: ExternalLink, label: 'Button' },
    { type: 'divider' as const, icon: Minus, label: 'Divider' },
    { type: 'product' as const, icon: ShoppingCart, label: 'Product Card' }
  ];

  const selectedSegment = segments.find(s => s.id === campaignData.segment_id);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/crm/campaigns')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Email Campaign Composer</h1>
            <p className="text-muted-foreground">Create engaging email campaigns with our drag-and-drop builder</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" onClick={() => setShowTestEmailModal(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send Test
          </Button>
          <Button variant="outline" onClick={() => saveCampaign(false)} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={() => saveCampaign(true)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send Campaign
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Campaign Settings */}
        <div className="lg:col-span-1 space-y-6">
          {/* Sender Status */}
          {!senderLoading && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  Sender Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SenderStatusIndicator 
                  senderConfig={senderConfig} 
                  showDetailedAlert={!senderConfig.isVerified}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-green-600" />
                Campaign Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Campaign Name</Label>
                <Input
                  value={campaignData.name}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Spring Plant Sale Newsletter"
                />
              </div>
              
              <div>
                <Label>Subject Line</Label>
                <div className="flex gap-2">
                  <Input
                    value={campaignData.subject_line}
                    onChange={(e) => setCampaignData(prev => ({ ...prev, subject_line: e.target.value }))}
                    placeholder="🌸 Spring has arrived! New plants available"
                  />
                  <Button variant="outline" size="sm">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <Label>Target Segment</Label>
                <Select 
                  value={campaignData.segment_id} 
                  onValueChange={(value) => setCampaignData(prev => ({ ...prev, segment_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select segment..." />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map(segment => (
                      <SelectItem key={segment.id} value={segment.id}>
                        {segment.name} ({segment.customer_count} customers)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSegment && (
                  <div className="flex items-center gap-2 mt-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Will reach {selectedSegment.customer_count} customers
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <Label>Schedule (Optional)</Label>
                <div className="space-y-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        initialFocus
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Block Library */}
          <Card>
            <CardHeader>
              <CardTitle>Content Blocks</CardTitle>
              <p className="text-sm text-muted-foreground">Drag blocks to add them to your email</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {blockTypes.map(({ type, icon: Icon, label }) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    onClick={() => addBlock(type)}
                    className="flex flex-col items-center gap-1 h-auto py-3"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Email Builder */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Email Content</CardTitle>
              <p className="text-muted-foreground">Build your email by adding and editing content blocks</p>
            </CardHeader>
            <CardContent>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="email-blocks">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                      {blocks.map((block, index) => (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "border rounded-lg p-4 bg-white",
                                snapshot.isDragging && "shadow-lg"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  {...provided.dragHandleProps}
                                  className="flex flex-col gap-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                
                                <div className="flex-1">
                                  <EmailBlockEditor
                                    block={block}
                                    onUpdate={(content) => updateBlock(block.id, content)}
                                  />
                                </div>
                                
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => duplicateBlock(block.id)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteBlock(block.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {blocks.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                          <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2">Start Building Your Email</h3>
                          <p className="text-muted-foreground mb-4">Add content blocks from the sidebar to create your email campaign</p>
                          <Button onClick={() => addBlock('heading')}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Your First Block
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[80vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Campaign Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <CampaignPreview 
              campaignData={campaignData}
              senderConfig={senderConfig}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Email Modal */}
      <TestEmailModal
        isOpen={showTestEmailModal}
        onClose={() => setShowTestEmailModal(false)}
        campaignData={{
          name: campaignData.name,
          subject_line: campaignData.subject_line,
          content: generateHTML()
        }}
        onTestSent={() => {
          toast({
            title: "Test Email Sent",
            description: "Check your inbox for the test email",
          });
        }}
      />

      {/* Shared Sender Confirmation Modal */}
      <SharedSenderConfirmationModal
        isOpen={showSenderConfirmation}
        onClose={() => setShowSenderConfirmation(false)}
        onConfirm={() => {
          setShowSenderConfirmation(false);
          executeCSend(true);
        }}
        senderConfig={senderConfig}
        campaignName={campaignData.name}
        recipientCount={segments.find(s => s.id === campaignData.segment_id)?.customer_count || 0}
      />
    </div>
  );
};