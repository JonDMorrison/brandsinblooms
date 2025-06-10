import { Button } from "@/components/ui/button";
import { Edit2, Palette, FileText, Sparkles } from "lucide-react";
import { useState } from "react";
import { generateThemeDescription } from "./ThemeDescriptionGenerator";
import { useAuth } from "@/contexts/AuthContext";

interface ThemeDisplayProps {
  currentTheme: string;
  currentDescription?: string;
  onEdit: () => void;
}

export const ThemeDisplay = ({ currentTheme, currentDescription, onEdit }: ThemeDisplayProps) => {
  const { user } = useAuth();
  const [isGeneratingHeadline, setIsGeneratingHeadline] = useState(false);
  const [generatedHeadline, setGeneratedHeadline] = useState<string>("");

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 group">
        <Palette className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Content Theme:</span>
        <span className="text-sm text-foreground flex-1 leading-tight">
          {displayTheme}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={generateHeadline}
          disabled={isGeneratingHeadline}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Generate exciting headline"
        >
          <Sparkles className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleEditClick}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Edit2 className="w-3 h-3" />
        </Button>
      </div>
      
      {currentDescription && (
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-700 block mb-1">Content Focus:</span>
            <p className="text-sm text-gray-600 leading-relaxed">
              {currentDescription}
            </p>
          </div>
        </div>
      )}
      
      {!currentDescription && currentTheme && (
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-500 block mb-1">Content Focus:</span>
            <div 
              className="text-sm text-gray-400 italic cursor-pointer hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-50 select-none"
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
              No content description set. Click here to add one.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
