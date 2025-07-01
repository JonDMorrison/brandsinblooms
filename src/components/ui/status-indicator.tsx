import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Calendar, Sparkles, FileText, AlertCircle } from 'lucide-react';
import { TaskStatus } from '@/types/content';

interface StatusIndicatorProps {
  status: TaskStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showDescription?: boolean;
}

export const StatusIndicator = ({ 
  status, 
  size = 'md', 
  showIcon = true, 
  showDescription = false 
}: StatusIndicatorProps) => {
  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case 'planned':
        return {
          label: 'Planned',
          description: 'Content idea is planned for creation',
          color: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: FileText,
          iconColor: 'text-gray-600'
        };
      case 'review':
        return {
          label: 'Ready for Review',
          description: 'Content generated and waiting for approval',
          color: 'bg-orange-100 text-orange-800 border-orange-300',
          icon: AlertCircle,
          iconColor: 'text-orange-600'
        };
      case 'approved':
        return {
          label: 'Approved',
          description: 'Ready for publishing or scheduling',
          color: 'bg-green-100 text-green-800 border-green-300',
          icon: CheckCircle,
          iconColor: 'text-green-600'
        };
      case 'scheduled':
        return {
          label: 'Scheduled',
          description: 'Scheduled for automatic publishing',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: Calendar,
          iconColor: 'text-blue-600'
        };
      case 'published':
        return {
          label: 'Published',
          description: 'Successfully published to social media',
          color: 'bg-purple-100 text-purple-800 border-purple-300',
          icon: Sparkles,
          iconColor: 'text-purple-600'
        };
      case 'generated':
        return {
          label: 'Generated',
          description: 'AI content generated successfully',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: Sparkles,
          iconColor: 'text-emerald-600'
        };
      case 'preview':
        return {
          label: 'Preview',
          description: 'Development preview content',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          icon: AlertCircle,
          iconColor: 'text-yellow-600'
        };
      default:
        return {
          label: status,
          description: 'Unknown status',
          color: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: FileText,
          iconColor: 'text-gray-600'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className="flex items-center gap-1">
      <Badge className={`${config.color} ${sizeClasses[size]} font-medium`}>
        {showIcon && <Icon className={`${iconSizes[size]} mr-1 ${config.iconColor}`} />}
        {config.label}
      </Badge>
      {showDescription && (
        <span className="text-xs text-gray-600 ml-1">
          {config.description}
        </span>
      )}
    </div>
  );
};

export const getStatusDisplayName = (status: TaskStatus): string => {
  const config = {
    planned: 'Planned',
    review: 'Ready for Review',
    approved: 'Approved',
    scheduled: 'Scheduled',
    published: 'Published',
    generated: 'Generated',
    preview: 'Preview',
    pending: 'Pending',
    rejected: 'Rejected'
  };
  
  return config[status] || status;
};