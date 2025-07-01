import { Clock, CheckCircle, Calendar, Eye, Send, Facebook, Instagram, Mail, FileText } from 'lucide-react';
import { TASK_STATUS } from '@/constants/taskStatus';

export const getStatusInfo = (status: string) => {
  switch (status) {
    case TASK_STATUS.APPROVED:
      return { 
        icon: CheckCircle, 
        color: 'bg-green-100 text-green-700 border-green-300',
        label: 'Approved',
        draggable: true
      };
    case TASK_STATUS.POSTED:
      return { 
        icon: Send, 
        color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
        label: 'Posted',
        draggable: true
      };
    case TASK_STATUS.SCHEDULED:
      return { 
        icon: Calendar, 
        color: 'bg-purple-100 text-purple-700 border-purple-300',
        label: 'Scheduled',
        draggable: true
      };
    case TASK_STATUS.PREVIEW:
      return { 
        icon: Eye, 
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        label: 'Preview',
        draggable: true
      };
    case TASK_STATUS.GENERATED:
      return { 
        icon: Clock, 
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        label: 'Generated',
        draggable: false
      };
    case TASK_STATUS.REVIEW:
      return { 
        icon: Eye, 
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        label: 'Review',
        draggable: false
      };
    case TASK_STATUS.PLANNED:
      return { 
        icon: Clock, 
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        label: 'Planned',
        draggable: false
      };
    default:
      return { 
        icon: Clock, 
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        label: status,
        draggable: false
      };
  }
};

export const getPostTypeIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'facebook': 
      return Facebook;
    case 'instagram': 
      return Instagram;
    case 'newsletter':
    case 'email': 
      return Mail;
    default: 
      return FileText;
  }
};

export const getPostTypeColor = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'facebook': 
      return 'text-blue-600 bg-blue-50';
    case 'instagram': 
      return 'text-pink-600 bg-pink-50';
    case 'newsletter':
    case 'email': 
      return 'text-green-600 bg-green-50';
    default: 
      return 'text-gray-600 bg-gray-50';
  }
};
