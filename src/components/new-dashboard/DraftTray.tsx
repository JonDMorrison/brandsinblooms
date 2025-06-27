
import React from 'react';
import { cn } from '@/lib/utils';
import { 
  FileText, 
  Video, 
  Mail, 
  Edit,
  Instagram,
  Facebook
} from 'lucide-react';

interface DraftTrayProps {
  tasks: any[];
  selectedDraft: any;
  onSelectDraft: (draft: any) => void;
}

export const DraftTray = ({ tasks, selectedDraft, onSelectDraft }: DraftTrayProps) => {
  const getTaskIcon = (postType: string) => {
    switch (postType) {
      case 'facebook':
        return Facebook;
      case 'instagram':
        return Instagram;
      case 'video':
        return Video;
      case 'newsletter':
        return Mail;
      case 'blog':
        return FileText;
      default:
        return Edit;
    }
  };

  const getTaskTitle = (task: any) => {
    const typeMap: { [key: string]: string } = {
      facebook: 'Social Media Post',
      instagram: 'Social Media Post',
      video: 'Video Content',
      newsletter: 'Newsletter',
      blog: 'Blog Post'
    };
    return typeMap[task.post_type] || 'Content Draft';
  };

  const getTaskBgColor = (postType: string) => {
    switch (postType) {
      case 'facebook':
      case 'instagram':
        return 'bg-[#68BEB9]/10';
      case 'video':
        return 'bg-orange-100';
      case 'newsletter':
        return 'bg-blue-100';
      case 'blog':
        return 'bg-green-100';
      default:
        return 'bg-gray-100';
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-4 h-full border border-white/20">
      <h2 className="text-lg font-semibold text-[#3E5A6B] mb-4">Draft Tray</h2>
      
      <div className="space-y-3 h-[180px] overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Edit className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">No drafts available</p>
          </div>
        ) : (
          tasks.map((task) => {
            const Icon = getTaskIcon(task.post_type);
            const isSelected = selectedDraft?.id === task.id;
            
            return (
              <div
                key={task.id}
                onClick={() => onSelectDraft(task)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200",
                  "hover:shadow-sm border",
                  isSelected 
                    ? "border-[#68BEB9] bg-[#68BEB9]/10 shadow-sm" 
                    : "border-gray-200 bg-white hover:border-[#68BEB9]/30"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  getTaskBgColor(task.post_type)
                )}>
                  <Icon className="w-5 h-5 text-[#3E5A6B]" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#3E5A6B] text-sm truncate">
                    {getTaskTitle(task)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {task.status === 'draft' ? 'Draft' : 'Generated'}
                  </p>
                </div>
                
                {/* Drag handle hint */}
                <div className="flex flex-col gap-0.5">
                  <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                  <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                  <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
