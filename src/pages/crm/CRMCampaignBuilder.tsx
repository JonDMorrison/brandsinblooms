import React, { useState, useEffect, useRef } from 'react';
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
import { BuilderEmptyState } from '@/components/crm/BuilderEmptyState';
import { OnboardingTips } from '@/components/crm/OnboardingTips';
import { BlockInlineToolbar } from '@/components/crm/BlockInlineToolbar';
import { MobilePreviewFrame } from '@/components/crm/MobilePreviewFrame';
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
  const [showOnboardingTips, setShowOnboardingTips] = useState(true);

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

  const prevBlocksRef = useRef<EmailBlock[]>([]);
  
  // Auto-save when blocks change - track individual block changes
  useEffect(() => {
    if (blocks.length === 0) return;
    
    // Find blocks that have changed
    const changedBlocks = blocks.filter(block => {
      const prevBlock = prevBlocksRef.current.find(b => b.id === block.id);
      if (!prevBlock) return true; // New block
      
      // Compare relevant fields
      return JSON.stringify(block.content) !== JSON.stringify(prevBlock.content) ||
             block.image_url !== prevBlock.image_url ||
             block.cta_url !== prevBlock.cta_url ||
             block.cta_text !== prevBlock.cta_text;
    });
    
    // Save changed blocks
    changedBlocks.forEach(block => {
      console.log('📝 Detected change in block:', block.id, block.block_type);
      autoSaveBlock(block);
    });
    
    // Update ref
    prevBlocksRef.current = blocks;
  }, [blocks, autoSaveBlock]);

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
    
    setBlocks(data?.map(block => {
      let rawContent = typeof block.content === 'string' ? JSON.parse(block.content) : block.content;
      
      // Recursively unwrap nested content structure to find the actual content object
      let contentObj = rawContent;
      while (contentObj && typeof contentObj === 'object' && contentObj.content && typeof contentObj.content === 'object') {
        contentObj = contentObj.content;
      }
      
      // Extract the actual text content for display
      let displayText = '';
      if (contentObj) {
        // Try different possible content fields in priority order
        displayText = contentObj.body || contentObj.content || contentObj.headline || contentObj.text || '';
      }
      
      // Create a properly structured content object for EmailBlockRenderer
      // EmailBlockRenderer expects: block.content.content for text content
      // All fields are stored in the content JSON
      const processedContent = {
        title: contentObj?.title || contentObj?.headline || '',
        content: displayText, // This is what EmailBlockRenderer.renderText() uses
        body: contentObj?.body || displayText,
        headline: contentObj?.headline || contentObj?.title || '',
        subtitle: contentObj?.subtitle || '',
        imageUrl: contentObj?.imageUrl || '',
        layout: contentObj?.layout || 'full-width',
        textAlign: contentObj?.textAlign || 'left',
        // Newsletter header specific fields - all from content JSON
        issueNumber: contentObj?.issueNumber || '',
        publishDate: contentObj?.publishDate || '',
        backgroundImageUrl: contentObj?.backgroundImageUrl || '',
        altText: contentObj?.altText || ''
      };
      
      console.log('✅ Block processed:', block.id, { 
        blockType: block.block_type,
        originalStructure: Object.keys(rawContent),
        extractedText: displayText.substring(0, 100) + '...',
        finalContent: processedContent,
        hasTitle: !!processedContent.title,
        hasSubtitle: !!processedContent.subtitle,
        hasIssueNumber: !!processedContent.issueNumber,
        hasPublishDate: !!processedContent.publishDate,
        hasBackgroundImageUrl: !!processedContent.backgroundImageUrl
      });
      
      return {
        ...block,
        block_type: block.block_type as BlockType,
        content: processedContent
      };
    }) || []);
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
    setBlocks(prev => prev.map(block => {
      if (block.id !== blockId) return block;
      
      // Simply merge updates at top level - autosave hook will handle database serialization
      const updatedBlock = { 
        ...block, 
        ...updates
      };
      
      return updatedBlock;
    }));
  };

  const duplicateBlock = (blockId: string) => {
    const blockToDuplicate = blocks.find(block => block.id === blockId);
    if (!blockToDuplicate) return;

    const newBlock: EmailBlock = {
      ...blockToDuplicate,
      id: crypto.randomUUID(),
      order_index: blockToDuplicate.order_index + 1
    };

    const newBlocks = [...blocks];
    const insertIndex = blocks.findIndex(block => block.id === blockId) + 1;
    newBlocks.splice(insertIndex, 0, newBlock);
    
    // Update order indices
    const reorderedBlocks = newBlocks.map((block, index) => ({
      ...block,
      order_index: index
    }));
    
    setBlocks(reorderedBlocks);
    setSelectedBlockId(newBlock.id);
  };

  const deleteBlock = (blockId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this block?');
    if (!confirmed) return;
    
    setBlocks(prev => prev.filter(block => block.id !== blockId).map((block, index) => ({
      ...block,
      order_index: index
    })));
    
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
    
    // Update order indices and save
    const blocksWithOrder = reorderedBlocks.map((block, index) => ({
      ...block,
      order_index: index
    }));
    
    setBlocks(blocksWithOrder);
  };

  const generateEmailHTML = () => {
    // Generate final email HTML with inline styles
    const htmlContent = blocks.map(block => 
      EmailBlockRenderer({ block, globalSettings, isPreview: false })
    ).join('');
    
    // Footer HTML would be added here if needed for this builder
    
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

  const handleStartFromScratch = () => {
    addBlock('header');
    setShowOnboardingTips(false);
  };

  const onboardingSteps = [
    {
      step: 1,
      title: "Drag & Drop Content",
      description: "Use the toolbar to add text, images, buttons, and more.",
      highlightSelector: ".w-20.border-r" // Block toolbar
    },
    {
      step: 2,
      title: "Style Your Campaign", 
      description: "Customize fonts, colors, and layout to match your brand.",
      highlightSelector: "[title='Styling']" // Global settings button
    },
    {
      step: 3,
      title: "Preview & Send",
      description: "View your campaign on mobile or desktop, then schedule or send.",
      highlightSelector: ".flex.items-center.border.rounded-lg" // Preview controls
    }
  ];

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
                Desktop View
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode('mobile')}
                className="rounded-none border-0 gap-2"
              >
                <Smartphone className="w-4 h-4" />
                Mobile View
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
            {previewMode === 'mobile' ? (
              <MobilePreviewFrame>
                {blocks.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <div className="text-4xl mb-4">📱</div>
                    <h3 className="text-lg font-medium mb-2">Mobile Preview</h3>
                    <p className="text-sm">Add blocks to see how your email looks on mobile</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {blocks.map((block) => (
                      <div key={block.id} className="email-block">
                        <EmailBlockRenderer 
                          block={block} 
                          globalSettings={globalSettings} 
                          isPreview={true}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </MobilePreviewFrame>
            ) : (
              <div className={`mx-auto bg-white shadow-xl rounded-lg border max-w-2xl`}>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="email-blocks">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                       {blocks.length === 0 ? (
                         <div className="p-8">
                           <BuilderEmptyState
                             onBrowseTemplates={() => setShowTemplateGallery(true)}
                             onStartFromScratch={handleStartFromScratch}
                           />
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
                                className={`group relative transition-all duration-200 ${
                                  selectedBlockId === block.id ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
                                } ${snapshot.isDragging ? 'opacity-75 shadow-2xl scale-105' : ''}`}
                                onClick={() => setSelectedBlockId(block.id)}
                              >
                                {/* Drag Handle */}
                                <div 
                                  {...provided.dragHandleProps}
                                  className="absolute -left-8 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-grab active:cursor-grabbing z-20"
                                  title="Drag to reorder"
                                >
                                  <div className="p-2 bg-background border rounded-md shadow-sm hover:bg-muted">
                                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                </div>

                                {/* Hover Glow Effect */}
                                <div className={`absolute inset-0 rounded-lg transition-all duration-200 pointer-events-none ${
                                  selectedBlockId === block.id 
                                    ? 'bg-primary/5 border-2 border-primary/20' 
                                    : 'group-hover:bg-muted/30 group-hover:border group-hover:border-border/50'
                                }`} />

                                {/* Block Content */}
                                <div className="relative">
                                  <EmailBlockRenderer 
                                    block={block} 
                                    globalSettings={globalSettings} 
                                    isPreview={false}
                                  />
                                </div>

                                {/* Inline Toolbar */}
                                <BlockInlineToolbar
                                  onEdit={() => setSelectedBlockId(block.id)}
                                  onDuplicate={() => duplicateBlock(block.id)}
                                  onDelete={() => deleteBlock(block.id)}
                                />

                                {/* Version History Button */}
                                {selectedBlockId === block.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowVersionHistory(true)}
                                    className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 bg-background/95 backdrop-blur-sm border"
                                    title="View version history"
                                  >
                                    <Clock className="w-3 h-3" />
                                  </Button>
                                )}
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
            )}
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

      {/* Onboarding Tips */}
      {showOnboardingTips && blocks.length === 0 && (
        <OnboardingTips
          steps={onboardingSteps}
          onDismiss={() => setShowOnboardingTips(false)}
        />
      )}
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
