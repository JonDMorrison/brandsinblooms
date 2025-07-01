
import React from 'react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';
import { useDashboardContext } from '@/contexts/DashboardContext';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Video, 
  Mail, 
  Edit,
  Instagram,
  Facebook,
  GripVertical
} from 'lucide-react';

export const DraftTray = () => {
  const { drafts, activeDraft, setActiveDraft, loading } = useDashboardContext();

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

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-4 h-[440px] border border-white/20 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-[#68BEB9] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-4 h-[440px] border border-white/20">
      <h2 className="text-lg font-semibold text-[#3E5A6B] mb-4">Draft Tray</h2>
      
      <Droppable droppableId="draft-tray">
        {(provided, snapshot) => (
          <div 
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "space-y-3 h-[350px] overflow-y-auto transition-colors",
              snapshot.isDraggingOver && "bg-[#68BEB9]/5 rounded-lg"
            )}
          >
            {drafts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Edit className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm mb-3">No drafts available</p>
                <p className="text-xs text-gray-400">Generate content to get started</p>
              </div>
            ) : (
              drafts.map((task, index) => {
                const Icon = getTaskIcon(task.post_type);
                const isSelected = activeDraft?.id === task.id;
                
                return (
                  <Draggable key={task.id} draggableId={task.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        onClick={() => setActiveDraft(task)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200",
                          "hover:shadow-sm border",
                          snapshot.isDragging && "shadow-lg rotate-2 scale-105",
                          isSelected 
                            ? "border-[#68BEB9] bg-[#68BEB9]/10 shadow-sm" 
                            : "border-gray-200 bg-white hover:border-[#68BEB9]/30"
                        )}
                      >
                        <div 
                          {...provided.dragHandleProps}
                          className="text-gray-400 hover:text-[#68BEB9] cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                        
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
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {task.status === 'approved' ? 'Ready' : 'Draft'}
                            </Badge>
                            {task.campaigns && (
                              <span className="text-xs text-gray-500 truncate">
                                {task.campaigns.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
