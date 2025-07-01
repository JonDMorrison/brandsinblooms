
import { Badge } from "@/components/ui/badge";

// Status mapping for content tasks - updated to match StatusBadge variants
export const getStatusBadgeVariant = (status: string) => {
  const statusMap = {
    'draft': 'draft',
    'generated': 'generated', 
    'review': 'preview', // Map review to preview since StatusBadge doesn't have review
    'preview': 'preview', // Add explicit preview mapping
    'approved': 'approved',
    'scheduled': 'scheduled',
    'posted': 'posted'
  } as const;
  
  // Return a valid StatusBadge variant, defaulting to 'draft' instead of 'default'
  return statusMap[status as keyof typeof statusMap] || 'draft';
};

// Platform mapping for post types
export const getPlatformBadgeVariant = (postType: string) => {
  const platformMap = {
    'newsletter': 'newsletter',
    'facebook': 'facebook',
    'instagram': 'instagram', 
    'video': 'video',
    'linkedin': 'linkedin',
    'email': 'email'
  } as const;
  
  return platformMap[postType as keyof typeof platformMap] || 'default';
};

export const getStatusLabel = (status: string) => {
  const labelMap = {
    'draft': 'Draft',
    'generated': 'Generated',
    'review': 'Review',
    'preview': 'Preview', // Add preview label
    'approved': 'Approved', 
    'scheduled': 'Scheduled',
    'posted': 'Ready to Post'
  };
  
  return labelMap[status as keyof typeof labelMap] || status;
};

export const getPlatformLabel = (postType: string) => {
  const labelMap = {
    'newsletter': 'Newsletter',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'video': 'Video',
    'linkedin': 'LinkedIn', 
    'email': 'Email'
  };
  
  return labelMap[postType as keyof typeof labelMap] || postType;
};
