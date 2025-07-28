
import { useState } from "react";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BodySmall, CaptionMedium } from "@/components/ui/typography";
import { stripHtmlAndFormat } from "./contentUtils";

interface ContentPreviewProps {
  content: string;
  postType: string;
  className?: string;
}

export const ContentPreview = ({ content, postType, className = "" }: ContentPreviewProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isNewsletter = postType === 'newsletter';
  const cleanContent = stripHtmlAndFormat(content, isNewsletter);
  const wordCount = cleanContent.split(' ').length;
  const charCount = cleanContent.length;
  
  // Show more content by default (4-5 lines worth)
  const previewLength = 280; // Roughly 4-5 lines
  const needsExpansion = cleanContent.length > previewLength;
  const displayContent = isExpanded ? cleanContent : cleanContent.slice(0, previewLength) + (needsExpansion ? '...' : '');

  return (
    <div className={`space-y-2 ${className}`}>
      <BodySmall className="text-stone-700 leading-relaxed whitespace-pre-wrap">
        {displayContent}
      </BodySmall>
      
      <div className="flex items-center justify-between">
        <CaptionMedium className="text-stone-500">
          {wordCount} words • {charCount} characters
        </CaptionMedium>
        
        {needsExpansion && (
          <EnhancedAppleButton
            size="sm"
            variant="tertiary"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-stone-600 hover:text-stone-800 p-1"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                More
              </>
            )}
          </EnhancedAppleButton>
        )}
      </div>
    </div>
  );
};
