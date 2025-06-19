
export const extractCompanyName = (aboutBusinessText: string): string | null => {
  if (!aboutBusinessText || aboutBusinessText.trim().length === 0) {
    return null;
  }

  const text = aboutBusinessText.trim();
  
  // Get the first sentence
  const firstSentence = text.split('.')[0].trim();
  
  // If the first sentence is too long, it's probably not just a company name
  if (firstSentence.length > 100) {
    return null;
  }
  
  // Try to extract company name using improved regex patterns
  const patterns = [
    // Pattern 1: "CompanyName has been..." or "CompanyName is..."
    /^([^,]{2,50}?)(?:\s+(?:has been|is|was|provides|offers|specializes|serves|operates|focuses|delivers|creates|supplies|manages|maintains|grows|cultivates))/i,
    
    // Pattern 2: "CompanyName, founded..." or "CompanyName, established..."
    /^([^,]{2,50}?),\s*(?:founded|established|created|started|began)/i,
    
    // Pattern 3: Just use first few words if they look like a business name
    /^([A-Z][a-zA-Z\s&'-]{1,40}?)(?:\s+(?:Inc|LLC|Co|Company|Corporation|Ltd|Center|Gardens?|Nursery|Farm|Store|Shop|Market))?/
  ];
  
  for (const pattern of patterns) {
    const match = firstSentence.match(pattern);
    if (match && match[1]) {
      let extractedName = match[1].trim();
      
      // Clean up the extracted name
      extractedName = cleanCompanyName(extractedName);
      
      // Validate the extracted name
      if (isValidCompanyName(extractedName)) {
        return extractedName;
      }
    }
  }
  
  // Fallback: if first sentence is short and looks like a name, use it
  if (firstSentence.length <= 50 && firstSentence.split(' ').length <= 6) {
    const cleaned = cleanCompanyName(firstSentence);
    if (isValidCompanyName(cleaned)) {
      return cleaned;
    }
  }
  
  return null;
};

const cleanCompanyName = (name: string): string => {
  return name
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s&'-]/g, '') // Remove special characters except &, ', -
    .trim();
};

const isValidCompanyName = (name: string): boolean => {
  if (!name || name.length < 2 || name.length > 50) {
    return false;
  }
  
  // Check if it's not just common words
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const words = name.toLowerCase().split(' ');
  const hasProperName = words.some(word => 
    word.length > 2 && 
    !commonWords.includes(word) && 
    word.charAt(0) === word.charAt(0).toUpperCase()
  );
  
  return hasProperName;
};
