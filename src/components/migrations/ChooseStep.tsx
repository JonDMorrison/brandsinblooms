import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface ChooseStepProps {
  onComplete: (selection: { listIds: string[]; segmentIds: string[] }) => void;
  onBack: () => void;
}

interface List {
  id: string;
  name: string;
  member_count: number;
  segments: Array<{
    id: string;
    name: string;
    member_count: number;
  }>;
}

export const ChooseStep = ({ onComplete, onBack }: ChooseStepProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<List[]>([]);
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      // Check which provider is connected
      const { data: connections } = await supabase
        .from('provider_connections')
        .select('provider')
        .eq('status', 'connected')
        .in('provider', ['mailchimp', 'klaviyo']);

      if (!connections?.length) {
        toast({
          title: 'No Connection',
          description: 'Please connect a provider first',
          variant: 'destructive'
        });
        return;
      }

      const provider = connections[0].provider;

      // Fetch lists based on provider
      if (provider === 'mailchimp') {
        const { data, error } = await supabase.functions.invoke('mailchimp-fetch-lists');
        
        console.log('Mailchimp response:', { data, error });
        
        if (error) {
          console.error('Mailchimp invoke error:', error);
          throw error;
        }
        
        if (data?.error) {
          throw new Error(data.error);
        }
        
        setLists(data?.lists || []);
      } else if (provider === 'klaviyo') {
        const { data, error } = await supabase.functions.invoke('klaviyo-fetch-lists');
        if (error) throw error;
        setLists(data.lists || []);
      }
    } catch (error: any) {
      console.error('Fetch lists error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleListToggle = (listId: string) => {
    const newSelection = new Set(selectedLists);
    if (newSelection.has(listId)) {
      newSelection.delete(listId);
    } else {
      newSelection.add(listId);
    }
    setSelectedLists(newSelection);
  };

  const handleSegmentToggle = (listId: string, segmentId: string) => {
    const fullId = `${listId}:${segmentId}`;
    const newSelection = new Set(selectedSegments);
    if (newSelection.has(fullId)) {
      newSelection.delete(fullId);
    } else {
      newSelection.add(fullId);
    }
    setSelectedSegments(newSelection);
  };

  const handleContinue = () => {
    onComplete({
      listIds: Array.from(selectedLists),
      segmentIds: Array.from(selectedSegments)
    });
  };

  const canProceed = selectedLists.size > 0 || selectedSegments.size > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Choose What to Import</h2>
        <p className="text-muted-foreground">
          Select the lists and segments you want to import from your connected provider.
        </p>
      </div>

      <div className="space-y-4">
        {lists.map((list) => (
          <Card key={list.id} className="p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selectedLists.has(list.id)}
                onCheckedChange={() => handleListToggle(list.id)}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{list.name}</h3>
                  <span className="text-sm text-muted-foreground">
                    {list.member_count.toLocaleString()} contacts
                  </span>
                </div>

                {list.segments?.length > 0 && (
                  <div className="mt-3 pl-4 border-l-2 border-border space-y-2">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Segments:</p>
                    {list.segments.map((segment) => (
                      <div key={segment.id} className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedSegments.has(`${list.id}:${segment.id}`)}
                          onCheckedChange={() => handleSegmentToggle(list.id, segment.id)}
                        />
                        <span className="text-sm flex-1">{segment.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {segment.member_count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {lists.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No lists found in your connected account.</p>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!canProceed}>
          Continue ({selectedLists.size + selectedSegments.size} selected)
        </Button>
      </div>
    </div>
  );
};
