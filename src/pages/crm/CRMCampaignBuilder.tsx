import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCRMAccess } from '@/hooks/useCRMAccess';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, Save, Eye, Smartphone, Monitor, GripVertical, 
  Trash2, Type, Image, MousePointer, Minus, Package, 
  Sparkles, FileText, Palette
} from 'lucide-react';
import { EmailBlock, GlobalSettings, BlockType } from '@/types/emailBuilder';
import { EmailBlockRenderer } from '@/components/crm/EmailBlockRenderer';
import { BlockEditor } from '@/components/crm/BlockEditor';
import { ContentIntegrationSidebar } from '@/components/crm/ContentIntegrationSidebar';
import { GlobalSettingsPanel } from '@/components/crm/GlobalSettingsPanel';
import { SaveTemplateModal } from '@/components/crm/SaveTemplateModal';
import { reorderArray } from '@/utils/dragUtils';

const CRMCampaignBuilder = () => {
  const { campaignId } = useParams();
  const [searchParams] = useSearchParams();
  const { hasCRMAccess, loading: crmLoading } = useCRMAccess();
  
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    fontFamily: 'Arial, sans-serif',
    fontSize: '16px',
    buttonStyle: {
      cornerRadius: '6px',
      backgroundColor: '#22C55E',
      textColor: '#FFFFFF'
    },
    headerStyle: {
      backgroundColor: '#F8F9FA',
      textColor: '#1F2937'
    },
    footerStyle: {
      backgroundColor: '#F8F9FA', 
      textColor: '#6B7280'
    }
  });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showContentSidebar, setShowContentSidebar] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [campaign, setCampaign] = useState<any>(null);
  const [autoSaving, setAutoSaving] = useState(false);

  // Load campaign and blocks
  useEffect(() => {
    if (campaignId) {
      loadCampaign();
      loadBlocks();
    }
  }, [campaignId]);

  // Auto-save blocks
  useEffect(() => {
    if (blocks.length > 0 && campaignId) {
      const timeoutId = setTimeout(() => {
        saveBlocks();
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [blocks, campaignId]);

  const loadCampaign = async () => {
    if (!campaignId) return;
    
    const { data, error } = await supabase
      .from('crm_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    
    if (error) {
      console.error('Error loading campaign:', error);
      toast.error('Failed to load campaign');
      return;
    }
    
    setCampaign(data);
  };

  const loadBlocks = async () => {
    if (!campaignId) return;
    
    const { data, error } = await supabase
      .from('campaign_blocks')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('order_index');
    
    if (error) {
      console.error('Error loading blocks:', error);
      return;
    }
    
    setBlocks(data?.map(block => ({
      ...block,
      block_type: block.block_type as BlockType,
      content: typeof block.content === 'string' ? JSON.parse(block.content) : block.content
    })) || []);
  };

  const saveBlocks = async () => {
    if (!campaignId || blocks.length === 0) return;
    
    setAutoSaving(true);
    
    try {
      // Delete existing blocks
      await supabase
        .from('campaign_blocks')
        .delete()
        .eq('campaign_id', campaignId);
      
      // Insert new blocks
      const blocksToInsert = blocks.map((block, index) => ({
        ...block,
        campaign_id: campaignId,
        order_index: index
      }));
      
      const { error } = await supabase
        .from('campaign_blocks')
        .insert(blocksToInsert);
      
      if (error) throw error;
      
    } catch (error) {
      console.error('Error saving blocks:', error);
      toast.error('Failed to save changes');
    } finally {
      setAutoSaving(false);
    }
  };

  const addBlock = (blockType: BlockType) => {
    const newBlock: EmailBlock = {
      id: crypto.randomUUID(),
      block_type: blockType,
      content: getDefaultContent(blockType),
      order_index: blocks.length,
      campaign_id: campaignId || '',
      source: 'manual'
    };
    
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const getDefaultContent = (blockType: BlockType) => {
    switch (blockType) {
      case 'header':
        return { title: 'Email Header', subtitle: 'Welcome to our newsletter' };
      case 'text':
        return { title: 'Section Title', content: 'Add your content here...' };
      case 'image':
        return { alt: 'Image description', alignment: 'center' };
      case 'button':
        return { text: 'Click Here', url: '#', alignment: 'center' };
      case 'divider':
        return { style: 'solid', color: '#E5E7EB' };
      case 'product':
        return { 
          name: 'Product Name', 
          price: '$99.99', 
          description: 'Product description',
          buttonText: 'Shop Now',
          buttonUrl: '#'
        };
      default:
        return {};
    }
  };

  const updateBlock = (blockId: string, updates: Partial<EmailBlock>) => {
    setBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
  };

  const deleteBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(block => block.id !== blockId));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const reorderedBlocks = reorderArray(
      blocks,
      result.source.index,
      result.destination.index
    );
    
    setBlocks(reorderedBlocks);
  };

  const generateEmailHTML = () => {
    // Generate final email HTML with inline styles
    const htmlContent = blocks.map(block => 
      EmailBlockRenderer({ block, globalSettings, isPreview: false })
    ).join('');
    
    return `
      <div style="font-family: ${globalSettings.fontFamily}; font-size: ${globalSettings.fontSize}; max-width: 600px; margin: 0 auto;">
        ${htmlContent}
      </div>
    `;
  };

  if (crmLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!hasCRMAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">CRM Access Required</h2>
          <p className="text-muted-foreground">Please upgrade your plan to access the email campaign builder.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Email Campaign Builder</h1>
            {campaign && (
              <Badge variant="outline">{campaign.name}</Badge>
            )}
            {autoSaving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                Auto-saving...
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowContentSidebar(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Content
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaveTemplate(true)}
              className="gap-2"
              disabled={blocks.length === 0}
            >
              <Save className="w-4 h-4" />
              Save as Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGlobalSettings(true)}
              className="gap-2"
            >
              <Palette className="w-4 h-4" />
              Styling
            </Button>
            
            {/* Preview Mode Toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden bg-background">
              <Button
                variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode('desktop')}
                className="rounded-none border-0 gap-2"
              >
                <Monitor className="w-4 h-4" />
                Desktop
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode('mobile')}
                className="rounded-none border-0 gap-2"
              >
                <Smartphone className="w-4 h-4" />
                Mobile
              </Button>
            </div>
            
            {/* CTA Actions */}
            <div className="flex items-center gap-2 ml-4 border-l pl-4">
              <Button variant="outline" size="sm">Send Test Email</Button>
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-2" />
                Preview Full Email
              </Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                Schedule Campaign
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Block Toolbar */}
        <div className="w-20 border-r bg-muted/20 p-3 space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full aspect-square p-1"
            onClick={() => addBlock('header')}
            title="Add Header"
          >
            <Type className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full aspect-square p-1"
            onClick={() => addBlock('text')}
            title="Add Text Block"
          >
            <FileText className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full aspect-square p-1"
            onClick={() => addBlock('image')}
            title="Add Image"
          >
            <Image className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full aspect-square p-1"
            onClick={() => addBlock('button')}
            title="Add Button"
          >
            <MousePointer className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full aspect-square p-1"
            onClick={() => addBlock('divider')}
            title="Add Divider"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full aspect-square p-1"
            onClick={() => addBlock('product')}
            title="Add Product Block"
          >
            <Package className="w-4 h-4" />
          </Button>
        </div>

        {/* Main Editor */}
        <div className="flex-1 flex">
          {/* Canvas */}
          <div className="flex-1 p-8 bg-muted/10">
            <div className={`mx-auto bg-white shadow-xl rounded-lg border ${
              previewMode === 'mobile' ? 'max-w-sm' : 'max-w-2xl'
            }`}>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="email-blocks">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      {blocks.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                          <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg font-medium mb-2">Start Building Your Email</h3>
                          <p>Add blocks from the toolbar or import content from your newsletters</p>
                        </div>
                      ) : (
                        blocks.map((block, index) => (
                          <Draggable
                            key={block.id}
                            draggableId={block.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`group relative ${
                                  selectedBlockId === block.id ? 'ring-2 ring-primary' : ''
                                } ${snapshot.isDragging ? 'opacity-75' : ''}`}
                                onClick={() => setSelectedBlockId(block.id)}
                              >
                                <div className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="p-1 hover:bg-muted rounded cursor-grab"
                                  >
                                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                </div>
                                <div className="absolute -right-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteBlock(block.id);
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                                <EmailBlockRenderer
                                  block={block}
                                  globalSettings={globalSettings}
                                  isPreview={true}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </div>

          {/* Properties Panel */}
          {selectedBlockId && (
            <div className="w-80 border-l bg-background/60 backdrop-blur-sm p-6">
              <BlockEditor
                block={blocks.find(b => b.id === selectedBlockId)!}
                onUpdate={(updates) => updateBlock(selectedBlockId, updates)}
                globalSettings={globalSettings}
              />
            </div>
          )}
        </div>
      </div>

      {/* Content Integration Sidebar */}
      <ContentIntegrationSidebar
        open={showContentSidebar}
        onClose={() => setShowContentSidebar(false)}
        onAddBlock={(block) => {
          setBlocks(prev => [...prev, { ...block, id: crypto.randomUUID() }]);
          setShowContentSidebar(false);
        }}
        campaignId={campaignId}
      />

      {/* Global Settings Panel */}
      <GlobalSettingsPanel
        open={showGlobalSettings}
        onClose={() => setShowGlobalSettings(false)}
        settings={globalSettings}
        onUpdate={setGlobalSettings}
      />

      {/* Save Template Modal */}
      <SaveTemplateModal
        open={showSaveTemplate}
        onClose={() => setShowSaveTemplate(false)}
        blocks={blocks}
        onTemplateSaved={() => {
          // Refresh templates in sidebar if open
          if (showContentSidebar) {
            setShowContentSidebar(false);
            setTimeout(() => setShowContentSidebar(true), 100);
          }
        }}
      />
    </div>
  );
};

export default CRMCampaignBuilder;