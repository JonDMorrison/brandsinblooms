
export const formatNewsletterContent = (content: string): string => {
  if (!content) return '';
  
  // Preserve existing bold formatting and handle processed content better
  let cleanContent = content;
  
  // Don't remove HTML tags if they're already properly formatted
  if (!content.includes('<strong>') && !content.includes('<p>')) {
    cleanContent = content.replace(/<[^>]*>/g, '');
  }
  
  // Convert markdown bold syntax (**text**) to HTML bold tags only if not already converted
  if (!cleanContent.includes('<strong>')) {
    cleanContent = cleanContent.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
  }
  
  // IMPROVED: Much more conservative header detection and formatting
  const lines = cleanContent.split('\n').filter(line => line.trim());
  let formattedContent = '';
  let currentSection = '';
  let headerCount = 0;
  const maxHeaders = 3; // Limit the number of headers
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Much more conservative header detection
    const isHeader = headerCount < maxHeaders && isStrongHeader(line);
    
    if (isHeader) {
      headerCount++;
      
      // Close previous section if open
      if (currentSection) {
        formattedContent += `</div>`;
      }
      
      formattedContent += `<div class="newsletter-section mt-8 first:mt-0">`;
      formattedContent += `<h3 class="text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200 bg-slate-50 px-4 py-2 rounded-lg">${line}</h3>`;
      currentSection = 'open';
    } else {
      // Process as paragraph content with better spacing preservation
      const sentences = line.split(/(?<=[.!?])\s+/);
      let paragraph = '';
      
      for (let j = 0; j < sentences.length; j++) {
        const sentence = sentences[j].trim();
        if (sentence) {
          paragraph += sentence + ' ';
          
          // Create paragraph breaks for better readability, but preserve content flow
          if ((j + 1) % 4 === 0 && paragraph.length > 200) {
            formattedContent += `<p class="mb-4 text-slate-700 leading-relaxed">${paragraph.trim()}</p>`;
            paragraph = '';
          }
        }
      }
      
      // Add remaining content
      if (paragraph.trim()) {
        formattedContent += `<p class="mb-4 text-slate-700 leading-relaxed">${paragraph.trim()}</p>`;
      }
    }
  }
  
  // Close any remaining open section
  if (currentSection) {
    formattedContent += '</div>';
  }
  
  return formattedContent;
};

export const addNewsletterSections = (content: string): string => {
  if (!content) return '';
  
  // Don't re-process content that already has proper structure
  if (content.includes('##') || content.includes('<h2>') || content.includes('<h3>')) {
    return content;
  }
  
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  // IMPROVED: Don't add sections unless content is substantial and clearly benefits from structure
  if (lines.length < 6) {
    return content; // Too short to benefit from sections
  }
  
  let processedContent = '';
  let currentSection = '';
  let sectionsAdded = 0;
  const maxSections = 2; // Limit sections to prevent over-structuring
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Only add sections at natural break points and limit total sections
    const isNaturalBreak = index > 0 && index < lines.length - 2 && 
                          sectionsAdded < maxSections &&
                          isContentTransition(trimmed, lines[index - 1]);
    
    if (isNaturalBreak) {
      if (sectionsAdded === 0) {
        processedContent += '\n\n## This Week\'s Focus\n\n';
        currentSection = 'focus';
      } else if (sectionsAdded === 1) {
        processedContent += '\n\n## What\'s Next\n\n';
        currentSection = 'next';
      }
      sectionsAdded++;
    }
    
    processedContent += trimmed + '\n';
  });
  
  return processedContent;
};

// IMPROVED: Much more strict header detection
const isStrongHeader = (line: string): boolean => {
  if (!line || line.length > 80) return false;
  
  // Only very clear header patterns
  const strongHeaderPatterns = [
    /^(this week|what's happening|expert tips|seasonal focus|featured plants?)$/i,
    /^[A-Z][A-Z\s&'-]{8,40}:?\s*$/,
    /^Week\s+\d+/i
  ];
  
  return strongHeaderPatterns.some(pattern => pattern.test(line.trim()));
};

// Helper to detect natural content transitions
const isContentTransition = (currentLine: string, previousLine: string): boolean => {
  if (!currentLine || !previousLine) return false;
  
  // Look for topic shifts in gardening content
  const topicKeywords = {
    seasonal: ['fall', 'winter', 'spring', 'summer', 'season'],
    care: ['water', 'fertilize', 'prune', 'maintenance'],
    business: ['visit', 'store', 'special', 'offer', 'sale']
  };
  
  const currentTopic = getContentTopic(currentLine, topicKeywords);
  const previousTopic = getContentTopic(previousLine, topicKeywords);
  
  return currentTopic !== previousTopic && currentTopic !== 'general' && previousTopic !== 'general';
};

const getContentTopic = (line: string, keywords: Record<string, string[]>): string => {
  const lowerLine = line.toLowerCase();
  
  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(word => lowerLine.includes(word))) {
      return topic;
    }
  }
  
  return 'general';
};
