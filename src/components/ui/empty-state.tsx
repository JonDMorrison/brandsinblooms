
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => {
  return (
    <Card className={`bg-gray-50 border-2 border-dashed border-gray-200 transition-all duration-150 hover:border-gray-300 hover:bg-gray-100/50 ${className}`}>
      <CardContent className="p-8 text-center">
        <div className="space-y-4">
          <div className="text-muted-foreground">
            <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-full flex items-center justify-center shadow-sm">
              <Icon className="w-8 h-8 text-brand-teal" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-brand-navy tracking-tight">{title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">{description}</p>
          </div>
          {action && (
            <Button onClick={action.onClick} className="mt-6">
              {action.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
