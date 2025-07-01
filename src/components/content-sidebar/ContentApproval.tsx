
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ContentApprovalProps {
  task: any;
  onTaskUpdate?: () => void;
  onClose: () => void;
}

export const ContentApproval = ({ task, onTaskUpdate, onClose }: ContentApprovalProps) => {
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      console.log('Approving task with status change to: approved');
      console.log('Task details:', {
        id: task.id,
        tenant_id: task.tenant_id,
        holiday_id: task.holiday_id,
        campaign_id: task.campaign_id
      });
      
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'approved' })
        .eq('id', task.id);

      if (error) {
        console.error('Error approving task:', error);
        toast({
          title: "Error",
          description: `Failed to approve content: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('Task approved successfully, should now appear in Publish Portal');
        toast({
          title: "Content Approved! ✅",
          description: "Content is now ready for publishing. Open Publish Portal to schedule or publish immediately.",
        });
        if (onTaskUpdate) onTaskUpdate();
        onClose();
      }
    } catch (error) {
      console.error('Error approving task:', error);
      toast({
        title: "Error",
        description: "Failed to approve content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  // Show approval button for content that's ready for review
  if (task?.status === 'review' && task?.ai_output) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="text-center">
            <h3 className="font-semibold text-blue-800 mb-2">Ready for Approval</h3>
            <p className="text-sm text-blue-700 mb-4">
              Review the content below and approve it to make it ready for publishing.
            </p>
            <div className="space-y-2">
              <Button 
                onClick={handleApprove}
                disabled={isApproving}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isApproving ? "Approving..." : "Approve Content"}
              </Button>
              <p className="text-xs text-blue-600 text-center">
                After approval, you can publish or schedule in the Publish Portal
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show status for already approved content
  if (task?.status === 'approved') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <h3 className="font-semibold text-green-800 mb-1">Content Approved</h3>
            <p className="text-sm text-green-700 mb-3">
              This content is ready for publishing.
            </p>
            <Button 
              onClick={() => window.location.href = '/publish'}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
              size="sm"
            >
              Open Publish Portal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show status for scheduled content
  if (task?.status === 'scheduled') {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <h3 className="font-semibold text-blue-800 mb-1">Scheduled for Publishing</h3>
            <p className="text-sm text-blue-700">
              This content is scheduled and will be published automatically.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show status for published content
  if (task?.status === 'published') {
    return (
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4">
          <div className="text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <h3 className="font-semibold text-purple-800 mb-1">Published</h3>
            <p className="text-sm text-purple-700">
              This content has been successfully published to your social media.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
