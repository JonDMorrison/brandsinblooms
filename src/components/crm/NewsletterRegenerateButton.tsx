import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NewsletterRegenerateButtonProps {
  originalContent: string;
  onContentGenerated: (newContent: string) => void;
  isFromNewsletter: boolean;
}

export const NewsletterRegenerateButton: React.FC<NewsletterRegenerateButtonProps> = ({
  originalContent,
  onContentGenerated,
  isFromNewsletter
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  if (!isFromNewsletter) {
    return null;
  }

  const handleRegenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please provide instructions for how to modify the newsletter content.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Here you would call your AI service to regenerate content
      // For now, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, you'd process the originalContent with the new prompt
      const regeneratedContent = `
<div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px 20px; text-align: center; color: white;">
    <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Your Garden Newsletter - Updated</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Modified based on your instructions</p>
  </div>
  
  <div style="padding: 30px 20px; background: #ffffff;">
    <p style="margin: 0 0 16px 0; color: #475569; line-height: 1.6;">
      <strong>Updated Content:</strong> ${prompt}
    </p>
    <p style="margin: 0 0 16px 0; color: #475569; line-height: 1.6;">
      This content has been regenerated based on your original newsletter with the modifications you requested.
    </p>
  </div>
</div>
      `;
      
      onContentGenerated(regeneratedContent);
      setIsOpen(false);
      setPrompt('');
      
      toast({
        title: "Content Regenerated! ✨",
        description: "Your newsletter content has been updated based on your instructions."
      });
      
    } catch (error) {
      console.error('Error regenerating content:', error);
      toast({
        title: "Generation Failed",
        description: "There was an issue regenerating the content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-green-50 hover:bg-green-100 border-green-200">
          <RefreshCw className="h-4 w-4 mr-2" />
          Regenerate from Newsletter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Regenerate Newsletter Content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Your original newsletter content will be processed with AI to create a new email version based on your instructions below.
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="regenerate-prompt">How would you like to modify the content?</Label>
            <Textarea
              id="regenerate-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Make it more promotional, focus on beginner gardeners, add a spring theme, make it shorter..."
              rows={4}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={handleRegenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate Content
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};