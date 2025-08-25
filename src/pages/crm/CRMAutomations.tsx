import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Calendar, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { useAuth } from "@/hooks/useAuth";

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  is_active: boolean;
  created_at: string;
  workflow_steps: any;
}

const CRMAutomations = () => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseQuery = supabase
        .from('crm_automations')
        .select('*')
        .order('created_at', { ascending: false });

      // Scope by user if available to prevent cross-tenant leaks
      const query = user?.id ? baseQuery.eq('user_id', user.id) : baseQuery;

      const timeoutMs = 8000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
      );

      const { data, error } = await Promise.race([query, timeoutPromise]) as any;

      if (error) throw error;
      setAutomations(data || []);
    } catch (err: any) {
      console.error('Error fetching automations:', err);
      setError(err?.message || 'Failed to load automations');
      toast({
        title: "Error",
        description: err?.message || "Failed to load automations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleAutomation = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('crm_automations')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      setAutomations(prev => prev.map(automation => 
        automation.id === id ? { ...automation, is_active: isActive } : automation
      ));

      toast({
        title: "Success",
        description: `Automation ${isActive ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error toggling automation:', error);
      toast({
        title: "Error",
        description: "Failed to update automation",
        variant: "destructive",
      });
    }
  };

  const getTriggerTypeLabel = (type: string) => {
    const labels = {
      welcome: "Welcome",
      segment_joined: "Segment Joined",
      purchase_delay: "Purchase Delay",
      seasonal: "Seasonal Reminder",
      manual: "Manual"
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <DashboardError onRetry={fetchAutomations} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground">Automations</h1>
          </div>
          <div className="text-center py-8">Loading automations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Automations</h1>
            <p className="text-muted-foreground">
              Set up automated workflows to engage your customers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchAutomations} aria-label="Refresh automations">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Link to="/crm/automations/new/guide">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Automation
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Automations</CardTitle>
          </CardHeader>
          <CardContent>
            {automations.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No automations yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first automation to start engaging customers automatically
                </p>
                <Link to="/crm/automations/new/guide">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Automation
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Trigger Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Steps</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {automations.map((automation) => (
                    <TableRow key={automation.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/crm/automations/${automation.id}`}
                          aria-label={`Edit automation ${automation.name}`}
                          className="hover:underline"
                        >
                          {automation.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getTriggerTypeLabel(automation.trigger_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={automation.is_active}
                            onCheckedChange={(checked) => 
                              toggleAutomation(automation.id, checked)
                            }
                          />
                          <span className={automation.is_active ? "text-emerald-600" : "text-muted-foreground"}>
                            {automation.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(automation.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {Array.isArray(automation.workflow_steps) ? automation.workflow_steps.length : 0} steps
                        </Badge>
                      </TableCell>
                      <TableCell>
                          <Link
                            to={`/crm/automations/${automation.id}`}
                            aria-label={`Edit automation ${automation.name}`}
                            title="Edit"
                          >
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CRMAutomations;