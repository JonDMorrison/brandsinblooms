import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Clock, Calendar, Zap } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { TASK_STATUS } from '@/constants/taskStatus';
import { format } from 'date-fns';

interface ReadyToPublishSectionProps {
  approvedTasks: any[];
  onPublishNow: (task: any) => void;
  onSchedulePost: (task: any) => void;
  onViewAll: () => void;
}

export const ReadyToPublishSection = ({ 
  approvedTasks, 
  onPublishNow, 
  onSchedulePost, 
  onViewAll 
}: ReadyToPublishSectionProps) => {
  const getPostTypeIcon = (postType: string) => {
    switch (postType?.toLowerCase()) {
      case 'facebook': return '📘';
      case 'instagram': return '📷';
      case 'newsletter': return '📧';
      case 'video': return '🎬';
      default: return '📄';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-600" />
            Ready to Publish
          </CardTitle>
          <p className="text-sm text-text-secondary mt-1">
            {approvedTasks.length} content piece{approvedTasks.length !== 1 ? 's' : ''} approved and ready
          </p>
        </div>
        {approvedTasks.length > 3 && (
          <Button variant="outline" size="sm" onClick={onViewAll}>
            View All ({approvedTasks.length})
          </Button>
        )}
      </CardHeader>
      
      <CardContent>
        {approvedTasks.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No content ready to publish</p>
            <p className="text-gray-400 text-xs mt-1">
              Generate and approve content to see it here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvedTasks.slice(0, 3).map((task) => (
              <div 
                key={task.id}
                className="p-3 border rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getPostTypeIcon(task.post_type)}</span>
                    <div>
                      <p className="font-medium text-sm capitalize">
                        {task.post_type} Content
                      </p>
                      <StatusIndicator status={TASK_STATUS.APPROVED} size="sm" />
                    </div>
                  </div>
                  {task.campaigns?.title && (
                    <Badge variant="outline" className="text-xs">
                      {task.campaigns.title}
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                  {task.ai_output?.substring(0, 120)}...
                </p>
                
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => onPublishNow(task)}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Publish Now
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onSchedulePost(task)}
                  >
                    <Calendar className="w-3 h-3 mr-1" />
                    Schedule
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};