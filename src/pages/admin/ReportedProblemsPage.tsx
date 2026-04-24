import { useEffect, useMemo, useState } from "react";
import CircularProgress from "@mui/joy/CircularProgress";
import Grid from "@mui/joy/Grid";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Navigate, useNavigate } from "react-router-dom";
import { useReportedProblems } from "@/hooks/reportProblem/useReportedProblems";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoyStatCard } from "@/components/joy/JoyStatCard";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTablePagination,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { ProblemPriorityBadge } from "@/components/reportProblem/ProblemPriorityBadge";
import { ProblemStatusBadge } from "@/components/reportProblem/ProblemStatusBadge";
import {
  AlertTriangle,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ReportedProblemsPage = () => {
  const navigate = useNavigate();
  const { data: isSuperAdmin, isLoading: adminLoading } = useIsSuperAdmin();
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchUrl, setSearchUrl] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const {
    data: problems,
    isLoading,
    error,
    refetch,
  } = useReportedProblems({
    status: statusFilter || undefined,
    url: searchUrl || undefined,
  });

  const activeFilterCount =
    Number(Boolean(statusFilter)) + Number(Boolean(searchUrl));
  const totalProblems = problems?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProblems / pageSize));

  const statusCounts = useMemo(
    () =>
      (problems ?? []).reduce(
        (accumulator, problem) => {
          accumulator[problem.status] += 1;
          if (problem.priority === "urgent") {
            accumulator.urgent += 1;
          }
          return accumulator;
        },
        {
          open: 0,
          investigating: 0,
          resolved: 0,
          closed: 0,
          urgent: 0,
        },
      ),
    [problems],
  );

  const pagedProblems = useMemo(() => {
    const offset = (page - 1) * pageSize;
    return (problems ?? []).slice(offset, offset + pageSize);
  }, [page, pageSize, problems]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchUrl]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const clearFilters = () => {
    setStatusFilter("");
    setSearchInput("");
    setSearchUrl("");
    setPage(1);
  };

  if (adminLoading) {
    return (
      <PageContainer fullWidth sx={{ px: 0, py: 0 }}>
        <Stack
          minHeight="40vh"
          alignItems="center"
          justifyContent="center"
          spacing={2}
        >
          <CircularProgress size="md" />
          <Typography level="body-sm" color="neutral">
            Loading reported problems...
          </Typography>
        </Stack>
      </PageContainer>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <PageContainer fullWidth sx={{ px: 0, py: 0 }}>
      <Stack spacing={3}>
        <JoyCard
          sx={{
            borderColor: "warning.200",
            background:
              "linear-gradient(135deg, rgba(var(--joy-palette-warning-mainChannel) / 0.14) 0%, #FFFFFF 58%, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 100%)",
          }}
        >
          <JoyCardContent sx={{ pt: 3 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              alignItems={{ xs: "flex-start", md: "center" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Sheet
                  variant="soft"
                  color="warning"
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle className="h-6 w-6" />
                </Sheet>
                <Stack spacing={0.75}>
                  <Typography level="h2">Reported Problems</Typography>
                  <Typography level="body-sm" color="neutral">
                    Review user-reported issues, track investigation progress,
                    and open detailed problem reports from a single Joy-composed
                    queue.
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <JoyStatusChip
                      status={activeFilterCount > 0 ? "filtered" : "all"}
                      tone={activeFilterCount > 0 ? "info" : "neutral"}
                      label={
                        activeFilterCount > 0
                          ? `${activeFilterCount} active filters`
                          : "All problems"
                      }
                    />
                    <JoyStatusChip
                      status="queue"
                      tone="warning"
                      label={`${totalProblems} matched reports`}
                    />
                  </Stack>
                </Stack>
              </Stack>

              <JoyButton
                bloomVariant="outline"
                onClick={() => void refetch()}
                disabled={isLoading}
                loading={isLoading}
                loadingPosition="start"
                startDecorator={<RefreshCw className="h-4 w-4" />}
              >
                Refresh
              </JoyButton>
            </Stack>
          </JoyCardContent>
        </JoyCard>

        <Grid container spacing={2}>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<AlertTriangle size={20} />}
              iconColor="warning"
              label="Total reports"
              value={totalProblems}
            />
          </Grid>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<Search size={20} />}
              iconColor="primary"
              label="Open"
              value={statusCounts.open}
            />
          </Grid>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<ShieldAlert size={20} />}
              iconColor="info"
              label="Investigating"
              value={statusCounts.investigating}
            />
          </Grid>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<AlertTriangle size={20} />}
              iconColor="danger"
              label="Urgent priority"
              value={statusCounts.urgent}
            />
          </Grid>
        </Grid>

        <JoyCard>
          <JoyCardHeader
            title="Filters"
            description="Filter by status or URL fragment. Pagination stays client-side on the current result set."
          />
          <JoyCardContent>
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid xs={12} md={4}>
                  <JoySelect
                    label="Status"
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    options={[
                      { value: "", label: "All statuses" },
                      { value: "open", label: "Open" },
                      { value: "investigating", label: "Investigating" },
                      { value: "resolved", label: "Resolved" },
                      { value: "closed", label: "Closed" },
                    ]}
                  />
                </Grid>

                <Grid xs={12} md={8}>
                  <JoySearchInput
                    label="Search URL"
                    placeholder="Filter by captured URL..."
                    value={searchInput}
                    onValueChange={setSearchInput}
                    onDebouncedChange={(value) => setSearchUrl(value)}
                    debounceMs={350}
                  />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <JoyButton
                  bloomVariant="ghost"
                  onClick={clearFilters}
                  disabled={activeFilterCount === 0}
                >
                  Clear Filters
                </JoyButton>
              </Stack>
            </Stack>
          </JoyCardContent>
        </JoyCard>

        {error ? (
          <JoyCard variant="soft" color="danger">
            <JoyCardContent sx={{ pt: 3 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <AlertTriangle className="h-5 w-5" />
                  <Stack spacing={0.35}>
                    <Typography level="title-sm" color="danger">
                      Failed to load reported problems
                    </Typography>
                    <Typography level="body-sm" color="danger">
                      {error instanceof Error
                        ? error.message
                        : "Unknown error while loading problems."}
                    </Typography>
                  </Stack>
                </Stack>
                <JoyButton
                  bloomVariant="outline"
                  color="danger"
                  onClick={() => void refetch()}
                >
                  Retry
                </JoyButton>
              </Stack>
            </JoyCardContent>
          </JoyCard>
        ) : null}

        <JoyCard>
          <JoyCardHeader
            title="Problem Queue"
            description={`Showing ${pagedProblems.length} problems on page ${page} out of ${totalProblems} matched reports.`}
          />
          <JoyCardContent>
            {isLoading ? (
              <Sheet
                variant="outlined"
                sx={{ borderRadius: "var(--joy-radius-lg)" }}
              >
                <JoyTable containerSx={{ minWidth: 960 }}>
                  <JoyTableHead>
                    <JoyTableRow>
                      <JoyTableHeaderCell>Title</JoyTableHeaderCell>
                      <JoyTableHeaderCell>User</JoyTableHeaderCell>
                      <JoyTableHeaderCell>URL</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Status</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Priority</JoyTableHeaderCell>
                      <JoyTableHeaderCell>Created</JoyTableHeaderCell>
                      <JoyTableHeaderCell align="right">
                        Actions
                      </JoyTableHeaderCell>
                    </JoyTableRow>
                  </JoyTableHead>
                  <JoyTableBody>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <JoyTableRow key={index}>
                        {Array.from({ length: 7 }).map((__, cellIndex) => (
                          <JoyTableCell key={cellIndex}>
                            <Skeleton sx={{ height: 20, width: "100%" }} />
                          </JoyTableCell>
                        ))}
                      </JoyTableRow>
                    ))}
                  </JoyTableBody>
                </JoyTable>
              </Sheet>
            ) : totalProblems === 0 ? (
              <Stack spacing={0.75} alignItems="center" sx={{ py: 5 }}>
                <AlertTriangle
                  className="h-5 w-5"
                  style={{ color: "var(--joy-palette-neutral-400)" }}
                />
                <Typography level="title-sm">No problems found</Typography>
                <Typography level="body-sm" color="neutral" textAlign="center">
                  Try a different status or URL filter to broaden the results.
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Sheet
                  variant="outlined"
                  sx={{ borderRadius: "var(--joy-radius-lg)" }}
                >
                  <JoyTable containerSx={{ minWidth: 960 }}>
                    <JoyTableHead>
                      <JoyTableRow>
                        <JoyTableHeaderCell>Title</JoyTableHeaderCell>
                        <JoyTableHeaderCell>User</JoyTableHeaderCell>
                        <JoyTableHeaderCell>URL</JoyTableHeaderCell>
                        <JoyTableHeaderCell>Status</JoyTableHeaderCell>
                        <JoyTableHeaderCell>Priority</JoyTableHeaderCell>
                        <JoyTableHeaderCell>Created</JoyTableHeaderCell>
                        <JoyTableHeaderCell align="right">
                          Actions
                        </JoyTableHeaderCell>
                      </JoyTableRow>
                    </JoyTableHead>
                    <JoyTableBody>
                      {pagedProblems.map((problem) => (
                        <JoyTableRow key={problem.id}>
                          <JoyTableCell
                            sx={{
                              maxWidth: 280,
                              fontWeight: "var(--joy-fontWeight-md)",
                            }}
                          >
                            <Link
                              component="button"
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/admin/reported-problems/${problem.id}`,
                                )
                              }
                              sx={{
                                color: "primary.700",
                                fontWeight: "inherit",
                                textDecoration: "none",
                                textAlign: "left",
                                "&:hover": {
                                  textDecoration: "underline",
                                },
                              }}
                            >
                              <Typography noWrap>{problem.title}</Typography>
                            </Link>
                          </JoyTableCell>
                          <JoyTableCell sx={{ whiteSpace: "nowrap" }}>
                            {problem.user_email}
                          </JoyTableCell>
                          <JoyTableCell sx={{ maxWidth: 280 }}>
                            <Link
                              href={problem.captured_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                color: "primary.700",
                                textDecoration: "none",
                                "&:hover": {
                                  textDecoration: "underline",
                                },
                              }}
                            >
                              <Typography level="body-sm" noWrap>
                                {problem.captured_url}
                              </Typography>
                            </Link>
                          </JoyTableCell>
                          <JoyTableCell>
                            <ProblemStatusBadge status={problem.status} />
                          </JoyTableCell>
                          <JoyTableCell>
                            <ProblemPriorityBadge priority={problem.priority} />
                          </JoyTableCell>
                          <JoyTableCell sx={{ whiteSpace: "nowrap" }}>
                            {formatDistanceToNow(new Date(problem.created_at), {
                              addSuffix: true,
                            })}
                          </JoyTableCell>
                          <JoyTableCell sx={{ textAlign: "right" }}>
                            <JoyDropdownMenu>
                              <JoyDropdownMenuTrigger
                                aria-label={`Actions for ${problem.title}`}
                                iconButtonSx={{
                                  width: 32,
                                  height: 32,
                                  ml: "auto",
                                }}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </JoyDropdownMenuTrigger>
                              <JoyDropdownMenuContent placement="bottom-end">
                                <JoyDropdownMenuItem
                                  startDecorator={<Eye className="h-4 w-4" />}
                                  onClick={() =>
                                    navigate(
                                      `/admin/reported-problems/${problem.id}`,
                                    )
                                  }
                                >
                                  View details
                                </JoyDropdownMenuItem>
                              </JoyDropdownMenuContent>
                            </JoyDropdownMenu>
                          </JoyTableCell>
                        </JoyTableRow>
                      ))}
                    </JoyTableBody>
                  </JoyTable>
                </Sheet>

                <JoyTablePagination
                  page={page}
                  pageSize={pageSize}
                  totalCount={totalProblems}
                  onPageChange={setPage}
                  onPageSizeChange={(nextPageSize) => {
                    setPageSize(nextPageSize);
                    setPage(1);
                  }}
                />
              </Stack>
            )}
          </JoyCardContent>
        </JoyCard>
      </Stack>
    </PageContainer>
  );
};

export default ReportedProblemsPage;
