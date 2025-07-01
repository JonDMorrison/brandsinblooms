
import { Badge } from "@/components/ui/badge";

// Status mapping for content tasks
export const getStatusBadgeVariant = (status: string) => {
  const statusMap = {
    'draft': 'draft',
    'generated': 'generated', 
    'review': 'review',
    'approved': 'approved',
    'scheduled': 'scheduled',
    'posted': 'posted'
  } as const;
  
  return statusMap[status as keyof typeof statusMap] || 'default';
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

// Helper to get readable status labels
export const getStatusLabel = (status: string) => {
  const labelMap = {
    'draft': 'Draft',
    'generated': 'Generated',
    'review': 'Review',
    'approved': 'Approved', 
    'scheduled': 'Scheduled',
    'posted': 'Ready to Post'
  };
  
  return labelMap[status as keyof typeof labelMap] || status;
};

// Helper to get readable platform labels
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
