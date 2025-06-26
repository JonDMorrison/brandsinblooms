
export const formatNewsletterContent = (content: string): string => {
  if (!content) return '';
  
  // Remove HTML tags for processing
  const cleanContent = content.replace(/<[^>]*>/g, '');
  
  // Split into paragraphs
  const paragraphs = cleanContent.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  let formattedContent = '';
  
  paragraphs.forEach((paragraph, index) => {
    const trimmed = paragraph.trim();
    if (!trimmed) return;
    
    // Check if this looks like a header (short, uppercase, or ends with colon)
    const isHeader = trimmed.length < 60 && (
      trimmed === trimmed.toUpperCase() ||
      trimmed.endsWith(':') ||
      /^[A-Z][A-Za-z\s]+$/.test(trimmed) ||
      trimmed.includes('WEEK') ||
      trimmed.includes('FOCUS') ||
      // Check for specific section headers we add
      trimmed === 'Gardening Focus' ||
      trimmed === "What's Happening" ||
      trimmed === 'Expert Tips'
    );
    
    if (isHeader) {
      formattedContent += `<div class="font-bold text-lg mt-6 mb-3 text-slate-900">${trimmed}</div>\n`;
    } else {
      // Break long paragraphs into shorter ones
      const sentences = trimmed.split(/(?<=[.!?])\s+/);
      let currentParagraph = '';
      
      sentences.forEach((sentence, sentenceIndex) => {
        currentParagraph += sentence + ' ';
        
        // Create new paragraph after 2-3 sentences or if content is getting long
        if ((sentenceIndex + 1) % 3 === 0 || currentParagraph.length > 200) {
          formattedContent += `<p class="mb-4 text-slate-700 leading-relaxed">${currentParagraph.trim()}</p>\n`;
          currentParagraph = '';
        }
      });
      
      // Add remaining content as paragraph
      if (currentParagraph.trim()) {
        formattedContent += `<p class="mb-4 text-slate-700 leading-relaxed">${currentParagraph.trim()}</p>\n`;
      }
    }
  });
  
  // Add section breaks for better visual separation
  formattedContent = formattedContent.replace(
    /(<div class="font-bold[^>]*>.*?<\/div>)/g, 
    '<div class="border-t border-gray-200 pt-6 mt-6 first:border-t-0 first:pt-0 first:mt-0">$1'
  );
  
  // Close the section divs
  formattedContent = formattedContent.replace(
    /(<div class="font-bold[^>]*>.*?<\/div>(?:(?!<div class="font-bold|$).)*)/g,
    '$1</div>'
  );
  
  return formattedContent;
};

export const addNewsletterSections = (content: string): string => {
  if (!content) return '';
  
  // Look for natural topic breaks and add section headers
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  let processedContent = '';
  let currentSection = '';
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Detect topic changes based on keywords
    const gardenKeywords = ['plant', 'garden', 'seed', 'soil', 'water', 'grow', 'bloom', 'seasonal', 'maintenance'];
    const businessKeywords = ['sale', 'offer', 'visit', 'store', 'special', 'promotion', 'event'];
    const tipKeywords = ['tip', 'advice', 'remember', 'important', 'best practice', 'expert'];
    
    const hasGardenKeywords = gardenKeywords.some(keyword => trimmed.toLowerCase().includes(keyword));
    const hasBusinessKeywords = businessKeywords.some(keyword => trimmed.toLowerCase().includes(keyword));
    const hasTipKeywords = tipKeywords.some(keyword => trimmed.toLowerCase().includes(keyword));
    
    // Add section headers based on content type (without markdown syntax)
    if (index === 0 || (hasGardenKeywords && currentSection !== 'garden')) {
      if (hasGardenKeywords && index > 0) {
        processedContent += '\nGardening Focus\n\n';
        currentSection = 'garden';
      }
    } else if (hasBusinessKeywords && currentSection !== 'business') {
      processedContent += '\nWhat\'s Happening\n\n';
      currentSection = 'business';
    } else if (hasTipKeywords && currentSection !== 'tips') {
      processedContent += '\nExpert Tips\n\n';
      currentSection = 'tips';
    }
    
    processedContent += trimmed + '\n';
  });
  
  return processedContent;
};
