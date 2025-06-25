
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Clock, Zap, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface SchedulingPreference {
  id: string;
  user_id: string;
  platform: string;
  enabled: boolean;
  optimal_times: string[];
  frequency: string;
  created_at: string;
  updated_at: string;
}

const PLATFORM_OPTIONS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' }
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'every_other_day', label: 'Every Other Day' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi_weekly', label: 'Bi-Weekly' }
];

const OPTIMAL_TIMES = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00'
];

export const AutoScheduler: React.FC = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<SchedulingPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('scheduling_preferences')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setPreferences(data || []);
    } catch (error) {
      console.error('Error fetching scheduling preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (platform: string, updates: Partial<SchedulingPreference>) => {
    if (!user) return;

    setSaving(true);
    try {
      const existingPreference = preferences.find(p => p.platform === platform);
      
      if (existingPreference) {
        const { error } = await supabase
          .from('scheduling_preferences')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPreference.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('scheduling_preferences')
          .insert({
            user_id: user.id,
            platform,
            enabled: false,
            optimal_times: ['12:00', '18:00'],
            frequency: 'daily',
            ...updates
          });

        if (error) throw error;
      }

      toast.success('Scheduling preferences updated');
      fetchPreferences();
    } catch (error) {
      console.error('Error updating scheduling preference:', error);
      toast.error('Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const scheduleOptimalPosts = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('schedule-optimal-posts');
      if (error) throw error;
      
      toast.success('Posts scheduled for optimal times');
    } catch (error) {
      console.error('Error scheduling optimal posts:', error);
      toast.error('Failed to schedule posts');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, [user]);

  const getPreferenceForPlatform = (platform: string) => {
    return preferences.find(p => p.platform === platform) || {
      platform,
      enabled: false,
      optimal_times: ['12:00', '18:00'],
      frequency: 'daily'
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Auto-Scheduling
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {PLATFORM_OPTIONS.map(({ value: platform, label }) => {
            const preference = getPreferenceForPlatform(platform);
            
            return (
              <div key={platform} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{label}</Badge>
                    <Label htmlFor={`${platform}-enabled`}>Auto-schedule posts</Label>
                  </div>
                  <Switch
                    id={`${platform}-enabled`}
                    checked={preference.enabled}
                    onCheckedChange={(enabled) => 
                      updatePreference(platform, { enabled })
                    }
                    disabled={saving}
                  />
                </div>

                {preference.enabled && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        Posting Frequency
                      </Label>
                      <Select
                        value={preference.frequency}
                        onValueChange={(frequency) => 
                          updatePreference(platform, { frequency })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCY_OPTIONS.map(({ value, label }) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        Optimal Times
                      </Label>
                      <div className="grid grid-cols-4 gap-2">
                        {OPTIMAL_TIMES.map((time) => (
                          <Button
                            key={time}
                            size="sm"
                            variant={
                              preference.optimal_times?.includes(time) 
                                ? 'default' 
                                : 'outline'
                            }
                            onClick={() => {
                              const currentTimes = preference.optimal_times || [];
                              const newTimes = currentTimes.includes(time)
                                ? currentTimes.filter(t => t !== time)
                                : [...currentTimes, time];
                              updatePreference(platform, { optimal_times: newTimes });
                            }}
                          >
                            {time}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-end pt-4">
            <Button 
              onClick={scheduleOptimalPosts}
              disabled={saving}
              className="flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Schedule Optimal Posts
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Scheduling Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Best Time</span>
              </div>
              <p className="text-lg font-bold text-blue-900">6:00 PM</p>
              <p className="text-xs text-blue-700">Highest engagement</p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">Best Day</span>
              </div>
              <p className="text-lg font-bold text-green-900">Tuesday</p>
              <p className="text-xs text-green-700">Most active audience</p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Optimal Frequency</span>
              </div>
              <p className="text-lg font-bold text-purple-900">Daily</p>
              <p className="text-xs text-purple-700">Based on your audience</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
