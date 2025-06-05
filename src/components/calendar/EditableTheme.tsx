
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Check, X, Palette, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditableThemeProps {
  campaignId: string;
  currentTheme: string;
  currentDescription?: string;
  onThemeUpdate: (newTheme: string, newDescription?: string) => void;
}

export const EditableTheme = ({ campaignId, currentTheme, currentDescription, onThemeUpdate }: EditableThemeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTheme, setEditTheme] = useState(currentTheme);
  const [editDescription, setEditDescription] = useState(currentDescription || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const generateDescription = async () => {
    if (!editTheme.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a marketing content strategist for a garden center. Write exactly two sentences that describe the type of content that should be created for a specific weekly theme. These sentences will guide the creation of newsletters, social media posts, emails, and video scripts for that week.'
            },
            {
              role: 'user',
              content: `Generate a two-sentence description for this weekly theme: "${editTheme}". Focus on what type of content should be created and what the main focus should be for that week.`
            }
          ],
          temperature: 0.7,
          max_tokens: 100,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate description');
      }

      const data = await response.json();
      const description = data.choices[0].message.content.trim();
      setEditDescription(description);
    } catch (error) {
      console.error('Error generating description:', error);
      // Fallback description
      const fallbackDescription = `This week's content will focus on ${editTheme.toLowerCase()}, providing practical tips and expert guidance to help customers succeed. All materials will emphasize actionable advice and showcase the garden center's expertise in this area.`;
      setEditDescription(fallbackDescription);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editTheme.trim()) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ 
          theme: editTheme.trim(),
          description: editDescription.trim()
        })
        .eq('id', campaignId);

      if (error) throw error;

      onThemeUpdate(editTheme.trim(), editDescription.trim());
      setIsEditing(false);
      toast({
        title: "Theme updated",
        description: "Campaign theme and description have been updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating theme:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update theme",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditTheme(currentTheme);
    setEditDescription(currentDescription || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            value={editTheme}
            onChange={(e) => setEditTheme(e.target.value)}
            placeholder="Enter theme..."
            className="h-8 text-sm"
            autoFocus
          />
          <Button
            size="sm"
            variant="outline"
            onClick={generateDescription}
            disabled={isLoading || !editTheme.trim()}
            className="h-8 px-3 text-xs"
          >
            Generate
          </Button>
        </div>
        
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Content Focus Description:</label>
          <Textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Two-sentence description of the content focus for this week..."
            className="text-sm min-h-[60px]"
            rows={3}
          />
          <p className="text-xs text-gray-500">
            This description will guide all content creation for this week (newsletter, social media, emails, videos).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={isLoading || !editTheme.trim()}
            className="h-8 w-8 p-0"
          >
            <Check className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 group">
        <Palette className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Content Theme:</span>
        <span className="text-sm text-gray-600 flex-1">
          {currentTheme || "No theme set"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(true)}
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
    </div>
  );
};
