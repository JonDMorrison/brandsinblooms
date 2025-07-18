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
  Sparkles, FileText, Palette, MessageSquare, BookOpen,
  MoreVertical, Clock, Archive, RotateCcw
} from 'lucide-react';
import { EmailBlock, GlobalSettings, BlockType } from '@/types/emailBuilder';
import { EmailBlockRenderer } from '@/components/crm/EmailBlockRenderer';
import { BlockEditor } from '@/components/crm/BlockEditor';
import { ContentIntegrationSidebar } from '@/components/crm/ContentIntegrationSidebar';
import { GlobalSettingsPanel } from '@/components/crm/GlobalSettingsPanel';
import { SaveTemplateModal } from '@/components/crm/SaveTemplateModal';
import { SavedBlockLibraryDrawer } from '@/components/crm/SavedBlockLibraryDrawer';
import { SaveBlockModal } from '@/components/crm/SaveBlockModal';
import { SmartContentBlocksSidebar } from '@/components/crm/SmartContentBlocksSidebar';
import { AutoSaveManager, useAutoSave } from '@/components/crm/AutoSaveManager';
import { AutoSaveIndicator } from '@/components/crm/AutoSaveIndicator';
import { BlockVersionModal } from '@/components/crm/BlockVersionModal';
import { TemplateGalleryModal } from '@/components/crm/TemplateGalleryModal';
import { useVersionHistory } from '@/hooks/useVersionHistory';
import { reorderArray } from '@/utils/dragUtils';

interface CRMCampaignBuilderProps {
  onSwitchToSimple?: () => void;
}

const CRMCampaignBuilderInner: React.FC<CRMCampaignBuilderProps> = ({ onSwitchToSimple }) => {
  const { campaignId } = useParams();
  const [searchParams] = useSearchParams();
  const { hasCRMAccess, loading: crmLoading } = useCRMAccess();
  const { saveStatus, saveBlock: autoSaveBlock, forceSave, hasUnsavedChanges } = useAutoSave();
  
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
  const [showSmartBlocks, setShowSmartBlocks] = useState(false);
  const [showBlockLibrary, setShowBlockLibrary] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showSaveBlock, setShowSaveBlock] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [blockToSave, setBlockToSave] = useState<EmailBlock | null>(null);
  const [recentBlocks, setRecentBlocks] = useState<EmailBlock[]>([]);
  const [campaign, setCampaign] = useState<any>(null);

  const insertTemplateBlocks = (templateBlocks: EmailBlock[], templateName: string) => {
    const blocksWithIds = templateBlocks.map((block, index) => ({
      ...block,
      id: crypto.randomUUID(),
      campaign_id: campaignId || '',
      order_index: index
    }));
    setBlocks(blocksWithIds);
    setSelectedBlockId(null);
  };

  useEffect(() => {
    if (campaignId) {
      loadCampaign();
      loadBlocks();
    }
  }, [campaignId]);

  // Remove the old auto-save logic since we're using the new AutoSaveManager
  useEffect(() => {
    // Trigger auto-save when blocks change
    if (blocks.length > 0 && selectedBlockId) {
      const selectedBlock = blocks.find(b => b.id === selectedBlockId);
      if (selectedBlock) {
        autoSaveBlock(selectedBlock);
      }
    }
  }, [blocks, selectedBlockId, autoSaveBlock]);

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

  // Manual save function for force save
  const manualSave = () => {
    if (selectedBlockId) {
      const selectedBlock = blocks.find(b => b.id === selectedBlockId);
      if (selectedBlock) {
        forceSave(selectedBlock);
        toast.success('Changes saved manually');
      }
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
    
    // Add to recent blocks
    setRecentBlocks(prev => [newBlock, ...prev.slice(0, 2)]);
  };

  const insertBlock = (block: EmailBlock, position?: number) => {
    const newBlock = {
      ...block,
      id: crypto.randomUUID(),
      campaign_id: campaignId || '',
      order_index: position !== undefined ? position : blocks.length
    };
    
    if (position !== undefined) {
      // Insert at specific position
      const newBlocks = [...blocks];
      newBlocks.splice(position, 0, newBlock);
      setBlocks(newBlocks.map((b, index) => ({ ...b, order_index: index })));
    } else {
      // Add to end
      setBlocks(prev => [...prev, newBlock]);
    }
    
    setSelectedBlockId(newBlock.id);
    
    // Add to recent blocks
    setRecentBlocks(prev => [newBlock, ...prev.slice(0, 2)]);
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

  const handleSwitchToSimple = () => {
    if (blocks.length > 0) {
      if (confirm('Switching to Simple mode will remove all blocks and convert to a plain text email. Continue?')) {
        onSwitchToSimple?.();
      }
    } else {
      onSwitchToSimple?.();
    }
  };

  const handleSaveBlock = (block: EmailBlock) => {
    setBlockToSave(block);
    setShowSaveBlock(true);
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
            <h1 className="text-xl font-semibold">Advanced Email Builder</h1>
            {campaign && (
              <Badge variant="outline">{campaign.name}</Badge>
            )}
            <AutoSaveIndicator 
              status={saveStatus} 
              onRetry={() => manualSave()}
            />
          </div>
          
          <div className="flex items-center gap-3">
            {onSwitchToSimple && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSwitchToSimple}
                className="gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Switch to Simple
              </Button>
             )}
             <Button
               variant="outline"
               size="sm"
               onClick={() => setShowTemplateGallery(true)}
               className="gap-2"
             >
               <Sparkles className="w-4 h-4" />
               Insert Template
             </Button>
             <Button
               variant="outline"
               size="sm"
               onClick={() => setShowBlockLibrary(true)}
               className="gap-2"
             >
               <BookOpen className="w-4 h-4" />
               📚 Block Library
             </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSmartBlocks(true)}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Smart Blocks
            </Button>
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
               onClick={manualSave}
               className="gap-2"
               disabled={!selectedBlockId}
             >
               <Save className="w-4 h-4" />
               Manual Save
             </Button>
             <Button
               variant="outline"
               size="sm"
               onClick={() => setShowSaveTemplate(true)}
               className="gap-2"
               disabled={blocks.length === 0}
             >
               <Archive className="w-4 h-4" />
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
                          <p className="mb-4">Add blocks from the toolbar, use Smart Blocks, or import content</p>
                          <Button 
                            variant="outline" 
                            onClick={() => setShowSmartBlocks(true)}
                            className="gap-2"
                          >
                            <Sparkles className="w-4 h-4" />
                            Browse Smart Blocks
                          </Button>
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
                                 <div className="absolute -right-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                   <Button
                                     variant="ghost"
                                     size="sm"
                                     className="h-6 w-6 p-0"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setShowVersionHistory(true);
                                     }}
                                     title="Version History"
                                   >
                                     <Clock className="w-3 h-3" />
                                   </Button>
                                   <Button
                                     variant="ghost"
                                     size="sm"
                                     className="h-6 w-6 p-0"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       handleSaveBlock(block);
                                     }}
                                     title="Save Block"
                                   >
                                     <Archive className="w-3 h-3" />
                                   </Button>
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

      {/* Smart Content Blocks Sidebar */}
      <SmartContentBlocksSidebar
        open={showSmartBlocks}
        onClose={() => setShowSmartBlocks(false)}
        onAddBlocks={(newBlocks) => {
          const blocksWithIds = newBlocks.map((block, index) => ({
            ...block,
            id: crypto.randomUUID(),
            campaign_id: campaignId || '',
            order_index: blocks.length + index
          }));
          setBlocks(prev => [...prev, ...blocksWithIds]);
        }}
      />

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

      {/* Block Library Drawer */}
      <SavedBlockLibraryDrawer
        open={showBlockLibrary}
        onClose={() => setShowBlockLibrary(false)}
        onInsertBlock={insertBlock}
        recentBlocks={recentBlocks}
      />

      {/* Save Block Modal */}
      {blockToSave && (
        <SaveBlockModal
          open={showSaveBlock}
          onClose={() => {
            setShowSaveBlock(false);
            setBlockToSave(null);
          }}
          block={blockToSave}
          onBlockSaved={() => {
            setShowSaveBlock(false);
            setBlockToSave(null);
          }}
        />
      )}

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

      {/* Version History Modal */}
      {showVersionHistory && selectedBlockId && (
        <BlockVersionModal
          open={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          blockId={selectedBlockId}
          campaignId={campaignId || ''}
          onRestore={(content, blockType) => {
            updateBlock(selectedBlockId, { content, block_type: blockType as BlockType });
            toast.success('Version restored successfully');
          }}
        />
      )}

      {/* Template Gallery Modal */}
      <TemplateGalleryModal
        open={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
        onInsertTemplate={insertTemplateBlocks}
      />
    </div>
  );
};

// Main wrapper component with AutoSaveManager
const CRMCampaignBuilder: React.FC<CRMCampaignBuilderProps> = (props) => {
  const { campaignId } = useParams();
  
  if (!campaignId) {
    return <div className="flex items-center justify-center h-64">Invalid campaign ID</div>;
  }
  
  return (
    <AutoSaveManager campaignId={campaignId}>
      <CRMCampaignBuilderInner {...props} />
    </AutoSaveManager>
  );
};

export default CRMCampaignBuilder;
