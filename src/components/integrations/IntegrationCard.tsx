import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

interface IntegrationCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  isConnected?: boolean;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}

export function IntegrationCard({ 
  title, 
  description, 
  icon, 
  isConnected,
  badge,
  children 
}: IntegrationCardProps) {
  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {icon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{title}</CardTitle>
              {badge}
            </div>
            {isConnected && (
              <Badge variant="secondary" className="mt-1">
                <Check className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="mt-auto pt-2">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
