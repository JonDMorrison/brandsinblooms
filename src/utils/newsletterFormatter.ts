
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
  
  // Enhanced header detection and formatting
  const lines = cleanContent.split('\n').filter(line => line.trim());
  let formattedContent = '';
  let currentSection = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check if this is a header
    const isHeader = isLineHeader(line);
    
    if (isHeader) {
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
          if ((j + 1) % 3 === 0 && paragraph.length > 150) {
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
  let processedContent = '';
  let currentSection = '';
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Detect topic changes and section breaks
    const gardenKeywords = ['plant', 'garden', 'seed', 'soil', 'water', 'grow', 'bloom', 'seasonal', 'maintenance'];
    const businessKeywords = ['sale', 'offer', 'visit', 'store', 'special', 'promotion', 'event'];
    const tipKeywords = ['tip', 'advice', 'remember', 'important', 'best practice', 'expert'];
    
    const hasGardenKeywords = gardenKeywords.some(keyword => trimmed.toLowerCase().includes(keyword));
    const hasBusinessKeywords = businessKeywords.some(keyword => trimmed.toLowerCase().includes(keyword));
    const hasTipKeywords = tipKeywords.some(keyword => trimmed.toLowerCase().includes(keyword));
    
    // Add section headers based on content analysis
    if (index === 0 || (hasGardenKeywords && currentSection !== 'garden')) {
      if (hasGardenKeywords && index > 0) {
        processedContent += '\n\n## Gardening Focus\n\n';
        currentSection = 'garden';
      }
    } else if (hasBusinessKeywords && currentSection !== 'business') {
      processedContent += '\n\n## What\'s Happening\n\n';
      currentSection = 'business';
    } else if (hasTipKeywords && currentSection !== 'tips') {
      processedContent += '\n\n## Expert Tips\n\n';
      currentSection = 'tips';
    }
    
    processedContent += trimmed + '\n';
  });
  
  return processedContent;
};

// ENHANCED helper function to determine if a line should be treated as a header
const isLineHeader = (line: string): boolean => {
  if (!line) return false;
  
  // Known newsletter section patterns
  const headerPatterns = [
    /^(this week's focus|garden focus|what's happening|expert tips|seasonal highlights|plant care tips|garden maintenance|special offers|featured plants|growing tips)$/i,
    /^[A-Z][A-Z\s&'-]{5,50}:?\s*$/,
    /^\d+\.\s*[A-Z]/,
    /^Week\s+\d+/i,
    // New patterns for common newsletter headers
    /^(fall transition|spring prep|summer care|winter protection)/i,
    /^(planting|watering|fertilizing|pruning|harvest)/i
  ];
  
  // Check if line matches header patterns
  const matchesPattern = headerPatterns.some(pattern => pattern.test(line.trim()));
  
  // Additional checks for header-like content
  const isShortUppercase = (line.length < 60 && line === line.toUpperCase() && line.split(' ').length <= 6);
  const endsWithColon = (line.endsWith(':') && line.length < 80);
  const isStronglyFormatted = (line.includes('**') && line.length < 100);
  
  return matchesPattern || isShortUppercase || endsWithColon || isStronglyFormatted;
};
