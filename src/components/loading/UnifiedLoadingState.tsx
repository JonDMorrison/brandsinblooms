import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface UnifiedLoadingStateProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
}

export const UnifiedLoadingState = ({ 
  size = 'lg', 
  text = "Loading...", 
  className = "min-h-screen bg-garden-background" 
}: UnifiedLoadingStateProps) => {
  return (
    <div className={className}>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <LoadingSpinner 
              size={size} 
              color="primary" 
              variant="default"
              text={text}
            />
          </div>
        </div>
      </div>
    </div>
  );
};