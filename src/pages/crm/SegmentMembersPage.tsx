import { useState } from "react";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, PencilLine } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { SegmentStatusBadge } from "@/components/crm/segments/SegmentStatusBadge";
import { SegmentTypeBadge } from "@/components/crm/segments/SegmentTypeBadge";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyPageHeaderBand } from "@/components/joy/JoyPageHeaderBand";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTablePagination,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { useSegment } from "@/hooks/useSegment";
import { useSegmentMembers } from "@/hooks/useSegmentMembers";

export default function SegmentMembersPage() {
  const navigate = useNavigate();
  const { segmentId } = useParams<{ segmentId: string }>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const segmentQuery = useSegment(segmentId);
  const membersQuery = useSegmentMembers(segmentId, { page, pageSize, search });

  if (!segmentQuery.isLoading && !segmentQuery.data) {
    return (
      <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <JoyCard>
          <JoyCardHeader
            description="The segment could not be found."
            title="Members unavailable"
          />
          <JoyCardContent sx={{ pt: 3 }}>
            <JoyButton onClick={() => navigate("/crm/segments")}>
              Back to segments
            </JoyButton>
          </JoyCardContent>
        </JoyCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      fullWidth
      sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}
    >
      <Stack spacing={3}>
        <JoyPageHeaderBand
          actions={
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              useFlexGap
            >
              <JoyButton
                bloomVariant="ghost"
                onClick={() => navigate("/crm/segments")}
                startDecorator={<ArrowLeft size={16} />}
              >
                Back
              </JoyButton>
              {segmentId ? (
                <JoyButton
                  onClick={() => navigate(`/crm/segments/${segmentId}`)}
                  startDecorator={<PencilLine size={16} />}
                >
                  Edit segment
                </JoyButton>
              ) : null}
            </Stack>
          }
          description="Inspect the members currently attached to this audience definition."
          metadata={
            segmentQuery.data ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <SegmentTypeBadge type={segmentQuery.data.type} />
                <SegmentStatusBadge status={segmentQuery.data.status} />
                <Chip size="sm" variant="outlined">
                  {segmentQuery.data.memberCount.toLocaleString()} members
                </Chip>
              </Stack>
            ) : null
          }
          title={
            segmentQuery.data
              ? `${segmentQuery.data.name} members`
              : "Segment members"
          }
        />

        <JoyCard>
          <JoyCardContent sx={{ pt: 4 }}>
            <JoySearchInput
              appearance="page"
              debounceMs={250}
              onDebouncedChange={(nextValue) => {
                setSearch(nextValue);
                setPage(1);
              }}
              placeholder="Search members"
              value={search}
            />
          </JoyCardContent>
        </JoyCard>

        {membersQuery.totalCount === 0 ? (
          <JoyCard>
            <JoyCardHeader
              description={
                segmentQuery.data?.type === "dynamic"
                  ? "This dynamic segment does not currently match any customers."
                  : "No customers have been manually added to this static segment yet."
              }
              title="No members yet"
            />
          </JoyCard>
        ) : (
          <JoyCard>
            <JoyCardContent sx={{ pt: 0 }}>
              <JoyTable stickyHeader>
                <JoyTableHead>
                  <JoyTableRow>
                    <JoyTableHeaderCell>Customer</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Lifecycle</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Preferred channel</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Added</JoyTableHeaderCell>
                  </JoyTableRow>
                </JoyTableHead>
                <JoyTableBody>
                  {membersQuery.members.map((member) => (
                    <JoyTableRow
                      clickable
                      key={member.membershipId}
                      onClick={() =>
                        navigate(`/crm/customers/${member.customerId}`)
                      }
                    >
                      <JoyTableCell>
                        <Stack spacing={0.25}>
                          <Typography level="body-sm">{member.name}</Typography>
                          <Typography level="body-xs" color="neutral">
                            {member.email}
                          </Typography>
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell>{member.lifecycleStage}</JoyTableCell>
                      <JoyTableCell>
                        {member.preferredChannel || "none"}
                      </JoyTableCell>
                      <JoyTableCell>
                        {formatDistanceToNow(new Date(member.addedAt), {
                          addSuffix: true,
                        })}
                      </JoyTableCell>
                    </JoyTableRow>
                  ))}
                </JoyTableBody>
              </JoyTable>
              <JoyTablePagination
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
                page={page}
                pageSize={pageSize}
                totalCount={membersQuery.totalCount}
              />
            </JoyCardContent>
          </JoyCard>
        )}
      </Stack>
    </PageContainer>
  );
}
