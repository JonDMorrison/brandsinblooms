
import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import { usePublishFlow } from '@/hooks/usePublishFlow';

interface ApprovalButtonProps {
  taskId: string;
  currentStatus: string;
  onApproved?: (contentId: string) => void;
}

export const ApprovalButton = ({ taskId, currentStatus, onApproved }: ApprovalButtonProps) => {
  const { approveDraft, loading } = usePublishFlow();

  const handleApprove = async () => {
    const contentId = await approveDraft(taskId);
    if (contentId && onApproved) {
      onApproved(contentId);
    }
  };

  if (currentStatus === 'approved' || currentStatus === 'scheduled' || currentStatus === 'published') {
    return (
      <Button disabled className="bg-green-100 text-green-800">
        <CheckCircle className="w-4 h-4 mr-2" />
        Approved
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleApprove}
      disabled={loading}
      className="bg-[#68BEB9] hover:bg-[#56a7a1] text-white"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <CheckCircle className="w-4 h-4 mr-2" />
      )}
      {loading ? 'Approving...' : 'Approve for Publishing'}
    </Button>
  );
};
