
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, ArrowRight, Instagram, Facebook, Mail, FileText } from "lucide-react";
import { getTasksByStatus } from './homepageUtils';

interface ContentPipelineCardProps {
  tasks: any[];
  onNavigateToKanban: () => void;
  onTaskClick: (task: any) => void;
}

export const ContentPipelineCard = ({ tasks, onNavigateToKanban, onTaskClick }: ContentPipelineCardProps) => {
  const getPostTypeIcon = (postType: string) => {
    switch (postType) {
      case 'instagram': return <Instagram className="w-4 h-4" />;
      case 'facebook': return <Facebook className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <Card className="shadow-lg border-green-200 rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl text-black font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Content Pipeline
            </CardTitle>
            <CardDescription className="font-medium text-black">Quick overview</CardDescription>
          </div>
          <Button onClick={onNavigateToKanban} size="sm" className="bg-primary hover:bg-primary-600 text-white shadow-md font-semibold">
            View All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {['generating', 'review', 'scheduled'].map((status) => {
            const statusTasks = getTasksByStatus(tasks, status);
            return (
              <div key={status} className="space-y-2">
                <h4 className="font-semibold text-gray-700 capitalize flex items-center gap-2 text-sm">
                  {status === 'generating' && <div className="w-3 h-3 rounded-full bg-blue-500"></div>}
                  {status === 'review' && <div className="w-3 h-3 rounded-full bg-yellow-500"></div>}
                  {status === 'scheduled' && <div className="w-3 h-3 rounded-full bg-green-500"></div>}
                  {status} ({statusTasks.length})
                </h4>
                <div className="space-y-2">
                  {statusTasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm cursor-pointer transition-all duration-200 hover:border-green-300"
                      onClick={() => onTaskClick(task)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {getPostTypeIcon(task.post_type)}
                        <span className="text-xs font-medium text-black">{task.campaigns?.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 capitalize">{task.post_type}</p>
                    </div>
                  ))}
                  {statusTasks.length === 0 && (
                    <div className="p-3 border-2 border-dashed border-gray-300 rounded-lg text-center bg-gray-50">
                      <p className="text-xs text-gray-400">No tasks</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
