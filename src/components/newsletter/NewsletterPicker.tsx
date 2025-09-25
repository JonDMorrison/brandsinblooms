import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  const [textareaRows, setTextareaRows] = useState(1);

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
      setTextareaRows(1); // Reset to default rows
    } catch (error) {
      console.error('Failed to generate AI ideas:', error);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setAiPrompt(value);
    
    // Auto-expand functionality
    const textarea = e.target;
    const lineHeight = 24; // Approximate line height
    const padding = 24; // Top and bottom padding (p-3 = 12px * 2)
    const minRows = 1;
    const maxRows = 3;
    
    // Reset height to auto to get accurate scrollHeight
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const newRows = Math.min(maxRows, Math.max(minRows, Math.ceil((scrollHeight - padding) / lineHeight)));
    
    setTextareaRows(newRows);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow normal Enter behavior for new lines
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
    <div className="flex flex-col h-full relative">
      {/* Main Content Area */}
      {currentStep === 'ideas' && (
        <div className="flex-1 flex items-center justify-center" style={{ paddingBottom: `${Math.max(100, 60 + textareaRows * 24)}px` }}>
          <div className="w-full h-full flex items-center justify-center">
            <IdeaGrid 
              ideas={ideas} 
              onSelectIdea={handleSelectIdea} 
              loading={loading}
              className="max-h-full"
            />
          </div>
        </div>
      )}

      {currentStep === 'layout' && selectedIdea && (
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Ideas
            </Button>
            
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">{selectedIdea.title}</h3>
              <p className="text-muted-foreground">{selectedIdea.description}</p>
            </div>
            
            <Separator className="mb-6" />
            
            <div>
              <h4 className="font-medium mb-4">Choose Layout</h4>
              <NewsletterLayoutPicker 
                value={selectedLayout} 
                onChange={setSelectedLayout} 
              />
            </div>
          </div>
        </div>
      )}

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

  // AI Prompt Input - Always Fixed at Bottom (outside of dialog content)
  const renderAIPromptInput = () => {
    if (currentStep !== 'ideas') return null;
    
    const baseHeight = 60; // Base container height for 1 row
    const rowHeight = 24; // Height per row
    const totalHeight = baseHeight + (textareaRows - 1) * rowHeight;
    
    return (
      <div 
        className="fixed left-0 right-0 bg-white/95 backdrop-blur-sm border-t shadow-lg z-[1000020] p-4 transition-all duration-200"
        style={{ 
          bottom: 0,
          transform: `translateY(-${Math.max(0, (textareaRows - 1) * rowHeight)}px)`
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
            <div className="space-y-3">
              <div className="w-full">
                <Label htmlFor="ai-prompt" className="sr-only">Describe your newsletter</Label>
                <Textarea
                  id="ai-prompt"
                  placeholder="Write your AI prompt here..."
                  className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden bg-white text-base"
                  value={aiPrompt}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  rows={textareaRows}
                  style={{ 
                    minHeight: `${1 * 24 + 24}px`, // 1 row + padding
                    maxHeight: `${3 * 24 + 24}px`, // 3 rows + padding
                    overflowY: textareaRows >= 3 ? 'auto' : 'hidden'
                  }}
                />
              </div>
              <div className="flex justify-end">
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
          </div>
        </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <>
        <Sheet open={isOpen} onOpenChange={onClose}>
          <SheetContent side="bottom" className="h-[90vh] overflow-hidden">
            <SheetHeader className="mb-4">
              <SheetTitle>Create Newsletter</SheetTitle>
            </SheetHeader>
            {renderContent()}
          </SheetContent>
        </Sheet>
        {renderAIPromptInput()}
      </>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={cn(
          "w-screen h-screen max-w-none max-h-none overflow-hidden p-0 bg-background text-foreground",
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
          
          <div className="p-6 pt-16 h-full" style={{ backgroundColor: 'rgb(17 24 39 / var(--tw-bg-opacity, 1))' }}>
            {renderContent()}
          </div>
        </DialogContent>
      </Dialog>
      {renderAIPromptInput()}
    </>
  );
};