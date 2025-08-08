import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer';
import { Lightbulb } from 'lucide-react';
import { AIGuidancePanel } from './AIGuidancePanel';
import type { Node } from '@xyflow/react';

interface AIAssistantProps {
  nodes: Node[];
  hasAudience: boolean;
  isReadyToLaunch?: boolean;
  onAddNode?: (type: string) => void;
  onOpenAudienceSelector?: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  nodes,
  hasAudience,
  isReadyToLaunch = false,
  onAddNode,
  onOpenAudienceSelector,
}) => {
  const [open, setOpen] = useState(false);

  const hasTrigger = useMemo(
    () => nodes?.some((n: any) => n.type === 'trigger'),
    [nodes]
  );
  const hasActions = useMemo(
    () => nodes?.some((n: any) => ['email', 'sms', 'delay'].includes(n.type)),
    [nodes]
  );
  const completed = (hasTrigger ? 1 : 0) + (hasActions ? 1 : 0) + (hasAudience ? 1 : 0);

  useEffect(() => {
    const saved = localStorage.getItem('ai_assistant_open');
    if (saved === 'true') setOpen(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_assistant_open', open ? 'true' : 'false');
  }, [open]);

  return (
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <Button
          aria-label="Open AI Assistant"
          className="fixed bottom-5 right-5 rounded-full shadow-lg h-12 w-12 p-0 z-50"
          variant="default"
          size="icon"
        >
          <span className="sr-only">AI Assistant</span>
          <Lightbulb className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 min-w-[20px] rounded-full text-[10px] px-1 bg-primary text-primary-foreground">
            {completed}/3
          </span>
        </Button>
      </DrawerTrigger>

      <DrawerContent className="max-w-full md:max-w-md mx-auto">
        <DrawerHeader>
          <DrawerTitle>AI Assistant</DrawerTitle>
          <DrawerDescription>Guided steps to build your automation</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6">
          <AIGuidancePanel
            nodes={nodes as any}
            hasValidFlow={Boolean(nodes?.length)}
            hasAudience={hasAudience}
            isReadyToLaunch={isReadyToLaunch}
            onAddNode={onAddNode || (() => {})}
            onOpenAudienceSelector={onOpenAudienceSelector || (() => {})}
          />
        </div>

        <div className="px-4 pb-4">
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full">Close</Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
