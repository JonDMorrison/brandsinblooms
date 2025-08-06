import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Mail, Users, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewsletterSchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDate?: Date;
  existingNewsletter?: any;
  mode: 'create' | 'edit';
}

interface Segment {
  id: string;
  name: string;
  customer_count: number;
}

export const NewsletterSchedulingModal: React.FC<NewsletterSchedulingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedDate,
  existingNewsletter,
  mode
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    subject_line: '',
    preheader_text: '',
    segment_id: '',
    schedule_date: selectedDate || new Date(),
    schedule_time: '09:00'
  });

  // Load segments on mount
  useEffect(() => {
    if (isOpen) {
      loadSegments();
      if (mode === 'edit' && existingNewsletter) {
        populateFormFromNewsletter();
      } else if (mode === 'create') {
        resetForm();
      }
    }
  }, [isOpen, mode, existingNewsletter]);

  const loadSegments = async () => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userData?.tenant_id) {
        const { data, error } = await supabase
          .from('crm_segments')
          .select('id, name, customer_count')
          .eq('tenant_id', userData.tenant_id)
          .order('name');

        if (error) throw error;
        setSegments(data || []);
      }
    } catch (error) {
      console.error('Error loading segments:', error);
    }
  };

  const populateFormFromNewsletter = () => {
    if (!existingNewsletter) return;
    
    const scheduledAt = existingNewsletter.scheduled_at ? new Date(existingNewsletter.scheduled_at) : new Date();
    
    setFormData({
      name: existingNewsletter.name || '',
      subject_line: existingNewsletter.subject_line || '',
      preheader_text: existingNewsletter.preheader_text || '',
      segment_id: existingNewsletter.segment_id || '',
      schedule_date: scheduledAt,
      schedule_time: format(scheduledAt, 'HH:mm')
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      subject_line: '',
      preheader_text: '',
      segment_id: '',
      schedule_date: selectedDate || new Date(),
      schedule_time: '09:00'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!userData?.tenant_id) {
        throw new Error('No tenant found');
      }

      // Combine date and time
      const scheduledAt = new Date(formData.schedule_date);
      const [hours, minutes] = formData.schedule_time.split(':');
      scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const campaignData = {
        tenant_id: userData.tenant_id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        name: formData.name,
        subject_line: formData.subject_line,
        preheader_text: formData.preheader_text,
        segment_id: formData.segment_id || null,
        scheduled_at: scheduledAt.toISOString(),
        status: 'scheduled',
        delivery_method: 'shared_sender'
      };

      if (mode === 'edit' && existingNewsletter) {
        const { error } = await supabase
          .from('crm_campaigns')
          .update(campaignData)
          .eq('id', existingNewsletter.id);

        if (error) throw error;

        toast({
          title: "Newsletter Updated",
          description: "Your newsletter has been successfully updated."
        });
      } else {
        const { error } = await supabase
          .from('crm_campaigns')
          .insert([campaignData]);

        if (error) throw error;

        toast({
          title: "Newsletter Scheduled",
          description: `Your newsletter has been scheduled for ${format(scheduledAt, 'MMM d, h:mm a')}.`
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving newsletter:', error);
      toast({
        title: "Error",
        description: "Failed to save newsletter. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNewsletter = async () => {
    if (!existingNewsletter || mode !== 'edit') return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('crm_campaigns')
        .delete()
        .eq('id', existingNewsletter.id);

      if (error) throw error;

      toast({
        title: "Newsletter Deleted",
        description: "The newsletter has been successfully deleted."
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error deleting newsletter:', error);
      toast({
        title: "Error",
        description: "Failed to delete newsletter. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {mode === 'edit' ? 'Edit Newsletter' : 'Schedule New Newsletter'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Newsletter Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Newsletter Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Spring Garden Newsletter"
              required
            />
          </div>

          {/* Subject Line */}
          <div className="space-y-2">
            <Label htmlFor="subject_line">Subject Line</Label>
            <Input
              id="subject_line"
              value={formData.subject_line}
              onChange={(e) => setFormData(prev => ({ ...prev, subject_line: e.target.value }))}
              placeholder="e.g., 🌱 Spring is Here - Time to Plant!"
              required
            />
          </div>

          {/* Preheader Text */}
          <div className="space-y-2">
            <Label htmlFor="preheader_text">Preheader Text (Optional)</Label>
            <Textarea
              id="preheader_text"
              value={formData.preheader_text}
              onChange={(e) => setFormData(prev => ({ ...prev, preheader_text: e.target.value }))}
              placeholder="Preview text that appears in email clients..."
              rows={2}
            />
          </div>

          {/* Audience Segment */}
          <div className="space-y-2">
            <Label>Target Audience</Label>
            <NativeSelect
              label="Target Audience"
              value={formData.segment_id}
              onChange={(e) => setFormData(prev => ({ ...prev, segment_id: e.target.value }))}
              placeholder="Select audience segment"
              options={[
                { value: '', label: 'All Customers' },
                ...segments.map((segment) => ({
                  value: segment.id,
                  label: `${segment.name} (${segment.customer_count} customers)`
                }))
              ]}
            />
          </div>

          {/* Schedule Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Schedule Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.schedule_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.schedule_date ? format(formData.schedule_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.schedule_date}
                    onSelect={(date) => {
                      if (date) {
                        setFormData(prev => ({ ...prev, schedule_date: date }));
                      }
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule_time">Schedule Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="schedule_time"
                  type="time"
                  value={formData.schedule_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, schedule_time: e.target.value }))}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4">
            <div>
              {mode === 'edit' && existingNewsletter?.status !== 'sent' && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteNewsletter}
                  disabled={loading}
                >
                  Delete Newsletter
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : mode === 'edit' ? 'Update Newsletter' : 'Schedule Newsletter'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};