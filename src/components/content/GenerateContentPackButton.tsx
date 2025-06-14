
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Coins } from "lucide-react";
import { useTokens } from "@/hooks/useTokens";
import { useAuth } from "@/contexts/AuthContext";
import { TokenGate } from "@/components/tokens/TokenGate";
import { generateContentPack } from "./BulkContentGenerator";

interface GenerateContentPackButtonProps {
  campaignId: string;
  campaignTitle: string;
  theme: string;
  description?: string;
  weekNumber?: number;
  onGenerated?: () => void;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary";
  className?: string;
}

export const GenerateContentPackButton = ({
  campaignId,
  campaignTitle,
  theme,
  description,
  weekNumber,
  onGenerated,
  size = "default",
  variant = "default",
  className = ""
}: GenerateContentPackButtonProps) => {
  const { user } = useAuth();
  const { checkTokenAvailability } = useTokens();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const tokensRequired = 8; // Total tokens for content pack
  const hasTokens = checkTokenAvailability(tokensRequired);

  const handleGenerate = async () => {
    if (!user || !theme.trim()) return;
    
    setIsGenerating(true);
    
    try {
      const result = await generateContentPack({
        campaignId,
        campaignTitle,
        theme,
        description,
        userId: user.id,
        weekNumber
      });
      
      if (result.success && onGenerated) {
        onGenerated();
      }
    } catch (error) {
      console.error('Error generating content pack:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Show token gate if insufficient tokens
  if (!hasTokens) {
    return (
      <TokenGate
        tokensRequired={tokensRequired}
        action="generate content pack"
        onProceed={handleGenerate}
      >
        <Button 
          size={size}
          variant={variant}
          className={className}
          disabled
        >
          <Coins className="w-4 h-4 mr-2" />
          Generate Content Pack
        </Button>
      </TokenGate>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !theme.trim()}
        size={size}
        variant={variant}
        className={`${className} bg-green-600 hover:bg-green-700 text-white border-green-600`}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Content Pack
          </>
        )}
      </Button>
      
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span>• 5 pieces of content</span>
      </div>
    </div>
  );
};
