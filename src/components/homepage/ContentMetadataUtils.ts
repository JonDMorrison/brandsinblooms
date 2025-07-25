
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
    instagram: 'garden center plants',
    facebook: 'community garden',
    email: 'garden center',
    newsletter: 'seasonal garden',
    video: 'garden tips'
  };
  
  return imageIdeasMap[postType] || 'garden center';
};
