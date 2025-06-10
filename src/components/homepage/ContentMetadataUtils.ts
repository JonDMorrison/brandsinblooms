
export const getHashtagsForType = (postType: string): string => {
  const hashtagsMap: Record<string, string> = {
    instagram: '#business #entrepreneur #success #motivation #growth',
    facebook: '#business #community #update #news',
    email: '',
    newsletter: '',
    video: '#video #content #business #tips'
  };
  
  return hashtagsMap[postType] || '#business #content';
};

export const getImageIdeaForType = (postType: string): string => {
  const imageIdeasMap: Record<string, string> = {
    instagram: 'Professional photo with engaging visual elements',
    facebook: 'Community-focused image or infographic',
    email: 'Simple header image or company logo',
    newsletter: 'Newsletter banner with company branding',
    video: 'Thumbnail image for video content'
  };
  
  return imageIdeasMap[postType] || 'Professional business image';
};
