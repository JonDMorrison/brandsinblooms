import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { registry, NewsletterBlockType, TNewsletterBlock } from '../blocks/registry';
import { useNewsletterDraft } from '../state/useNewsletterDraft';
import { Sparkles, Plus, GripVertical, Trash2, Copy, Smartphone, Monitor } from 'lucide-react';
import { getMagazineA } from '../templates/magazine/a';
import { getMagazineB } from '../templates/magazine/b';
import { getMagazineC } from '../templates/magazine/c';

interface NewsletterEditorProps {
  docId: string; // stable id used for autosave (UUID recommended)
}

export const NewsletterEditor: React.FC<NewsletterEditorProps> = ({ docId }) => {
  const { blocks, setBlocks, status, lastSavedAt, scheduleSave, saveNow } = useNewsletterDraft({ docId });
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Persist whenever blocks change (debounced by hook)
  useEffect(() => {
    scheduleSave({ blocks });
  }, [blocks, scheduleSave]);

  const addBlock = useCallback((type: NewsletterBlockType) => {
    const def = registry[type].defaults();
    setBlocks((prev) => [...prev, def]);
  }, [setBlocks]);

  const duplicate = (idx: number) => {
    setBlocks((prev) => {
      const copy = [...prev];
      const next = { ...copy[idx], id: crypto.randomUUID() } as TNewsletterBlock;
      copy.splice(idx + 1, 0, next);
      return copy;
    });
  };

  const remove = (idx: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const insertTemplate = (variant: 'A' | 'B' | 'C') => {
    const template = variant === 'A' ? getMagazineA() : variant === 'B' ? getMagazineB() : getMagazineC();
    setBlocks(template);
  };

  return (
    <div className="flex h-full">
      {/* Left: blocks list/editor */}
      <div className="w-full lg:w-[55%] border-r">
        <div className="flex items-center justify-between p-4 sticky top-0 bg-background z-10 border-b">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Magazine Newsletter Editor</h1>
            <span className="text-sm text-muted-foreground">
              {status === 'saving' && 'Saving…'}
              {status === 'saved' && lastSavedAt && `Saved • ${new Date(lastSavedAt).toLocaleTimeString()}`}
              {status === 'merged' && 'Merged – review suggested'}
              {status === 'error' && 'Failed to save'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => insertTemplate('A')} className="gap-2"><Sparkles className="w-4 h-4" />Magazine A</Button>
            <Button variant="outline" size="sm" onClick={() => insertTemplate('B')} className="gap-2"><Sparkles className="w-4 h-4" />Magazine B</Button>
            <Button variant="outline" size="sm" onClick={() => insertTemplate('C')} className="gap-2"><Sparkles className="w-4 h-4" />Magazine C</Button>
          </div>
        </div>

        <div className="p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(registry) as NewsletterBlockType[]).map((t) => (
              <Button key={t} variant="secondary" size="sm" onClick={() => addBlock(t)}>
                + {registry[t].label}
              </Button>
            ))}
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="nl-blocks">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                  {blocks.map((block, idx) => {
                    const meta = registry[block.type as NewsletterBlockType];
                    const Edit = meta.EditComponent as any;
                    const Render = meta.RenderComponent as any;
                    return (
                      <Draggable draggableId={block.id} index={idx} key={block.id}>
                        {(dragProvided) => (
                          <Card ref={dragProvided.innerRef} {...dragProvided.draggableProps} className="p-3">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2" {...dragProvided.dragHandleProps}>
                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                                <div className="text-sm font-medium">{meta.label}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="icon" variant="ghost" onClick={() => duplicate(idx)} aria-label="Duplicate"><Copy className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => remove(idx)} aria-label="Delete"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>

                            {/* Tabs: Edit / Preview for each block */}
                            <Tabs defaultValue="edit">
                              <TabsList>
                                <TabsTrigger value="edit">Edit</TabsTrigger>
                                <TabsTrigger value="preview">Preview</TabsTrigger>
                              </TabsList>
                              <TabsContent value="edit" className="mt-3">
                                <Edit block={block as any} onChange={(next: any) => setBlocks((prev) => prev.map((b, i) => i === idx ? (next as TNewsletterBlock) : b))} />
                              </TabsContent>
                              <TabsContent value="preview" className="mt-3">
                                <Render block={block as any} isPreview />
                              </TabsContent>
                            </Tabs>
                          </Card>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>

      {/* Right: live preview */}
      <div className="hidden lg:block flex-1">
        <div className="flex items-center justify-between p-4 sticky top-0 bg-background z-10 border-b">
          <div className="text-sm text-muted-foreground">Live Preview</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={previewMode === 'desktop' ? 'default' : 'outline'} onClick={() => setPreviewMode('desktop')} className="gap-2"><Monitor className="w-4 h-4" />Desktop</Button>
            <Button size="sm" variant={previewMode === 'mobile' ? 'default' : 'outline'} onClick={() => setPreviewMode('mobile')} className="gap-2"><Smartphone className="w-4 h-4" />Mobile</Button>
          </div>
        </div>
        <div className="p-6">
          <div className={previewMode === 'mobile' ? 'max-w-[375px] mx-auto border rounded-xl overflow-hidden shadow-sm' : 'max-w-[600px] mx-auto'}>
            {/* Simple email-safe-ish preview by composing individual renderers */}
            {blocks.map((b) => {
              const Comp = registry[b.type as NewsletterBlockType].RenderComponent as any;
              return <Comp key={b.id} block={b as any} isPreview />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
