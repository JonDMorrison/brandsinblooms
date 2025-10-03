import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, ArrowLeft, ArrowRight } from 'lucide-react';
import { usePlanWizard } from '../PlanWizardContext';
import { PlanItem } from '../constants';
import { EmailPreviewCard, FacebookPreviewCard, InstagramPreviewCard, SMSPreviewCard, BlogPreviewCard } from '../preview-cards';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { fetchSmartImage } from '@/services/unsplashService';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PlanStepPreviewProps {
  onNext: () => void;
  onBack: () => void;
}

export const PlanStepPreview: React.FC<PlanStepPreviewProps> = ({ onNext, onBack }) => {
  const { state, updateItem } = usePlanWizard();
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
  const [editedCaption, setEditedCaption] = useState('');
  const [selectingImageFor, setSelectingImageFor] = useState<string | null>(null);
  const [regeneratingItem, setRegeneratingItem] = useState<string | null>(null);

  const enabledItems = state.items.filter(item => item.enabled);
  const monthName = state.month ? format(new Date(state.month + '-01'), 'MMMM yyyy') : '';

  // Group by week
  const itemsByWeek = enabledItems.reduce((acc, item) => {
    if (!acc[item.week]) acc[item.week] = [];
    acc[item.week].push(item);
    return acc;
  }, {} as Record<number, PlanItem[]>);

  const handleEditContent = (item: PlanItem) => {
    setEditingItem(item);
    setEditedCaption(item.caption);
  };

  const handleSaveEdit = () => {
    if (editingItem) {
      updateItem(editingItem.id, { caption: editedCaption });
      setEditingItem(null);
      toast.success('Content updated');
    }
  };

  const handleRegenerateItem = async (item: PlanItem) => {
    setRegeneratingItem(item.id);
    try {
      // TODO: Call edge function to regenerate single item
      toast.success('Content regenerated');
    } catch (error) {
      toast.error('Failed to regenerate');
    } finally {
      setRegeneratingItem(null);
    }
  };

  const handleImageSelect = async (itemId: string) => {
    setSelectingImageFor(itemId);
  };

  const handleImageSelected = async (imageUrl: string, itemId: string) => {
    updateItem(itemId, { imageUrl });
    setSelectingImageFor(null);
    toast.success('Image updated');
  };

  const renderPreviewCard = (item: PlanItem) => {
    const commonProps = {
      item,
      onEdit: () => handleEditContent(item),
      onRegenerate: () => handleRegenerateItem(item),
      onImageSelect: () => handleImageSelect(item.id)
    };

    switch (item.type) {
      case 'email':
        return <EmailPreviewCard {...commonProps} />;
      case 'facebook':
        return <FacebookPreviewCard {...commonProps} />;
      case 'instagram':
        return <InstagramPreviewCard {...commonProps} />;
      case 'sms':
        return <SMSPreviewCard {...commonProps} />;
      case 'blog':
        return <BlogPreviewCard {...commonProps} />;
      default:
        return null;
    }
  };

  const getWeekLabel = (week: number) => {
    const labels = ['Early', 'Mid', 'Late', 'End'];
    return `${labels[week - 1] || 'Week ' + week} ${monthName.split(' ')[0]}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Eye className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold">Review & Customize</h2>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Review your {enabledItems.length} content pieces for {monthName}. Edit copy, swap images, or regenerate any piece.
        </p>
      </div>

      {/* Content organized by week */}
      <div className="space-y-8">
        {Object.keys(itemsByWeek)
          .sort((a, b) => Number(a) - Number(b))
          .map((weekNum) => {
            const weekItems = itemsByWeek[Number(weekNum)];
            
            return (
              <div key={weekNum} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px bg-border flex-1" />
                  <h3 className="text-lg font-semibold text-foreground/80">
                    {getWeekLabel(Number(weekNum))}
                  </h3>
                  <div className="h-px bg-border flex-1" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {weekItems.map(item => (
                    <div key={item.id}>
                      {renderPreviewCard(item)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Content</label>
              <Textarea
                value={editedCaption}
                onChange={(e) => setEditedCaption(e.target.value)}
                rows={8}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingItem(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Selector Dialog */}
      <Dialog open={!!selectingImageFor} onOpenChange={() => setSelectingImageFor(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Select Image</DialogTitle>
          </DialogHeader>
          {selectingImageFor && (
            <MediaSelectorImage
              src={state.items.find(i => i.id === selectingImageFor)?.imageUrl || ''}
              onChange={(url) => handleImageSelected(url, selectingImageFor)}
              contentContext={state.items.find(i => i.id === selectingImageFor)?.caption || ''}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8">
        <Button
          variant="outline"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Calendar
        </Button>
        <Button
          onClick={onNext}
          size="lg"
          className="gap-2"
        >
          Continue to Review
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
