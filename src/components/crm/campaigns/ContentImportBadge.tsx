
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FileText, Globe, Mail } from 'lucide-react';

interface ContentImportBadgeProps {
  themeSource: 'newsletter' | 'website' | 'email' | null;
}

export const ContentImportBadge: React.FC<ContentImportBadgeProps> = ({ themeSource }) => {
  if (!themeSource) return null;

  const getIcon = () => {
    switch (themeSource) {
      case 'newsletter':
        return <FileText className="w-3 h-3" />;
      case 'website':
        return <Globe className="w-3 h-3" />;
      case 'email':
        return <Mail className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  const getLabel = () => {
    switch (themeSource) {
      case 'newsletter':
        return 'From Newsletter';
      case 'website':
        return 'From Website';
      case 'email':
        return 'From Email';
      default:
        return 'Imported Content';
    }
  };

  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      {getIcon()}
      {getLabel()}
    </Badge>
  );
};
