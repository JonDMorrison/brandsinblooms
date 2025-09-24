import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IdeaGrid } from './IdeaGrid';
import { NewsletterLayoutPicker } from '../NewsletterLayoutPicker';
import { NewsletterIdea, NewsletterTemplate } from '@/types/newsletter';
import { useNewsletterIdeas } from '@/hooks/useNewsletterIdeas';
import { ArrowLeft, Sparkles, Search, X } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

interface NewsletterPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

type PickerStep = 'ideas' | 'layout';

export const NewsletterPicker: React.FC<NewsletterPickerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { ideas, templates, loading, generateAIIdeas } = useNewsletterIdeas();
  
  const [currentStep, setCurrentStep] = useState<PickerStep>('ideas');
  const [selectedIdea, setSelectedIdea] = useState<NewsletterIdea | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<'block-builder' | 'simple-email' | null>('block-builder');
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);

  // Default to block-builder layout
  useEffect(() => {
    if (!selectedLayout) {
      setSelectedLayout('block-builder');
    }
  }, [selectedLayout]);

  const handleSelectIdea = (idea: NewsletterIdea) => {
    setSelectedIdea(idea);
    setCurrentStep('layout');
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;
    
    setGeneratingAI(true);
    try {
      await generateAIIdeas(aiPrompt);
      setAiPrompt('');
    } catch (error) {
      console.error('Failed to generate AI ideas:', error);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleContinue = () => {
    if (!selectedIdea || !selectedLayout) return;

    // Navigate to newsletter builder with template data
    const params = new URLSearchParams({
      type: 'newsletter',
      templateId: selectedIdea.id,
      layout: selectedLayout,
      source: 'picker',
      title: selectedIdea.title,
      description: selectedIdea.description,
      category: selectedIdea.category
    });
    
    navigate(`/crm/campaigns/new?${params.toString()}`);
    onClose();
  };

  const handleBack = () => {
    if (currentStep === 'layout') {
      setCurrentStep('ideas');
      setSelectedIdea(null);
    }
  };

  const handleSkipToBlank = () => {
    navigate('/crm/campaigns/new?type=newsletter');
    onClose();
  };

  const renderContent = () => (
    <div className="flex flex-col h-full max-h-[calc(90vh-120px)]">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        {currentStep === 'ideas' ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">Choose a Ready-Made Idea</h2>
              <Button variant="ghost" size="sm" onClick={handleSkipToBlank}>
                Skip & start blank
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Select from our curated newsletter ideas or create your own with AI
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center mb-2">
              <Button variant="ghost" size="sm" onClick={handleBack} className="mr-2 p-1">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-xl font-semibold">Pick a Layout</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose how your newsletter will be structured
            </p>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="pr-4">
            {currentStep === 'ideas' ? (
              <div className="space-y-6 pb-4">
                {/* AI Idea Generator */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <Sparkles className="w-5 h-5 text-purple-600 mr-2" />
                    <h3 className="font-medium text-purple-900">Generate Custom Ideas</h3>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor="ai-prompt" className="sr-only">Describe your newsletter</Label>
                      <Input
                        id="ai-prompt"
                        placeholder="Describe the newsletter you'd like to create..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerateAI()}
                      />
                    </div>
                    <Button 
                      onClick={handleGenerateAI}
                      disabled={!aiPrompt.trim() || generatingAI}
                      size="sm"
                    >
                      {generatingAI ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Generate
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Ideas Grid */}
                <IdeaGrid 
                  ideas={ideas}
                  onSelectIdea={handleSelectIdea}
                  loading={loading}
                />
              </div>
            ) : (
              <div className="space-y-6 pb-4">
                {/* Selected Idea Summary */}
                {selectedIdea && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h3 className="font-medium mb-1">Selected Idea:</h3>
                    <p className="text-sm text-muted-foreground">{selectedIdea.title}</p>
                  </div>
                )}

                {/* Layout Options */}
                <NewsletterLayoutPicker
                  value={selectedLayout}
                  onChange={setSelectedLayout}
                />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      {currentStep === 'layout' && (
        <div className="flex-shrink-0 mt-6 pt-4 border-t flex justify-center">
          <Button 
            onClick={handleContinue}
            disabled={!selectedIdea || !selectedLayout}
            className="px-8"
            size="lg"
          >
            Continue to Builder
          </Button>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[90vh] overflow-hidden">
          <SheetHeader className="mb-4">
            <SheetTitle>Create Newsletter</SheetTitle>
          </SheetHeader>
          {renderContent()}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "w-screen h-screen max-w-none max-h-none overflow-hidden p-0",
        "z-[1000010]" // High z-index as specified
      )}>
        {/* Close button in top left */}
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onClose}
          className="absolute top-4 left-4 z-10 w-8 h-8 p-0 rounded-full hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </Button>
        
        <div className="p-6 pt-16 h-full">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl">Create Newsletter</DialogTitle>
          </DialogHeader>
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};