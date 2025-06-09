
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
      console.log('Approving task with status change to: completed');
      
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'completed' })
        .eq('id', task.id);

      if (error) {
        console.error('Error approving task:', error);
        toast({
          title: "Error",
          description: `Failed to approve content: ${error.message}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Content Approved! ✅",
          description: "Content has been approved and is ready to post.",
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

  if (task?.status !== 'review') return null;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="p-4">
        <div className="text-center">
          <h3 className="font-semibold text-orange-800 mb-2">Ready for Approval</h3>
          <p className="text-sm text-orange-700 mb-4">
            Review the content below and approve it to move to ready-to-post status.
          </p>
          <Button 
            onClick={handleApprove}
            disabled={isApproving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {isApproving ? "Approving..." : "Approve Content"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
