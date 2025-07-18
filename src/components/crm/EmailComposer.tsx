
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Mail, Eye, Send, Save } from 'lucide-react';
import { DeliverabilityAssistant } from './DeliverabilityAssistant';
import { MultiSegmentSelector } from './MultiSegmentSelector';
import { TimezoneScheduler } from './TimezoneScheduler';

interface EmailComposerProps {
  onSave: (emailData: any) => void;
  onSend: (emailData: any) => void;
  initialData?: any;
}

interface Segment {
  id: string;
  name: string;
  description?: string;
  customer_count: number;
  type: 'predefined' | 'custom';
}

export const EmailComposer = ({ onSave, onSend, initialData }: EmailComposerProps) => {
  const [emailData, setEmailData] = useState({
    subject: initialData?.subject || '',
    preheader: initialData?.preheader || '',
    senderName: initialData?.senderName || '',
    senderEmail: initialData?.senderEmail || '',
    content: initialData?.content || '',
    segments: initialData?.segments || [],
    schedule: initialData?.schedule || { type: 'optimal' }
  });

  const [activeTab, setActiveTab] = useState('compose');
  const [isDirty, setIsDirty] = useState(false);

  const handleFieldChange = (field: string, value: any) => {
    setEmailData(prev => ({
      ...prev,
      [field]: value
    }));
    setIsDirty(true);
  };

  const handleSave = () => {
    onSave(emailData);
    setIsDirty(false);
  };

  const handleSend = () => {
    onSend(emailData);
  };

  const getTotalAudience = () => {
    return emailData.segments.reduce((total: number, segment: Segment) => 
      total + segment.customer_count, 0
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Email Campaign Composer
          </h2>
          <p className="text-gray-600">Create and optimize your email campaign</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              Unsaved changes
            </Badge>
          )}
          <Button variant="outline" onClick={handleSave} disabled={!isDirty}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={handleSend} disabled={emailData.segments.length === 0}>
            <Send className="h-4 w-4 mr-2" />
            Send Campaign
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Email Content */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Sender Information */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="senderName">Sender Name</Label>
                      <Input
                        id="senderName"
                        value={emailData.senderName}
                        onChange={(e) => handleFieldChange('senderName', e.target.value)}
                        placeholder="Your Garden Center"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="senderEmail">Sender Email</Label>
                      <Input
                        id="senderEmail"
                        type="email"
                        value={emailData.senderEmail}
                        onChange={(e) => handleFieldChange('senderEmail', e.target.value)}
                        placeholder="hello@yourgardencenter.com"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Subject Line */}
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      value={emailData.subject}
                      onChange={(e) => handleFieldChange('subject', e.target.value)}
                      placeholder="Your compelling subject line..."
                    />
                  </div>

                  {/* Preheader */}
                  <div className="space-y-2">
                    <Label htmlFor="preheader">Preheader Text (Optional)</Label>
                    <Input
                      id="preheader"
                      value={emailData.preheader}
                      onChange={(e) => handleFieldChange('preheader', e.target.value)}
                      placeholder="Preview text that appears after the subject line..."
                    />
                  </div>

                  <Separator />

                  {/* Email Content */}
                  <div className="space-y-2">
                    <Label htmlFor="content">Email Content</Label>
                    <Textarea
                      id="content"
                      value={emailData.content}
                      onChange={(e) => handleFieldChange('content', e.target.value)}
                      placeholder="Write your email content here..."
                      className="min-h-[300px]"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Deliverability Assistant */}
            <div className="lg:col-span-1">
              <DeliverabilityAssistant
                subject={emailData.subject}
                content={emailData.content}
                senderName={emailData.senderName}
                preheader={emailData.preheader}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audience">
          <MultiSegmentSelector
            selectedSegments={emailData.segments}
            onSegmentsChange={(segments) => handleFieldChange('segments', segments)}
          />
        </TabsContent>

        <TabsContent value="schedule">
          <TimezoneScheduler
            onScheduleChange={(schedule) => handleFieldChange('schedule', schedule)}
            defaultSchedule={emailData.schedule}
          />
        </TabsContent>

        <TabsContent value="review" className="space-y-6">
          {/* Campaign Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Campaign Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Subject Line</Label>
                  <p className="font-medium">{emailData.subject || 'No subject set'}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Sender</Label>
                  <p className="font-medium">
                    {emailData.senderName} &lt;{emailData.senderEmail}&gt;
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Audience Size</Label>
                  <p className="font-medium">{getTotalAudience().toLocaleString()} contacts</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Segments</Label>
                  <p className="font-medium">{emailData.segments.length} selected</p>
                </div>
              </div>

              {emailData.preheader && (
                <div>
                  <Label className="text-sm text-muted-foreground">Preheader</Label>
                  <p className="font-medium">{emailData.preheader}</p>
                </div>
              )}

              <Separator />

              <div>
                <Label className="text-sm text-muted-foreground">Content Preview</Label>
                <div className="mt-2 p-4 border rounded-lg bg-gray-50 max-h-40 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">
                    {emailData.content || 'No content added yet...'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Final Deliverability Check */}
          <DeliverabilityAssistant
            subject={emailData.subject}
            content={emailData.content}
            senderName={emailData.senderName}
            preheader={emailData.preheader}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
