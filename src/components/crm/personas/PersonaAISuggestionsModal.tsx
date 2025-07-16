import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Sparkles, 
  Users, 
  Target, 
  Mail,
  MessageSquare,
  Calendar,
  TrendingUp
} from 'lucide-react';

interface PersonaSuggestion {
  persona: any;
  customerCount: number;
  suggestedThemes: string[];
  tone: string;
  buyingTriggers: string[];
}

interface PersonaAISuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPersonaSelect: (persona: any, theme?: string) => void;
  type: 'email' | 'sms' | 'automation';
}

export function PersonaAISuggestionsModal({ 
  isOpen, 
  onClose, 
  onPersonaSelect, 
  type 
}: PersonaAISuggestionsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<PersonaSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadPersonaSuggestions();
    }
  }, [isOpen, user]);

  const loadPersonaSuggestions = async () => {
    setLoading(true);
    try {
      // Get tenant ID
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.tenant_id) return;

      // Get all personas
      const { data: personas, error: personasError } = await supabase
        .from('personas')
        .select('*')
        .order('name');

      if (personasError) throw personasError;

      // Get customer counts for each persona
      const personaSuggestions: PersonaSuggestion[] = [];

      for (const persona of personas || []) {
        const { count } = await supabase
          .from('crm_customers')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', userData.tenant_id)
          .eq('persona_id', persona.id);

        if (count && count > 0) {
          personaSuggestions.push({
            persona,
            customerCount: count,
            suggestedThemes: generateThemesForPersona(persona, type),
            tone: persona.tone,
            buyingTriggers: persona.buying_triggers || []
          });
        }
      }

      // Sort by customer count (highest first)
      personaSuggestions.sort((a, b) => b.customerCount - a.customerCount);

      setSuggestions(personaSuggestions.slice(0, 3)); // Top 3
    } catch (error) {
      console.error('Error loading persona suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to load persona suggestions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateThemesForPersona = (persona: any, campaignType: string): string[] => {
    const baseThemes: Record<string, string[]> = {
      'email': [
        `${persona.name}'s Garden Guide`,
        `Perfect Plants for ${persona.name}`,
        `${persona.name} Weekly Tips`,
        `Seasonal Update for ${persona.name}`
      ],
      'sms': [
        `Quick tip for ${persona.name}`,
        `${persona.name} plant alert`,
        `Garden reminder for ${persona.name}`,
        `${persona.name} seasonal check`
      ],
      'automation': [
        `${persona.name} Welcome Series`,
        `${persona.name} Care Reminders`,
        `${persona.name} Seasonal Guide`,
        `${persona.name} Purchase Follow-up`
      ]
    };

    return baseThemes[campaignType] || [];
  };

  const handlePersonaSelect = (suggestion: PersonaSuggestion, theme?: string) => {
    onPersonaSelect(suggestion.persona, theme);
    onClose();
    
    toast({
      title: "Persona Selected",
      description: `Using ${suggestion.persona.name} persona for ${type} content`,
    });
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'email':
        return <Mail className="h-5 w-5" />;
      case 'sms':
        return <MessageSquare className="h-5 w-5" />;
      case 'automation':
        return <Calendar className="h-5 w-5" />;
    }
  };

  const getTypeTitle = () => {
    switch (type) {
      case 'email':
        return 'Email Campaign';
      case 'sms':
        return 'SMS Campaign';
      case 'automation':
        return 'Automation';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Need Help? AI Persona Suggestions
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Choose from your top personas with the most customers for your {getTypeTitle().toLowerCase()}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading persona suggestions...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No persona data yet</h3>
              <p className="text-muted-foreground">
                Assign personas to your customers first to get AI suggestions
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {suggestions.map((suggestion, index) => (
                <Card key={suggestion.persona.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{suggestion.persona.icon}</div>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {suggestion.persona.name}
                            <Badge variant="secondary" className="text-xs">
                              #{index + 1} Most Customers
                            </Badge>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {suggestion.persona.description}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Users className="h-4 w-4" />
                          {suggestion.customerCount} customers
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {((suggestion.customerCount / suggestions.reduce((sum, s) => sum + s.customerCount, 0)) * 100).toFixed(0)}% of your customer base
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Tone & Style */}
                    <div>
                      <div className="text-sm font-medium mb-2">Writing Tone & Style</div>
                      <Badge variant="outline" className="mr-2">
                        {suggestion.tone}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {suggestion.persona.sample_phrases?.[0] || "Use engaging, friendly language"}
                      </span>
                    </div>

                    {/* Buying Triggers */}
                    {suggestion.buyingTriggers.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-2">Key Buying Triggers</div>
                        <div className="flex flex-wrap gap-1">
                          {suggestion.buyingTriggers.slice(0, 3).map((trigger, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {trigger}
                            </Badge>
                          ))}
                          {suggestion.buyingTriggers.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{suggestion.buyingTriggers.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Suggested Campaign Themes */}
                    <div>
                      <div className="text-sm font-medium mb-2">Suggested {getTypeTitle()} Themes</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {suggestion.suggestedThemes.map((theme, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="justify-start h-auto p-3 text-left"
                            onClick={() => handlePersonaSelect(suggestion, theme)}
                          >
                            <div>
                              <div className="font-medium text-sm">{theme}</div>
                              <div className="text-xs text-muted-foreground">
                                {getTypeIcon()} {getTypeTitle()} • {suggestion.customerCount} recipients
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Use Persona Button */}
                    <div className="flex justify-end">
                      <Button 
                        onClick={() => handlePersonaSelect(suggestion)}
                        className="flex items-center gap-2"
                      >
                        <TrendingUp className="h-4 w-4" />
                        Use {suggestion.persona.name} Persona
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}