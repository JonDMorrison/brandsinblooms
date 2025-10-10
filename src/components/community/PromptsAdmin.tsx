import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

interface StaffPrompt {
  id: string;
  title: string;
  message: string;
  frequency: string;
  target_role: string;
  is_active: boolean;
  created_at: string;
}

export const PromptsAdmin = () => {
  const [prompts, setPrompts] = useState<StaffPrompt[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<StaffPrompt | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    frequency: 'weekly',
    target_role: 'all',
  });
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchPrompts = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('staff_prompts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrompts((data as StaffPrompt[]) || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('staff_prompt_responses')
        .select('staff_id, prompt_id, completed_at');

      if (error) throw error;

      // Calculate stats
      const list = (data as any[]) || [];
      const uniqueStaff = new Set(list.map(r => r.staff_id)).size;
      const totalCompletions = list.length;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const thisWeek = list.filter(r => new Date(r.completed_at) >= weekAgo).length;

      setStats({
        uniqueStaff,
        totalCompletions,
        thisWeek,
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchPrompts();
    fetchStats();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Get user's tenant_id
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      const nextTrigger = new Date();
      if (formData.frequency === 'daily') {
        nextTrigger.setDate(nextTrigger.getDate() + 1);
      } else if (formData.frequency === 'weekly') {
        nextTrigger.setDate(nextTrigger.getDate() + 7);
      } else {
        nextTrigger.setMonth(nextTrigger.getMonth() + 1);
      }

      const promptData = {
        ...formData,
        tenant_id: userData?.tenant_id,
        next_trigger_at: nextTrigger.toISOString(),
      };

      if (editingPrompt) {
        const { error } = await (supabase as any)
          .from('staff_prompts')
          .update(promptData)
          .eq('id', editingPrompt.id);

        if (error) throw error;
        toast({ title: 'Updated', description: 'Prompt updated successfully' });
      } else {
        const { error } = await (supabase as any)
          .from('staff_prompts')
          .insert(promptData);

        if (error) throw error;
        toast({ title: 'Created', description: 'New prompt created' });
      }

      setShowDialog(false);
      setEditingPrompt(null);
      setFormData({ title: '', message: '', frequency: 'weekly', target_role: 'all' });
      fetchPrompts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (prompt: StaffPrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      title: prompt.title,
      message: prompt.message,
      frequency: prompt.frequency,
      target_role: prompt.target_role,
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const { error } = await (supabase as any)
        .from('staff_prompts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Deleted', description: 'Prompt removed' });
      fetchPrompts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('staff_prompts')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      fetchPrompts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Active Contributors</p>
                <p className="text-2xl font-bold">{stats.uniqueStaff}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Completions</p>
                <p className="text-2xl font-bold">{stats.totalCompletions}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{stats.thisWeek}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Manage Prompts</h2>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Prompt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPrompt ? 'Edit' : 'Create'} Prompt</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={3}
                  required
                />
              </div>
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <NativeSelect id="frequency" value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="role">Target Role</Label>
                <NativeSelect id="role" value={formData.target_role} onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}>
                  <option value="all">All Staff</option>
                  <option value="manager">Managers</option>
                  <option value="retail">Retail</option>
                  <option value="marketing">Marketing</option>
                </NativeSelect>
              </div>
              <Button type="submit" className="w-full">
                {editingPrompt ? 'Update' : 'Create'} Prompt
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {prompts.map((prompt) => (
          <Card key={prompt.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">{prompt.title}</h3>
                  <Badge variant={prompt.is_active ? 'default' : 'secondary'}>
                    {prompt.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">{prompt.frequency}</Badge>
                  <Badge variant="outline">{prompt.target_role}</Badge>
                </div>
                <p className="text-muted-foreground">{prompt.message}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleActive(prompt.id, prompt.is_active)}
                >
                  {prompt.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(prompt)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(prompt.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
