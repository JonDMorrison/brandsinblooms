import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Leaf, Mail, Instagram, Facebook, Video, FileText } from "lucide-react";
import { format } from "date-fns";
import NewsletterDisplay from '../../newsletter/NewsletterDisplay';

interface HolidayItemProps {
  holiday: any;
  tasks: any[];
  onTaskClick: (task: any) => void;
}

interface Task {
  id: string;
  post_type: string;
  ai_output: string;
  status: string;
  publish_date: string;
}

const getPostTypeIcon = (postType: string) => {
  switch (postType) {
    case 'newsletter':
      return <Mail className="w-4 h-4 mr-2" />;
    case 'email':
      return <Mail className="w-4 h-4 mr-2" />;
    case 'instagram':
      return <Instagram className="w-4 h-4 mr-2" />;
    case 'facebook':
      return <Facebook className="w-4 h-4 mr-2" />;
    case 'blog':
      return <FileText className="w-4 h-4 mr-2" />;
    case 'video':
      return <Video className="w-4 h-4 mr-2" />;
    default:
      return <FileText className="w-4 h-4 mr-2" />;
  }
};

const getPostTypeColor = (postType: string) => {
  switch (postType) {
    case 'newsletter':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'email':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'instagram':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'facebook':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'blog':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'video':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

export const HolidayItem = ({ holiday, tasks, onTaskClick }: HolidayItemProps) => {
  const upcomingTasks = tasks.filter((task: any) => task.status !== 'completed');
  const completedTasks = tasks.filter((task: any) => task.status === 'completed');

  const renderTaskContent = (task: any) => {
    if (!task.ai_output) {
      return (
        <div className="text-sm text-gray-500 italic">
          Content not generated yet
        </div>
      );
    }

    switch (task.post_type) {
      case 'newsletter':
        return <NewsletterDisplay task={task} />;
      case 'email':
        return (
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-blue-800 mb-2">Email Content:</div>
            <div className="text-blue-700 line-clamp-3">{task.ai_output}</div>
          </div>
        );
      case 'instagram':
      case 'facebook':
        return (
          <div className="bg-purple-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-purple-800 mb-2">Social Media Post:</div>
            <div className="text-purple-700 line-clamp-3">{task.ai_output}</div>
          </div>
        );
      case 'blog':
        return (
          <div className="bg-green-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-green-800 mb-2">Blog Post:</div>
            <div className="text-green-700 line-clamp-3">{task.ai_output}</div>
          </div>
        );
      case 'video':
        return (
          <div className="bg-red-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-red-800 mb-2">Video Script:</div>
            <div className="text-red-700 line-clamp-3">{task.ai_output}</div>
          </div>
        );
      default:
        return (
          <div className="text-sm text-gray-600 line-clamp-3">
            {task.ai_output}
          </div>
        );
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-green-500" />
          {holiday.theme}
        </CardTitle>
        <p className="text-sm text-gray-500">
          <Calendar className="w-4 h-4 mr-1 inline-block" />
          {format(new Date(holiday.date), "MMMM dd, yyyy")}
        </p>
      </CardHeader>
      <CardContent>
        {upcomingTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-sm text-gray-500 italic">
            No tasks created for this holiday yet.
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingTasks.length > 0 && (
              <>
                <div className="text-sm font-medium text-gray-700">
                  Upcoming Tasks:
                </div>
                <div className="space-y-2">
                  {upcomingTasks.map((task: any) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => onTaskClick(task)}
                    >
                      <div className="flex items-center">
                        <Badge className={`mr-2 ${getPostTypeColor(task.post_type)}`}>
                          {getPostTypeIcon(task.post_type)}
                          {task.post_type}
                        </Badge>
                        <span className="text-sm text-gray-700">{task.status === 'generating' ? 'Generating...' : 'Ready'}</span>
                      </div>
                      {renderTaskContent(task)}
                    </div>
                  ))}
                </div>
              </>
            )}

            {completedTasks.length > 0 && (
              <>
                <div className="text-sm font-medium text-gray-700">
                  Completed Tasks:
                </div>
                <div className="space-y-2">
                  {completedTasks.map((task: any) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 transition-colors cursor-pointer"
                      onClick={() => onTaskClick(task)}
                    >
                      <div className="flex items-center">
                        <Badge className={`mr-2 ${getPostTypeColor(task.post_type)}`}>
                          {getPostTypeIcon(task.post_type)}
                          {task.post_type}
                        </Badge>
                        <span className="text-sm text-green-700">Completed</span>
                      </div>
                      {renderTaskContent(task)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
