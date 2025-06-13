
import { Button } from "@/components/ui/button";
import { Edit2, Palette, FileText, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { generateThemeDescription } from "./ThemeDescriptionGenerator";
import { useAuth } from "@/contexts/AuthContext";
import { GenerateContentPackButton } from "@/components/content/GenerateContentPackButton";
import { useAutoThemeDescription } from "./useAutoThemeDescription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ThemeDisplayProps {
  campaignId?: string;
  currentTheme: string;
  currentDescription?: string;
  weekNumber?: number;
  onEdit: () => void;
  onContentGenerated?: () => void;
  onThemeUpdate?: (newTheme: string, newDescription?: string) => void;
}

export const ThemeDisplay = ({ 
  campaignId,
  currentTheme, 
  currentDescription, 
  weekNumber,
  onEdit, 
  onContentGenerated,
  onThemeUpdate
}: ThemeDisplayProps) => {
  const { user } = useAuth();
  const [isGeneratingHeadline, setIsGeneratingHeadline] = useState(false);
  const [generatedHeadline, setGeneratedHeadline] = useState<string>("");
  const [localDescription, setLocalDescription] = useState(currentDescription);

  // Auto-generate description when theme exists but description doesn't
  const { isGenerating } = useAutoThemeDescription({
    theme: currentTheme,
    currentDescription: localDescription,
    onDescriptionGenerated: async (description) => {
      setLocalDescription(description);
      
      // Save to database if we have a campaign ID
      if (campaignId) {
        try {
          const { error } = await supabase
            .from('campaigns')
            .update({ description: description.trim() })
            .eq('id', campaignId);

          if (error) {
            console.error('Error saving auto-generated description:', error);
          } else {
            // Update parent component
            if (onThemeUpdate) {
              onThemeUpdate(currentTheme, description.trim());
            }
          }
        } catch (error) {
          console.error('Error in auto-save:', error);
        }
      }
    },
    enabled: true
  });

  const handleEditClick = () => {
    console.log('Edit clicked from ThemeDisplay');
    onEdit();
  };

  const generateHeadline = async () => {
    if (!currentTheme.trim()) return;
    
    setIsGeneratingHeadline(true);
    
    try {
      // Use the existing theme description generator but modify the prompt for headlines
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: `You are a marketing headline writer for garden centers. Create a compelling, attention-grabbing headline from the given theme. The headline should:
              - Be engaging and exciting (like a magazine headline)
              - Use action words and emotional language
              - Be 3-8 words maximum
              - Appeal to gardening enthusiasts
              - Feel fresh and modern
              - Avoid generic phrases
              
              Return ONLY the headline, no quotes or extra text.`
            },
            { 
              role: 'user', 
              content: `Create an exciting headline for this garden center theme: "${currentTheme.trim()}"`
            }
          ],
          max_tokens: 50,
          temperature: 0.8,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const headline = data.choices[0].message.content.trim();
        setGeneratedHeadline(headline);
      }
    } catch (error) {
      console.error('Error generating headline:', error);
      // Fallback to a simple transformation
      const fallbackHeadline = currentTheme
        .replace(/Week\s*\d+[\s:-]*/gi, '')
        .replace(/\d+\s*week[\s:-]*/gi, '')
        .replace(/^[\s:-]+|[\s:-]+$/g, '')
        .trim();
      setGeneratedHeadline(fallbackHeadline);
    } finally {
      setIsGeneratingHeadline(false);
    }
  };

  // Clean up theme text by removing week numbers and similar patterns
  const cleanTheme = (theme: string) => {
    if (!theme) return "No theme set";
    
    return theme
      .replace(/Week\s*\d+[\s:-]*/gi, '') // Remove "Week 1:", "Week 23 -", etc.
      .replace(/\d+\s*week[\s:-]*/gi, '') // Remove "1 week:", "23 week -", etc.
      .replace(/^[\s:-]+|[\s:-]+$/g, '') // Remove leading/trailing spaces, colons, dashes
      .trim();
  };

  const displayTheme = generatedHeadline || cleanTheme(currentTheme);
  const hasTheme = currentTheme && currentTheme.trim() !== "";
  const displayDescription = localDescription || currentDescription;
  const hasDescription = displayDescription && displayDescription.trim() !== "";

  return (
    <div className="space-y-4 bg-white">
      {hasTheme && (
        <div className="group bg-white">
          <div className="flex items-center justify-between mb-1 bg-white">
            <div className="flex items-center gap-2 bg-white">
              <Palette className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Content Theme:</span>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white">
              <Button
                size="sm"
                variant="ghost"
                onClick={generateHeadline}
                disabled={isGeneratingHeadline}
                className="h-6 w-6 p-0 bg-white hover:bg-gray-100"
                title="Generate exciting headline"
              >
                <Sparkles className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleEditClick}
                className="h-6 w-6 p-0 bg-white hover:bg-gray-100"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <span className="text-sm text-foreground leading-tight block pl-6 bg-white">
            {displayTheme}
          </span>
        </div>
      )}
      
      {isGenerating ? (
        <div className="flex items-start gap-2 bg-white">
          <Loader2 className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0 animate-spin" />
          <div className="flex-1 bg-white">
            <span className="text-sm font-medium text-purple-700 block mb-1">Generating Content Focus...</span>
            <p className="text-sm text-purple-600 leading-relaxed">
              AI is creating a strategic content focus description for your theme.
            </p>
          </div>
        </div>
      ) : hasDescription ? (
        <div className="flex items-start gap-2 bg-white">
          <FileText className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 bg-white">
            <span className="text-sm font-medium text-gray-700 block mb-1">Content Focus:</span>
            <p className="text-sm text-gray-600 leading-relaxed">
              {displayDescription}
            </p>
          </div>
        </div>
      ) : hasTheme ? (
        <div className="flex items-start gap-2 bg-white">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 bg-white">
            <span className="text-sm font-medium text-amber-700 block mb-1">Content Focus Needed:</span>
            <div 
              className="text-sm text-amber-600 cursor-pointer hover:text-amber-800 transition-colors p-2 rounded hover:bg-amber-50 select-none bg-white border border-amber-200"
              onClick={handleEditClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEditClick();
                }
              }}
            >
              <p className="font-medium mb-1">Add content focus to guide AI generation →</p>
              <p className="text-xs text-amber-600">
                Without a content focus description, AI will create generic content. Add 1-2 sentences describing what your content should accomplish this week.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 bg-white">
          <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 bg-white">
            <span className="text-sm font-medium text-gray-500 block mb-1">No Theme Set:</span>
            <div 
              className="text-sm text-gray-400 italic cursor-pointer hover:text-gray-600 transition-colors p-2 rounded hover:bg-gray-50 select-none bg-white border border-gray-200"
              onClick={handleEditClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEditClick();
                }
              }}
            >
              Click here to set a theme and content focus for this week.
            </div>
          </div>
        </div>
      )}

      {/* Generate Content Pack Button - only show if we have both theme and description */}
      {campaignId && hasTheme && hasDescription && (
        <div className="pt-3 border-t border-gray-200 bg-white">
          <GenerateContentPackButton
            campaignId={campaignId}
            campaignTitle={displayTheme}
            theme={currentTheme}
            description={displayDescription}
            weekNumber={weekNumber}
            onGenerated={onContentGenerated}
            size="sm"
            variant="outline"
            className="w-full"
          />
        </div>
      )}

      {/* Show warning if theme exists but no description and not generating */}
      {campaignId && hasTheme && !hasDescription && !isGenerating && (
        <div className="pt-3 border-t border-amber-200 bg-amber-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Content Focus Required</span>
          </div>
          <p className="text-xs text-amber-600 mt-1">
            Add a content focus description above to enable AI content generation with strategic direction.
          </p>
        </div>
      )}
    </div>
  );
};
