import React, { useState } from "react";
import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useParams, useNavigate } from "react-router-dom";
import { useProblemDetail } from "@/hooks/reportProblem/useProblemDetail";
import { useUpdateProblem } from "@/hooks/reportProblem/useUpdateProblem";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyTextarea as Textarea } from "@/components/joy/JoyTextarea";
import { JoySelect } from "@/components/joy/JoySelect";
import { ProblemStatusBadge } from "@/components/reportProblem/ProblemStatusBadge";
import { ProblemPriorityBadge } from "@/components/reportProblem/ProblemPriorityBadge";
import { ArrowLeft, Download, FileIcon } from "lucide-react";
import { format } from "date-fns";
import { ProblemStatus, ProblemPriority } from "@/types/reportedProblems";

const ReportedProblemDetailPage: React.FC = () => {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const { data: problem, isLoading } = useProblemDetail(problemId);
  const updateProblem = useUpdateProblem();

  const [adminNotes, setAdminNotes] = useState("");

  if (!isSuperAdmin) {
    return (
      <PageContainer>
        <JoyCard>
          <JoyCardHeader
            title="Access Denied"
            description="You don't have permission to view this page."
          />
        </JoyCard>
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Typography
          level="body-sm"
          color="neutral"
          textAlign="center"
          sx={{ py: 4 }}
        >
          Loading problem details...
        </Typography>
      </PageContainer>
    );
  }

  if (!problem) {
    return (
      <PageContainer>
        <JoyCard>
          <JoyCardHeader
            title="Problem Not Found"
            description="The problem you're looking for doesn't exist."
          />
        </JoyCard>
      </PageContainer>
    );
  }

  const handleStatusChange = (value: string) => {
    updateProblem.mutate({
      problemId: problem.id,
      status: value as ProblemStatus,
    });
  };

  const handlePriorityChange = (value: string) => {
    updateProblem.mutate({
      problemId: problem.id,
      priority: value as ProblemPriority,
    });
  };

  const handleSaveNotes = () => {
    updateProblem.mutate({ problemId: problem.id, admin_notes: adminNotes });
  };

  const downloadAttachment = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage
      .from("problem-attachments")
      .download(filePath);

    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <PageContainer fullWidth>
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} alignItems="center">
          <JoyButton
            aria-label="Go back"
            bloomVariant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </JoyButton>
          <Stack spacing={0.5}>
            <Typography level="h2">{problem.title}</Typography>
            <Typography level="body-sm" color="neutral">
              Reported by {problem.user_email} on{" "}
              {format(new Date(problem.created_at), "PPp")}
            </Typography>
          </Stack>
        </Stack>

        <JoyCard>
          <JoyCardHeader title="Status & Priority" />
          <JoyCardContent>
            <Grid container spacing={2}>
              <Grid xs={12} md={6}>
                <JoySelect
                  label="Status"
                  value={problem.status}
                  onValueChange={handleStatusChange}
                  options={[
                    { value: "open", label: "Open" },
                    { value: "investigating", label: "Investigating" },
                    { value: "resolved", label: "Resolved" },
                    { value: "closed", label: "Closed" },
                  ]}
                />
              </Grid>

              <Grid xs={12} md={6}>
                <JoySelect
                  label="Priority"
                  value={problem.priority}
                  onValueChange={handlePriorityChange}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                    { value: "urgent", label: "Urgent" },
                  ]}
                />
              </Grid>
            </Grid>
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader title="Problem Description" />
          <JoyCardContent>
            <Typography level="body-md" sx={{ whiteSpace: "pre-wrap" }}>
              {problem.description}
            </Typography>
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader title="Captured Context" />
          <JoyCardContent>
            <Stack spacing={1.5}>
              <div>
                <strong className="text-sm">URL:</strong>
                <p className="text-sm text-muted-foreground break-all">
                  <a
                    href={problem.captured_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {problem.captured_url}
                  </a>
                </p>
              </div>
              {problem.viewport_size ? (
                <div>
                  <strong className="text-sm">Viewport:</strong>
                  <p className="text-sm text-muted-foreground">
                    {problem.viewport_size}
                  </p>
                </div>
              ) : null}
              {problem.user_agent ? (
                <div>
                  <strong className="text-sm">User Agent:</strong>
                  <p className="text-sm text-muted-foreground break-all">
                    {problem.user_agent}
                  </p>
                </div>
              ) : null}
              {problem.browser_info ? (
                <div>
                  <strong className="text-sm">Browser Info:</strong>
                  <pre className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">
                    {JSON.stringify(problem.browser_info, null, 2)}
                  </pre>
                </div>
              ) : null}
            </Stack>
          </JoyCardContent>
        </JoyCard>

        {problem.attachments && problem.attachments.length > 0 ? (
          <JoyCard>
            <JoyCardHeader title="Attachments" />
            <JoyCardContent>
              <Stack spacing={1.5}>
                {problem.attachments.map((attachment) => (
                  <Sheet
                    key={attachment.id}
                    variant="soft"
                    color="neutral"
                    sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FileIcon className="h-4 w-4" />
                        <div>
                          <p className="text-sm font-medium">
                            {attachment.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(attachment.file_size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </Stack>
                      <JoyButton
                        bloomVariant="ghost"
                        size="sm"
                        onClick={() =>
                          downloadAttachment(
                            attachment.file_path,
                            attachment.file_name,
                          )
                        }
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </JoyButton>
                    </Stack>
                  </Sheet>
                ))}
              </Stack>
            </JoyCardContent>
          </JoyCard>
        ) : null}

        <JoyCard>
          <JoyCardHeader
            title="Admin Notes"
            description="Internal notes about this problem (not visible to the user)"
          />
          <JoyCardContent>
            <Stack spacing={2}>
              <Textarea
                placeholder="Add notes about investigation, resolution, etc..."
                rows={5}
                value={adminNotes || problem.admin_notes || ""}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
              <JoyButton
                onClick={handleSaveNotes}
                disabled={updateProblem.isPending}
              >
                {updateProblem.isPending ? "Saving..." : "Save Notes"}
              </JoyButton>
            </Stack>
          </JoyCardContent>
        </JoyCard>
      </Stack>
    </PageContainer>
  );
};

export default ReportedProblemDetailPage;
