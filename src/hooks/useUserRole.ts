import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'editor' | 'member' | 'viewer';

export const useUserRole = () => {
  const { user } = useAuth();

  // For now, all authenticated users are treated as admin/editor
  // This can be enhanced later with actual role checking from the database
  const hasRole = (requiredRole: UserRole): boolean => {
    if (!user) return false;
    
    // Temporary implementation - treat all users as editors
    // In production, this would check against user roles in the database
    const userRole: UserRole = 'editor';
    
    const roleHierarchy: Record<UserRole, number> = {
      viewer: 0,
      member: 1,
      editor: 2,
      admin: 3
    };

    const requiredLevel = roleHierarchy[requiredRole];
    const userLevel = roleHierarchy[userRole];

    return userLevel >= requiredLevel;
  };

  const canEditImages = hasRole('editor');
  const canUseCanva = hasRole('editor');

  return {
    hasRole,
    canEditImages,
    canUseCanva
  };
};