
// Removed sonner import - using global toast replacement

// These functions are now deprecated in favor of the SocialMediaPostModal
// They're kept for backward compatibility but should not be used directly

export const postToFacebook = (content: string) => {
  // Copy content to clipboard
  navigator.clipboard.writeText(content);
  
  // Open Facebook with pre-filled post
  const facebookUrl = `https://www.facebook.com/share.php?u=${encodeURIComponent(window.location.href)}`;
  window.open(facebookUrl, '_blank');
  
  toast.success('Content copied! Paste it in the Facebook post that opened.');
};

export const postToInstagram = (content: string) => {
  // Copy content to clipboard
  navigator.clipboard.writeText(content);
  
  // Instagram doesn't support URL parameters for posting, so we'll open the main page
  const instagramUrl = 'https://www.instagram.com/';
  window.open(instagramUrl, '_blank');
  
  toast.success('Content copied! Create a new post on Instagram and paste the content.');
};
