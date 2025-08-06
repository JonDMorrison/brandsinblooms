import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, Clock, Sparkles } from 'lucide-react';
import { getTemplatesForTrigger, type Template, type Step } from '@/lib/campaignTemplates';

interface TemplateSelectorProps {
  triggerId: string;
  onSelectTemplate: (steps: Step[]) => void;
  onStartFromScratch: () => void;
  onGenerateWithAI: () => void;
  isGenerating?: boolean;
}

export function TemplateSelector({
  triggerId,
  onSelectTemplate,
  onStartFromScratch,
  onGenerateWithAI,
  isGenerating = false
}: TemplateSelectorProps) {
  const templates = getTemplatesForTrigger(triggerId);

  const getChannelIcon = (channel: 'email' | 'sms') => {
    return channel === 'email' ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />;
  };

  const getChannelColor = (channel: 'email' | 'sms') => {
    return channel === 'email' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Choose a Template</h3>
        <Button 
          variant="outline" 
          onClick={onGenerateWithAI}
          disabled={isGenerating}
          className="gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {isGenerating ? 'Generating...' : 'Generate with AI'}
        </Button>
      </div>

      {templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template, index) => (
            <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{template.name}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span>{template.steps.length} step{template.steps.length > 1 ? 's' : ''}</span>
                  <div className="flex gap-1">
                    {Array.from(new Set(template.steps.map(s => s.channel))).map(channel => (
                      <Badge key={channel} variant="secondary" className={getChannelColor(channel)}>
                        {getChannelIcon(channel)}
                        {channel.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 mb-4">
                  {template.steps.slice(0, 2).map((step, stepIndex) => (
                    <div key={stepIndex} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{step.delayHours === 0 ? 'Immediate' : `${step.delayHours}h delay`}</span>
                      <span>•</span>
                      <span className="truncate">{step.body.substring(0, 40)}...</span>
                    </div>
                  ))}
                  {template.steps.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{template.steps.length - 2} more step{template.steps.length - 2 > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <Button 
                  onClick={() => onSelectTemplate(template.steps)}
                  className="w-full"
                  size="sm"
                >
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-8">
          <CardContent>
            <p className="text-muted-foreground mb-4">No pre-built templates for this trigger yet.</p>
            <Button onClick={onGenerateWithAI} disabled={isGenerating} className="gap-2">
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center pt-4 border-t">
        <Button variant="outline" onClick={onStartFromScratch}>
          Start from Scratch
        </Button>
      </div>
    </div>
  );
}