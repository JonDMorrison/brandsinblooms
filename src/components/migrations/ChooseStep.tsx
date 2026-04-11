import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ChooseStepProps {
  provider?: "mailchimp" | "klaviyo" | "constant_contact" | null;
  onComplete: (selection: { listIds: string[]; segmentIds: string[] }) => void;
  onBack: () => void;
}

interface List {
  id: string;
  name: string;
  memberCount: number;
  segments: Array<{
    id: number;
    name: string;
    memberCount: number;
    type: string;
  }>;
}

export const ChooseStep = ({
  provider,
  onComplete,
  onBack,
}: ChooseStepProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<List[]>([]);
  const [availableTotals, setAvailableTotals] = useState({
    lists: 0,
    segments: 0,
  });
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    fetchLists();
  }, [provider]);

  const fetchLists = async () => {
    try {
      // Check which provider is connected
      const connectionQuery = supabase
        .from("provider_connections")
        .select("provider")
        .eq("status", "connected");

      const { data: connections } = provider
        ? await connectionQuery.eq("provider", provider)
        : await connectionQuery.in("provider", [
            "mailchimp",
            "klaviyo",
            "constant_contact",
          ]);

      if (!connections?.length) {
        toast({
          title: "No Connection",
          description: provider
            ? "Please connect the selected provider first"
            : "Please connect a provider first",
          variant: "destructive",
        });
        return;
      }

      const connectedProvider = provider ?? connections[0].provider;

      // Fetch lists based on provider
      if (connectedProvider === "mailchimp") {
        const { data, error } = await supabase.functions.invoke(
          "mailchimp-fetch-lists",
        );
        if (error) {
          console.error("Mailchimp invoke error:", error);
          throw error;
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        const fetchedLists = data?.lists || [];
        setLists(fetchedLists);
        setAvailableTotals({
          lists: data?.totalLists ?? fetchedLists.length,
          segments:
            data?.totalSegments ??
            fetchedLists.reduce(
              (count: number, list: List) =>
                count + (list.segments?.length ?? 0),
              0,
            ),
        });
      } else if (connectedProvider === "klaviyo") {
        const { data, error } = await supabase.functions.invoke(
          "klaviyo-fetch-lists",
        );
        if (error) throw error;
        const fetchedLists = data.lists || [];
        setLists(fetchedLists);
        setAvailableTotals({
          lists: fetchedLists.length,
          segments: fetchedLists.reduce(
            (count: number, list: List) => count + (list.segments?.length ?? 0),
            0,
          ),
        });
      } else if (connectedProvider === "constant_contact") {
        const { data, error } = await supabase.functions.invoke(
          "constant-contact-fetch-lists",
        );
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        // Constant Contact lists don't have segments, so we normalize the structure
        const listsWithSegments = (data?.lists || []).map((list: any) => ({
          ...list,
          segments: [], // Constant Contact doesn't have list-level segments
        }));
        setLists(listsWithSegments);
        setAvailableTotals({
          lists: listsWithSegments.length,
          segments: 0,
        });
      }
    } catch (error: any) {
      console.error("Fetch lists error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
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
      segmentIds: Array.from(selectedSegments),
    });
  };

  const canProceed = selectedLists.size > 0 || selectedSegments.size > 0;
  const selectedListCount = selectedLists.size;
  const selectedSegmentCount = selectedSegments.size;
  const selectedAudienceEstimate = lists.reduce((total, list) => {
    let nextTotal = total;

    if (selectedLists.has(list.id)) {
      nextTotal += list.memberCount;
    }

    for (const segment of list.segments ?? []) {
      if (selectedSegments.has(`${list.id}:${segment.id}`)) {
        nextTotal += segment.memberCount;
      }
    }

    return nextTotal;
  }, 0);
  const scopeMessage =
    selectedListCount > 0 && selectedSegmentCount > 0
      ? "Full lists import every contact in those audiences. Selected segments are imported as additional scopes, and duplicate contacts are skipped during import."
      : selectedSegmentCount > 0
        ? "Only contacts inside the selected segments will be imported."
        : selectedListCount > 0
          ? "Every contact in the selected lists will be imported."
          : "Choose full lists, individual segments, or a mix of both.";

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
          Select the lists and segments you want to import from your connected
          provider.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Available Lists</p>
          <p className="mt-2 text-2xl font-semibold">
            {availableTotals.lists.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Available Segments</p>
          <p className="mt-2 text-2xl font-semibold">
            {availableTotals.segments.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Selected Audience</p>
          <p className="mt-2 text-2xl font-semibold">
            {selectedAudienceEstimate.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pre-dedupe estimate across {selectedListCount} list
            {selectedListCount === 1 ? "" : "s"} and {selectedSegmentCount}{" "}
            segment
            {selectedSegmentCount === 1 ? "" : "s"}
          </p>
        </Card>
      </div>

      <Card className="border-dashed p-4">
        <p className="text-sm font-medium">Import scope</p>
        <p className="mt-1 text-sm text-muted-foreground">{scopeMessage}</p>
      </Card>

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
                    {list.memberCount.toLocaleString()} contacts
                  </span>
                </div>

                {list.segments?.length > 0 && (
                  <div className="mt-3 pl-4 border-l-2 border-border space-y-2">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Segments:
                    </p>
                    {list.segments.map((segment) => (
                      <div key={segment.id} className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedSegments.has(
                            `${list.id}:${segment.id}`,
                          )}
                          onCheckedChange={() =>
                            handleSegmentToggle(list.id, segment.id)
                          }
                        />
                        <span className="text-sm flex-1">{segment.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {segment.memberCount.toLocaleString()}
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
          <p className="text-muted-foreground">
            No lists found in your connected account.
          </p>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!canProceed}>
          Continue ({selectedListCount + selectedSegmentCount} selected)
        </Button>
      </div>
    </div>
  );
};
