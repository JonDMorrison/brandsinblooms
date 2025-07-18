
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Paintbrush, 
  Clock, 
  Zap, 
  Layout, 
  Image,
  ArrowRight,
  Settings,
  X
} from 'lucide-react';

interface EmailBuilderModeSelectorProps {
  onModeSelect: (mode: 'simple' | 'advanced') => void;
  defaultMode?: 'simple' | 'advanced';
}

export const EmailBuilderModeSelector: React.FC<EmailBuilderModeSelectorProps> = ({
  onModeSelect,
  defaultMode
}) => {
  const [savedPreference, setSavedPreference] = useState<'simple' | 'advanced' | null>(null);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [showPreferenceBanner, setShowPreferenceBanner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserPreference();
  }, []);

  const loadUserPreference = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Try to load from database first
        const { data: profile } = await supabase
          .from('company_profiles')
          .select('feature_flags')
          .eq('user_id', user.id)
          .single();
        
        const featureFlags = profile?.feature_flags as any;
        const dbPreference = featureFlags?.email_builder_mode;
        if (dbPreference && ['simple', 'advanced'].includes(dbPreference)) {
          setSavedPreference(dbPreference as 'simple' | 'advanced');
          setShowPreferenceBanner(true);
        }
      }
      
      // Fallback to localStorage if no DB preference
      if (!savedPreference) {
        const localPreference = localStorage.getItem('email_builder_preferred_mode') as 'simple' | 'advanced' | null;
        if (localPreference && ['simple', 'advanced'].includes(localPreference)) {
          setSavedPreference(localPreference);
          setShowPreferenceBanner(true);
        }
      }
    } catch (error) {
      console.error('Error loading user preference:', error);
      // Fallback to localStorage
      const localPreference = localStorage.getItem('email_builder_preferred_mode') as 'simple' | 'advanced' | null;
      if (localPreference && ['simple', 'advanced'].includes(localPreference)) {
        setSavedPreference(localPreference);
        setShowPreferenceBanner(true);
      }
    }
    setLoading(false);
  };

  const saveUserPreference = async (mode: 'simple' | 'advanced') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user && setAsDefault) {
        // Save to database
        const { error } = await supabase
          .from('company_profiles')
          .update({
            feature_flags: {
              email_builder_mode: mode
            }
          })
          .eq('user_id', user.id);
        
        if (error) throw error;
        toast.success('Email builder preference saved!');
      }
      
      // Always save to localStorage as backup
      localStorage.setItem('email_builder_preferred_mode', mode);
    } catch (error) {
      console.error('Error saving preference:', error);
      // Still save to localStorage
      localStorage.setItem('email_builder_preferred_mode', mode);
      toast.error('Could not save preference to account, but saved locally');
    }
  };

  const handleModeSelect = async (mode: 'simple' | 'advanced') => {
    if (setAsDefault) {
      await saveUserPreference(mode);
    } else {
      // Still update localStorage for session
      localStorage.setItem('email_builder_preferred_mode', mode);
    }
    onModeSelect(mode);
  };

  const clearPreference = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase
          .from('company_profiles')
          .update({
            feature_flags: {
              email_builder_mode: null
            }
          })
          .eq('user_id', user.id);
        
        if (error) throw error;
      }
      
      localStorage.removeItem('email_builder_preferred_mode');
      setSavedPreference(null);
      setShowPreferenceBanner(false);
      toast.success('Email builder preference cleared');
    } catch (error) {
      console.error('Error clearing preference:', error);
      localStorage.removeItem('email_builder_preferred_mode');
      setSavedPreference(null);
      setShowPreferenceBanner(false);
      toast.error('Could not clear preference from account, but cleared locally');
    }
  };

  const useDefaultMode = () => {
    if (savedPreference) {
      handleModeSelect(savedPreference);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading your preferences...</p>
        </div>
      </div>
    );
  }

  const modes = [
    {
      id: 'simple' as const,
      title: 'Simple Email',
      subtitle: 'Quick & Easy',
      description: 'Perfect for announcements, updates, and quick messages',
      icon: MessageSquare,
      features: [
        'Clean text editor',
        'Subject line + message',
        'Personalization tokens',
        'Mobile optimized'
      ],
      useCase: 'Just need a quick message? Choose Simple.',
      color: 'bg-green-50 border-green-200 hover:bg-green-100',
      iconColor: 'text-green-600'
    },
    {
      id: 'advanced' as const,
      title: 'Advanced Newsletter',
      subtitle: 'Full Design Control',
      description: 'Complete drag-and-drop builder with rich media support',
      icon: Paintbrush,
      features: [
        'Drag & drop blocks',
        'Images & media',
        'Custom layouts',
        'Real-time preview'
      ],
      useCase: 'Want full design control? Use the Advanced Builder.',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      iconColor: 'text-blue-600'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* Preference Banner */}
      {showPreferenceBanner && savedPreference && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Using your default: {savedPreference === 'simple' ? 'Simple Email' : 'Advanced Newsletter'} Mode
              </p>
              <p className="text-xs text-blue-700">
                Want to use this mode? Click "Continue with Default" or choose a different mode below.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={useDefaultMode}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Continue with Default
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearPreference}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Choose Your Email Builder</h2>
        <p className="text-muted-foreground">
          Select the editor that best fits your campaign needs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {modes.map((mode) => {
          const IconComponent = mode.icon;
          const isDefault = defaultMode === mode.id;
          
          return (
            <Card 
              key={mode.id}
              className={`relative cursor-pointer transition-all duration-200 ${mode.color} ${
                isDefault ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => handleModeSelect(mode.id)}
            >
              <CardContent className="p-6">
                {isDefault && (
                  <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground">
                    Last Used
                  </Badge>
                )}
                
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-lg bg-white shadow-sm ${mode.iconColor}`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-1">{mode.title}</h3>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      {mode.subtitle}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {mode.description}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium mb-3">{mode.useCase}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {mode.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm font-medium">
                  {mode.id === 'simple' ? (
                    <>
                      <Clock className="h-4 w-4" />
                      2-3 minutes to create
                    </>
                  ) : (
                    <>
                      <Layout className="h-4 w-4" />
                      10-15 minutes to design
                    </>
                  )}
                </div>

                <Button 
                  className="w-full mt-4 gap-2"
                  variant={mode.id === 'simple' ? 'default' : 'outline'}
                >
                  Start {mode.title}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Set as Default Option */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 p-4 bg-muted/50 rounded-lg">
          <Checkbox 
            id="setAsDefault" 
            checked={setAsDefault}
            onCheckedChange={(checked) => setSetAsDefault(checked === true)}
          />
          <label 
            htmlFor="setAsDefault" 
            className="text-sm font-medium cursor-pointer"
          >
            Set this as my default email builder mode
          </label>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">
          💡 <strong>Pro tip:</strong> You can switch between modes during creation
        </p>
        {!showPreferenceBanner && (
          <p className="text-xs text-muted-foreground">
            Check "Set as default" above to skip this selection in the future
          </p>
        )}
      </div>
    </div>
  );
};
