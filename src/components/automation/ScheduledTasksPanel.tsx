import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Clock, 
  Mail, 
  MessageSquare, 
  MoreHorizontal, 
  Pause, 
  Play, 
  X,
  Calendar,
  Users,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  useScheduledAutomationTasks,
  useAutomationRuns,
  useCancelScheduledTask,
  usePauseAutomationRun,
  useScheduledTaskStats,
  type ScheduledTask,
  type AutomationRun,
} from "@/hooks/useScheduledAutomationTasks";

export function ScheduledTasksPanel() {
  const [activeTab, setActiveTab] = useState("pending");

  const { data: pendingTasks, isLoading: loadingTasks } = useScheduledAutomationTasks({ status: "pending" });
  const { data: activeRuns, isLoading: loadingRuns } = useAutomationRuns({ status: "active" });
  const { data: stats } = useScheduledTaskStats();

  const cancelTask = useCancelScheduledTask();
  const pauseRun = usePauseAutomationRun();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduled Automation Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats?.pendingMessages || 0}</div>
            <div className="text-sm text-muted-foreground">Pending Messages</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats?.activeRuns || 0}</div>
            <div className="text-sm text-muted-foreground">Active Runs</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats?.completedToday || 0}</div>
            <div className="text-sm text-muted-foreground">Completed Today</div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Messages
            </TabsTrigger>
            <TabsTrigger value="runs" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Runs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {loadingTasks ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingTasks && pendingTasks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Automation</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTasks.map((task) => (
                    <ScheduledTaskRow
                      key={task.id}
                      task={task}
                      onCancel={() => cancelTask.mutate(task.id)}
                      isCancelling={cancelTask.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No pending messages</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="runs" className="mt-4">
            {loadingRuns ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeRuns && activeRuns.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Automation</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Next Step</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRuns.map((run) => (
                    <AutomationRunRow
                      key={run.id}
                      run={run}
                      onPause={() => pauseRun.mutate({ runId: run.id, action: "pause" })}
                      onResume={() => pauseRun.mutate({ runId: run.id, action: "resume" })}
                      onCancel={() => pauseRun.mutate({ runId: run.id, action: "cancel" })}
                      isUpdating={pauseRun.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No active automation runs</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface ScheduledTaskRowProps {
  task: ScheduledTask;
  onCancel: () => void;
  isCancelling: boolean;
}

function ScheduledTaskRow({ task, onCancel, isCancelling }: ScheduledTaskRowProps) {
  const scheduledDate = new Date(task.scheduled_at);
  const isOverdue = scheduledDate < new Date();

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {task.message_type === "email" ? (
            <Mail className="h-4 w-4 text-blue-500" />
          ) : (
            <MessageSquare className="h-4 w-4 text-green-500" />
          )}
          <span className="capitalize">{task.message_type}</span>
        </div>
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{task.customer_name || "Unknown"}</div>
          <div className="text-sm text-muted-foreground">{task.recipient}</div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm">{task.automation_name || "—"}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Clock className={`h-3 w-3 ${isOverdue ? "text-amber-500" : "text-muted-foreground"}`} />
          <span className={`text-sm ${isOverdue ? "text-amber-600 font-medium" : ""}`}>
            {isOverdue ? "Overdue" : formatDistanceToNow(scheduledDate, { addSuffix: true })}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {format(scheduledDate, "MMM d, h:mm a")}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">Step {task.step_index + 1}</Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isCancelling}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCancel} className="text-destructive">
              <X className="h-4 w-4 mr-2" />
              Cancel Message
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

interface AutomationRunRowProps {
  run: AutomationRun;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  isUpdating: boolean;
}

function AutomationRunRow({ run, onPause, onResume, onCancel, isUpdating }: AutomationRunRowProps) {
  const progress = run.total_steps > 0 
    ? Math.round((run.current_step_index / run.total_steps) * 100) 
    : 0;

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    paused: "bg-amber-100 text-amber-800",
    completed: "bg-blue-100 text-blue-800",
    cancelled: "bg-gray-100 text-gray-800",
    failed: "bg-red-100 text-red-800",
  };

  return (
    <TableRow>
      <TableCell>
        <div>
          <div className="font-medium">{run.customer_name || "Unknown"}</div>
          <div className="text-sm text-muted-foreground">{run.customer_email}</div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm">{run.automation_name || "—"}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {run.current_step_index}/{run.total_steps}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {run.next_step_scheduled_at ? (
          <div>
            <div className="text-sm">
              {formatDistanceToNow(new Date(run.next_step_scheduled_at), { addSuffix: true })}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(run.next_step_scheduled_at), "MMM d, h:mm a")}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge className={statusColors[run.status] || "bg-gray-100"}>
          {run.status}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isUpdating}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {run.status === "active" && (
              <DropdownMenuItem onClick={onPause}>
                <Pause className="h-4 w-4 mr-2" />
                Pause Run
              </DropdownMenuItem>
            )}
            {run.status === "paused" && (
              <DropdownMenuItem onClick={onResume}>
                <Play className="h-4 w-4 mr-2" />
                Resume Run
              </DropdownMenuItem>
            )}
            {(run.status === "active" || run.status === "paused") && (
              <DropdownMenuItem onClick={onCancel} className="text-destructive">
                <X className="h-4 w-4 mr-2" />
                Cancel Run
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
