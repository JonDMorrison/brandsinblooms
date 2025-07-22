import React, { useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
  FileText,
  Eye,
  Type,
  AlignLeft,
  ImageIcon,
  Mouse,
  Mail
} from "lucide-react"
// import { NewsletterContentImporter } from '@/components/content-sidebar/newsletter/NewsletterContentImporter';
// import { SmartSendOptimization } from '@/components/content-sidebar/SmartSendOptimization';
import { EmailPreview } from '@/components/crm/EmailPreview';
// import { ContentBlockEditor } from '@/components/crm/ContentBlockEditor';
import { ContentBlock } from '@/types/emailBuilder';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from 'uuid';

export const CRMCampaignCreator = () => {
  const [campaignName, setCampaignName] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [activeTab, setActiveTab] = useState('content');
  const [isImporting, setIsImporting] = useState(false);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [sendReasoning, setSendReasoning] = useState<string | null>(null);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);

  const handleNewsletterImport = useCallback((importedContent: ContentBlock[]) => {
    setContentBlocks(importedContent);
    setIsImporting(false);
  }, []);

  const addContentBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: uuidv4(),
      type,
      source: 'manual',
      content: 'Your content here',
    };
    setContentBlocks([...contentBlocks, newBlock]);
  };

  const updateContentBlock = (id: string, updatedBlock: ContentBlock) => {
    setContentBlocks(
      contentBlocks.map((block) => (block.id === id ? updatedBlock : block))
    );
  };

  const deleteContentBlock = (id: string) => {
    setContentBlocks(contentBlocks.filter((block) => block.id !== id));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const startIndex = result.source.index;
    const endIndex = result.destination.index;

    const reorderedBlocks = Array.from(contentBlocks);
    const [removed] = reorderedBlocks.splice(startIndex, 1);
    reorderedBlocks.splice(endIndex, 0, removed);

    setContentBlocks(reorderedBlocks);
  };

  const handleSaveDraft = () => {
    // Placeholder for save draft logic
    alert('Draft saved!');
  };

  const handleCreateCampaign = () => {
    // Placeholder for create campaign logic
    alert('Campaign created!');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Campaign</h1>
            <p className="text-muted-foreground">
              Build and send targeted email campaigns to your customers
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveDraft}
              disabled={!campaignName.trim()}
              variant="secondary"
            >
              Save Draft
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={!campaignName.trim() || contentBlocks.length === 0}
            >
              Create Campaign
            </Button>
          </div>
        </div>

        {/* Campaign Settings - Full Width */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Campaign Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  placeholder="Enter campaign name"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subject-line">Subject Line</Label>
                <Input
                  id="subject-line"
                  placeholder="Enter email subject"
                  value={subjectLine}
                  onChange={(e) => setSubjectLine(e.target.value)}
                />
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="enhance">Enhance</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                {/* Content tab content moved to grid below */}
              </TabsContent>

              <TabsContent value="enhance" className="space-y-4">
                <div className="p-6 text-center text-muted-foreground">
                  Smart send optimization features coming soon...
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto-send"
                      checked={autoSendEnabled}
                      onCheckedChange={setAutoSendEnabled}
                    />
                    <Label htmlFor="auto-send">Enable auto-send when ready</Label>
                  </div>
                  
                  {scheduledAt && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Scheduled Send Time:</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(scheduledAt).toLocaleString()}
                      </p>
                      {sendReasoning && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {sendReasoning}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Content Builder */}
          <div className="lg:col-span-2 space-y-6">
            {activeTab === 'content' && (
              <>
                {/* Newsletter Content Import */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Newsletter Content
                    </CardTitle>
                    <CardDescription>
                      Import content from your latest newsletter
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-6 text-center text-muted-foreground">
                      Newsletter import feature coming soon...
                    </div>
                  </CardContent>
                </Card>

                {/* Content Blocks */}
                <Card>
                  <CardHeader>
                    <CardTitle>Email Content</CardTitle>
                    <CardDescription>
                      Add and arrange your email content blocks
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Block Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addContentBlock('header')}
                        className="flex items-center gap-2"
                      >
                        <Type className="h-4 w-4" />
                        Header
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addContentBlock('text')}
                        className="flex items-center gap-2"
                      >
                        <AlignLeft className="h-4 w-4" />
                        Text
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addContentBlock('image')}
                        className="flex items-center gap-2"
                      >
                        <ImageIcon className="h-4 w-4" />
                        Image
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addContentBlock('button')}
                        className="flex items-center gap-2"
                      >
                        <Mouse className="h-4 w-4" />
                        Button
                      </Button>
                    </div>

                    {/* Content Blocks List */}
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="content-blocks">
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-3"
                          >
                            {contentBlocks.map((block, index) => (
                              <Draggable
                                key={block.id}
                                draggableId={block.id}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`${
                                      snapshot.isDragging ? 'rotate-2 scale-105' : ''
                                    } transition-transform`}
                                  >
                                    <div className="p-4 border rounded-lg bg-card">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{block.type} Block</span>
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={() => deleteContentBlock(block.id)}
                                        >
                                          Delete
                                        </Button>
                                      </div>
                                      <p className="text-sm text-muted-foreground mt-2">
                                        {block.content}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>

                    {contentBlocks.length === 0 && (
                      <div className="text-center py-12 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                        <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No content blocks yet</h3>
                        <p className="text-muted-foreground mb-4">
                          Add your first content block to start building your email
                        </p>
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addContentBlock('header')}
                          >
                            Add Header
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addContentBlock('text')}
                          >
                            Add Text
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EmailPreview
                  blocks={contentBlocks}
                  campaignName={campaignName}
                  subjectLine={subjectLine}
                  senderName="Your Company"
                  senderEmail="noreply@yourcompany.com"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
