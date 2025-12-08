import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FeaturedCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: { label: string; className?: string };
  features?: string[];
  children?: React.ReactNode;
}

export function FeaturedCard({ 
  title, 
  description, 
  icon,
  badge,
  features,
  children 
}: FeaturedCardProps) {
  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <CardTitle className="text-lg">{title}</CardTitle>
                {badge && (
                  <Badge className={badge.className || "bg-primary"}>
                    {badge.label}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {features && features.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {features.map((feature, index) => (
              <React.Fragment key={index}>
                <span>{feature}</span>
                {index < features.length - 1 && <span>•</span>}
              </React.Fragment>
            ))}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
