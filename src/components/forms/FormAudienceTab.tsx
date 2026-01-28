import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';

interface Persona {
  id: string;
  name: string;
  description: string | null;
}

interface FormAudienceTabProps {
  audience: {
    assign_personas: string[];
    assign_tags: string[];
  };
  onAudienceChange: (audience: {
    assign_personas: string[];
    assign_tags: string[];
  }) => void;
}

export function FormAudienceTab({ audience, onAudienceChange }: FormAudienceTabProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) {
          setPersonas([]);
          setIsLoading(false);
          return;
        }

        const userResult = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.user.id)
          .single();

        if (!userResult.data?.tenant_id) {
          setPersonas([]);
          setIsLoading(false);
          return;
        }

        const tenantId = userResult.data.tenant_id;

        // Bypass deep type instantiation with explicit any cast
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = supabase as any;
        const personasResult = await client
          .from('personas')
          .select('id, name, description')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('name');

        if (personasResult.error) throw personasResult.error;
        
        const mappedPersonas: Persona[] = (personasResult.data || []).map((p: any) => ({
          id: String(p.id),
          name: String(p.name || ''),
          description: p.description ? String(p.description) : null,
        }));
        
        setPersonas(mappedPersonas);
      } catch (err) {
        console.error('Error fetching personas:', err);
        setPersonas([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersonas();
  }, []);

  const togglePersona = (personaId: string) => {
    const current = audience.assign_personas || [];
    const updated = current.includes(personaId)
      ? current.filter((id) => id !== personaId)
      : [...current, personaId];
    onAudienceChange({ ...audience, assign_personas: updated });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Persona on Submit
          </CardTitle>
          <CardDescription>
            Automatically assign a persona to contacts when they submit this form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground">Loading personas...</div>
          ) : personas.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No personas found.</p>
              <p className="text-sm">Create personas in CRM → Personas first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => togglePersona(persona.id)}
                >
                  <Checkbox
                    checked={(audience.assign_personas || []).includes(persona.id)}
                    onCheckedChange={() => togglePersona(persona.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{persona.name}</div>
                    {persona.description && (
                      <p className="text-sm text-muted-foreground">{persona.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Assign Tags on Submit
          </CardTitle>
          <CardDescription>Automatically add tags to contacts when they submit this form.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Tag assignment coming soon.</p>
          </div>
        </CardContent>
      </Card>

      {(audience.assign_personas?.length > 0) && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Assignment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {audience.assign_personas.map((personaId) => {
                const persona = personas.find((p) => p.id === personaId);
                return persona ? (
                  <Badge key={personaId} variant="secondary">
                    <Users className="h-3 w-3 mr-1" />
                    {persona.name}
                  </Badge>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
