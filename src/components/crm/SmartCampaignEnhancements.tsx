import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/utils/toast';
import { usePersonaAwareGeneration } from '@/hooks/usePersonaAwareGeneration';
import { useEnhancedSmartTime } from '@/hooks/useEnhancedSmartTime';
import { ContentBlock } from '@/types/emailBuilder';
import { 
  Sparkles, 
  Clock, 
  Image, 
  AlertTriangle, 
  CheckCircle, 
  Edit3, 
  RefreshCw,
  Tag,
  Calendar,
  Clock4
} from 'lucide-react';

interface SmartCampaignEnhancementsProps {
  subjectLine: string;
  onSubjectLineChange: (value: string) => void;
  preheaderText: string;
  onPreheaderTextChange: (value: string) => void;
  contentBlocks: ContentBlock[];
  personaTags: string[];
  onPersonaTagsChange: (tags: string[]) => void;
  syncedFrom?: string;
  themeCampaignId?: string;
  campaignName?: string;
}

export const SmartCampaignEnhancements: React.FC<SmartCampaignEnhancementsProps> = ({
  subjectLine,
  onSubjectLineChange,
  preheaderText,
  onPreheaderTextChange,
  contentBlocks,
  personaTags,
  onPersonaTagsChange,
  syncedFrom,
  themeCampaignId,
  campaignName
}) => {
  const { generateSubjectLines, loading: aiLoading } = usePersonaAwareGeneration();
  const { getEnhancedRecommendations } = useEnhancedSmartTime();
  
  const [newTag, setNewTag] = useState('');
  const [selectedTone, setSelectedTone] = useState<'friendly' | 'urgent' | 'seasonal'>('friendly');
  const [recommendedSendTimes, setRecommendedSendTimes] = useState<any[]>([]);
  const [contentWarnings, setContentWarnings] = useState<string[]>([]);
  const [loadingTimeRecommendations, setLoadingTimeRecommendations] = useState(false);

  // Auto-generate preheader from first block content
  useEffect(() => {
    if (!preheaderText && contentBlocks.length > 0) {
      const firstTextBlock = contentBlocks.find(block => block.content && block.type === 'text');
      if (firstTextBlock?.content) {
        const cleanText = firstTextBlock.content.replace(/<[^>]*>/g, '').substring(0, 90);
        onPreheaderTextChange(cleanText);
      }
    }
  }, [contentBlocks, preheaderText, onPreheaderTextChange]);

  // Content validation
  useEffect(() => {
    const warnings: string[] = [];
    
    contentBlocks.forEach((block, index) => {
      const blockNum = index + 1;
      
      // Check for missing CTAs
      if (block.type === 'text' && !block.ctaText && !block.ctaUrl) {
        warnings.push(`Block ${blockNum}: Missing call-to-action`);
      }
      
      // Check for missing image alt text
      if (block.type === 'image' && block.imageUrl && !block.altText) {
        warnings.push(`Block ${blockNum}: Image missing alt text`);
      }
      
      // Check for missing headlines in header blocks
      if (block.type === 'header' && !block.headline) {
        warnings.push(`Block ${blockNum}: Header missing headline`);
      }
    });
    
    setContentWarnings(warnings);
  }, [contentBlocks]);

  // Get send time recommendations
  useEffect(() => {
    const loadSendTimes = async () => {
      if (personaTags.length === 0) return;
      
      setLoadingTimeRecommendations(true);
      try {
        const recommendations = await getEnhancedRecommendations({
          platform: 'email',
          contentType: 'newsletter',
          urgency: selectedTone === 'urgent' ? 'high' : 'medium'
        });
        setRecommendedSendTimes(recommendations.slice(0, 3));
      } catch (error) {
        console.error('Failed to load send times:', error);
      } finally {
        setLoadingTimeRecommendations(false);
      }
    };

    loadSendTimes();
  }, [personaTags, selectedTone, getEnhancedRecommendations]);

  const handleGenerateSubjectLines = async () => {
    try {
      const contentSummary = contentBlocks
        .filter(block => block.content)
        .map(block => block.content)
        .join(' ')
        .substring(0, 500);

      const result = await generateSubjectLines({
        topic: campaignName || 'newsletter',
        content: contentSummary,
        tone: selectedTone,
        personaTags
      });

      if (result.subjectLines && result.subjectLines.length > 0) {
        // Use the first generated subject line
        onSubjectLineChange(result.subjectLines[0]);
        toast.success('Subject line generated!');
      }
    } catch (error) {
      console.error('Subject line generation failed:', error);
      toast.error('Failed to generate subject line');
    }
  };

  const addPersonaTag = () => {
    if (newTag.trim() && !personaTags.includes(newTag.trim())) {
      onPersonaTagsChange([...personaTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removePersonaTag = (tagToRemove: string) => {
    onPersonaTagsChange(personaTags.filter(tag => tag !== tagToRemove));
  };

  const formatSendTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Sync Health Indicator */}
      {syncedFrom && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">
                Synced from: {campaignName || 'Newsletter Campaign'}
              </span>
              {contentWarnings.length === 0 ? (
                <Badge variant="secondary" className="ml-auto">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Ready to Send
                </Badge>
              ) : (
                <Badge variant="destructive" className="ml-auto">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {contentWarnings.length} Issues
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Warnings */}
      {contentWarnings.length > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Content Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {contentWarnings.map((warning, index) => (
                <li key={index} className="text-sm text-warning flex items-center gap-2">
                  <div className="w-1 h-1 bg-warning rounded-full" />
                  {warning}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Audience Tagging */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Audience Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {personaTags.map((tag, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => removePersonaTag(tag)}
              >
                {tag} ×
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add audience tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addPersonaTag()}
            />
            <Button onClick={addPersonaTag} variant="outline">Add</Button>
          </div>
        </CardContent>
      </Card>

      {/* Subject Line & Preheader Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Smart Content Generation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="tone-select">Tone</Label>
            <Select value={selectedTone} onValueChange={(value: any) => setSelectedTone(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="seasonal">Seasonal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="subject-line">Subject Line</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSubjectLines}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                Generate
              </Button>
            </div>
            <Input
              id="subject-line"
              value={subjectLine}
              onChange={(e) => onSubjectLineChange(e.target.value)}
              placeholder="Enter email subject..."
            />
          </div>

          <div>
            <Label htmlFor="preheader">Preheader Text (40-90 characters)</Label>
            <Input
              id="preheader"
              value={preheaderText}
              onChange={(e) => onPreheaderTextChange(e.target.value)}
              placeholder="Brief preview text..."
              maxLength={90}
            />
            <div className="text-xs text-muted-foreground mt-1">
              {preheaderText.length}/90 characters
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Send Time Optimizer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock4 className="h-5 w-5" />
            Optimal Send Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTimeRecommendations ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading recommendations...
            </div>
          ) : recommendedSendTimes.length > 0 ? (
            <div className="space-y-2">
              {recommendedSendTimes.map((time, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <div>
                    <div className="font-medium">{formatSendTime(time.datetime)}</div>
                    <div className="text-sm text-muted-foreground">{time.reasoning}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={time.source === 'ai' ? 'default' : 'secondary'}>
                      {Math.round(time.confidence * 100)}% confidence
                    </Badge>
                    <Button variant="outline" size="sm">
                      <Calendar className="h-4 w-4 mr-1" />
                      Schedule
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-4">
              Add audience tags to get personalized send time recommendations
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Optimization Checker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Image className="h-5 w-5" />
            Image Optimization
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contentBlocks.filter(block => block.type === 'image').length === 0 ? (
            <div className="text-muted-foreground text-center py-4">
              No images in this campaign
            </div>
          ) : (
            <div className="space-y-2">
              {contentBlocks
                .filter(block => block.type === 'image')
                .map((block, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Image className="h-4 w-4" />
                      <span className="text-sm">Image Block {index + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {block.altText ? (
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Alt text ✓
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Missing alt text
                        </Badge>
                      )}
                      <Button variant="outline" size="sm">
                        <Edit3 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};