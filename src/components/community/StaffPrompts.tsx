import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Camera, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { UGCUploadForm } from './UGCUploadForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface StaffPrompt {
  id: string;
  title: string;
  message: string;
  frequency: string;
  next_trigger_at: string | null;
  is_active: boolean;
}

interface StaffPromptsProps {
  onUploadClick?: () => void;
}

export const StaffPrompts = ({ onUploadClick }: StaffPromptsProps) => {
  const [prompts, setPrompts] = useState<StaffPrompt[]>([]);
  const [completedPrompts, setCompletedPrompts] = useState<Set<string>>(new Set());
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchPrompts = async () => {
    try {
      // Fetch active prompts
      const { data: promptsData, error: promptsError } = await (supabase as any)
        .from('staff_prompts')
        .select('*')
        .eq('is_active', true)
        .order('next_trigger_at', { ascending: true });

      if (promptsError) throw promptsError;

      // Fetch completed prompts for today
      const today = new Date().toISOString().split('T')[0];
      const { data: responsesData, error: responsesError } = await (supabase as any)
        .from('staff_prompt_responses')
        .select('prompt_id')
        .eq('staff_id', user?.id)
        .gte('completed_at', today);

      if (responsesError) throw responsesError;

      setPrompts((promptsData as StaffPrompt[]) || []);
      setCompletedPrompts(new Set(((responsesData as any[])?.map(r => r.prompt_id)) || []));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, [user]);

  const handleStartPrompt = (promptId: string) => {
    setSelectedPromptId(promptId);
    setShowUploadDialog(true);
  };

  const handleUploadSuccess = () => {
    setShowUploadDialog(false);
    setSelectedPromptId(null);
    fetchPrompts();
    toast({
      title: 'Congratulations! 🎉',
      description: 'You completed a prompt!',
    });
  };

  // Get today's top prompts (not completed)
  const todayPrompts = prompts.filter(p => !completedPrompts.has(p.id)).slice(0, 3);

  if (loading) {
    return <div className="text-center py-12">Loading prompts...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-6 border-2 border-primary/20">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">Today's Challenge</h2>
            <p className="text-muted-foreground mb-4">
              Help us capture amazing customer stories! Complete prompts to earn recognition.
            </p>
            {completedPrompts.size > 0 && (
              <Badge variant="default" className="mb-4">
                ✨ {completedPrompts.size} completed today
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4">
        {todayPrompts.length === 0 ? (
          <Card className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-xl font-semibold mb-2">All Done! 🎉</h3>
            <p className="text-muted-foreground">
              You've completed all available prompts. Check back tomorrow for new challenges!
            </p>
          </Card>
        ) : (
          todayPrompts.map((prompt) => (
            <Card key={prompt.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{prompt.title}</h3>
                    <Badge variant="outline">{prompt.frequency}</Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">{prompt.message}</p>
                  <Button
                    onClick={() => handleStartPrompt(prompt.id)}
                    className="gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Start This Prompt
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Prompt</DialogTitle>
          </DialogHeader>
          <UGCUploadForm
            onSuccess={handleUploadSuccess}
            promptId={selectedPromptId || undefined}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
