import { toast } from '@/hooks/use-toast';

export function reportSoftFail(code: string, context?: Record<string, any>) {
  // Log to console for debugging
  console.warn(`[soft-fail] ${code}`, context);

  // Show user-friendly toast based on the error code
  const userMessages: Record<string, string> = {
    'content_generation_empty': "Couldn't generate content right now. Try again or pick an image.",
    'publish_blocked_missing_media': "Publishing requires both content and media. Please add an image.",
    'edge_function_returned_not_ok': "Something went wrong. Please try again.",
    'publish_no_media_container_created': "Failed to prepare media for posting. Please try again.",
    'content_stuck_no_output': "Content generation is taking longer than expected.",
    'scheduled_post_overdue': "A scheduled post failed to publish on time.",
  };

  const userMessage = userMessages[code] || "An unexpected issue occurred. Please try again.";
  
  toast({
    title: "Warning",
    description: userMessage,
    variant: "destructive",
  });
}