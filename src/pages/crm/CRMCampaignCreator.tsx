
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, Send, ArrowLeft, Settings, Wand2, Calendar, Eye } from 'lucide-react';

import { CleanEmailBlockEditor } from '@/components/crm/CleanEmailBlockEditor';
import { EmailPreview } from '@/components/crm/EmailPreview';
import { CampaignTemplatesModal } from '@/components/crm/CampaignTemplatesModal';
import { useCampaignTemplates } from '@/hooks/useCampaignTemplates';
import { useCampaignCloning } from '@/hooks/useCampaignCloning';
import { useContentTemplates } from '@/hooks/useContentTemplates';
import { ContentBlock } from '@/types/emailBuilder';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const CRMCampaignCreator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { saveAsTemplate } = useCampaignTemplates();
  const { cloneCampaign } = useCampaignCloning();
  const { templates: contentTemplates } = useContentTemplates();

  // Campaign Settings State
  const [campaignName, setCampaignName] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [senderName, setSenderName] = useState('BloomSuite');
  const [senderEmail, setSenderEmail] = useState('hello@bloomsuite.com');
  const [campaignType, setCampaignType] = useState('email');
  const [description, setDescription] = useState('');

  // Content State
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [activeTab, setActiveTab] = useState('content');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveDraft = async () => {
    if (!user || !campaignName.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('crm_campaigns')
        .insert({
          user_id: user.id,
          name: campaignName,
          type: campaignType,
          subject_line: subjectLine,
          sender_name: senderName,
          sender_email: senderEmail,
          description,
          content_blocks: blocks,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Campaign saved as draft');
      navigate('/crm/campaigns');
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error('Failed to save campaign');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!campaignName.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    try {
      await saveAsTemplate({
        name: campaignName,
        category: campaignType,
        description: description || `Template created from ${campaignName}`,
        content_blocks: blocks
      });

      toast.success('Campaign saved as template');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-full mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/crm/campaigns')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Campaigns
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Create Campaign</h1>
              <p className="text-muted-foreground">Design and schedule your marketing campaign</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setIsTemplateModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Use Template
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveAsTemplate}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save as Template
            </Button>
            <Button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
        </div>

        {/* Campaign Settings - Full Width */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Campaign Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="campaignName">Campaign Name *</Label>
                  <Input
                    id="campaignName"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Enter campaign name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="campaignType">Campaign Type</Label>
                  <Select value={campaignType} onValueChange={setCampaignType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="social">Social Media</SelectItem>
                      <SelectItem value="multi-channel">Multi-Channel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="subjectLine">Subject Line</Label>
                  <Input
                    id="subjectLine"
                    value={subjectLine}
                    onChange={(e) => setSubjectLine(e.target.value)}
                    placeholder="Enter email subject line"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="senderName">Sender Name</Label>
                  <Input
                    id="senderName"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Sender name"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="senderEmail">Sender Email</Label>
                  <Input
                    id="senderEmail"
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="sender@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Campaign description (optional)"
                    className="mt-1"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Main Content Area - 2 Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Content Column */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Content Blocks</CardTitle>
              </CardHeader>
              <CardContent>
            <CleanEmailBlockEditor
              blocks={blocks}
              onBlocksChange={setBlocks}
            />
              </CardContent>
            </Card>
          </div>

          {/* Tools & Preview Column */}
          <div className="space-y-6">
            <Card>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <CardHeader className="pb-3">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="content" className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4" />
                      Enhancement
                    </TabsTrigger>
                    <TabsTrigger value="schedule" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Schedule
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent>
                  <TabsContent value="content" className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-3">AI Enhancement Tools</h3>
                      <div className="space-y-3">
                        <Button variant="outline" className="w-full justify-start">
                          <Wand2 className="h-4 w-4 mr-2" />
                          Improve Subject Line
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                          <Wand2 className="h-4 w-4 mr-2" />
                          Enhance Content
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                          <Wand2 className="h-4 w-4 mr-2" />
                          Generate CTA
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="schedule" className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-3">Schedule Campaign</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Set when your campaign should be sent
                      </p>
                      <div className="space-y-3">
                        <Button variant="outline" className="w-full justify-start">
                          <Calendar className="h-4 w-4 mr-2" />
                          Send Now
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule for Later
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="preview" className="space-y-4">
                    <EmailPreview
                      blocks={blocks}
                      campaignName={campaignName}
                      subjectLine={subjectLine}
                      senderName={senderName}
                      senderEmail={senderEmail}
                    />
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        </div>

        {/* Template Modal */}
        <CampaignTemplatesModal
          open={isTemplateModalOpen}
          onOpenChange={setIsTemplateModalOpen}
          onTemplateSelect={(template) => {
            setCampaignName(template.name);
            setSubjectLine(template.subject_line || '');
            setSenderName(template.sender_name || senderName);
            setSenderEmail(template.sender_email || senderEmail);
            setDescription(template.description || '');
            setBlocks(template.content_blocks || []);
            setIsTemplateModalOpen(false);
            toast.success('Template applied successfully');
          }}
        />
      </div>
    </div>
  );
};

export default CRMCampaignCreator;
