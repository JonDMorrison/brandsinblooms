import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TemplateCardProps {
  title: string;
  steps: number;
  onUse: () => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ title, steps, onUse }) => {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          {steps} step{steps !== 1 ? 's' : ''} automation
        </p>
        <Button onClick={onUse} className="w-full">
          Use Template
        </Button>
      </CardContent>
    </Card>
  );
};