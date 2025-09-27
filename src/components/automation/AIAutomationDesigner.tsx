import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AIAutomationDesignerProps {
  onAutomationGenerated?: (automation: any) => void;
}

export const AIAutomationDesigner: React.FC<AIAutomationDesignerProps> = ({
  onAutomationGenerated
}) => {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [goal, setGoal] = useState('');
  const [audience, setAudience] = useState('');
  const [channels, setChannels] = useState<string[]>(['email', 'sms']);
  const [season, setSeason] = useState('');
  const [brandTone, setBrandTone] = useState('');
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!goal.trim()) {
      toast({
        title: "Goal Required",
        description: "Please describe what you want to achieve with this automation.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-automation-flow', {
        body: {
          goal: goal.trim(),
          audience: audience.trim() || null,
          channels: channels.length > 0 ? channels : null,
          season: season || null,
          brandTone: brandTone.trim() || null,
          maxSteps: 5
        }
      });

      if (error) {
        console.error('Error generating automation:', error);
        throw new Error(error.message || 'Failed to generate automation');
      }

      if (!data) {
        throw new Error('No data received from AI');
      }

      console.log('Generated automation data:', data);

      // Save the generated automation to the database
      const { data: savedAutomation, error: saveError } = await supabase
        .from('crm_automations')
        .insert({
          name: `AI: ${goal.slice(0, 50)}${goal.length > 50 ? '...' : ''}`,
          trigger_type: data.trigger,
          flow_state: data.flow_state,
          workflow_steps: data.workflow_steps,
          template_source: 'ai_designer',
          is_active: false,
          compiled_at: new Date().toISOString()
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving automation:', saveError);
        throw new Error('Failed to save generated automation');
      }

      toast({
        title: "Automation Generated! ✨",
        description: "Your AI-designed automation is ready for review.",
      });

      setOpen(false);
      onAutomationGenerated?.(savedAutomation);

      // Reset form
      setGoal('');
      setAudience('');
      setChannels(['email', 'sms']);
      setSeason('');
      setBrandTone('');

    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Could not generate automation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleChannel = (channel: string) => {
    setChannels(prev => 
      prev.includes(channel)
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Design with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Automation Designer
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="goal">What's your goal? *</Label>
            <Textarea
              id="goal"
              placeholder="E.g., Welcome first-time tomato buyers and guide them to become loyal veggie gardeners"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="audience">Target Audience</Label>
              <Textarea
                id="audience"
                placeholder="E.g., new gardeners, houseplant lovers, repeat customers"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="h-20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brandTone">Brand Tone</Label>
              <Textarea
                id="brandTone"
                placeholder="E.g., warm and expert, friendly and local, professional but approachable"
                value={brandTone}
                onChange={(e) => setBrandTone(e.target.value)}
                className="h-20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="flex gap-2">
                {['email', 'sms'].map(channel => (
                  <Badge
                    key={channel}
                    variant={channels.includes(channel) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleChannel(channel)}
                  >
                    {channel.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="season">Season (Optional)</Label>
              <NativeSelect 
                value={season} 
                onChange={(e) => setSeason(e.target.value)}
                options={[
                  { value: '', label: 'Any Season' },
                  { value: 'spring', label: 'Spring' },
                  { value: 'summer', label: 'Summer' },
                  { value: 'fall', label: 'Fall' },
                  { value: 'winter', label: 'Winter' }
                ]}
                placeholder="Select season"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || !goal.trim()}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Automation
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};