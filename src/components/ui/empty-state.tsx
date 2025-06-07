
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
    <Card className={className}>
      <CardContent className="p-8 text-center">
        <div className="space-y-4">
          <div className="text-muted-foreground">
            <Icon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <p className="text-sm">{description}</p>
          </div>
          {action && (
            <Button onClick={action.onClick} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {action.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
