import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ShieldCheck } from "lucide-react";
import type { ResolvedApproval } from "@/components/bloom/utils/resolveApprovalData";

/**
 * The server-computed preview of an approval (for example a list import's
 * new / updated / skipped counts) and any statement the person agrees to by
 * approving, shown in full rather than truncated.
 */
export function ApprovalPreviewExtras({
  resolved,
  indent = 0,
}: {
  resolved: ResolvedApproval;
  indent?: number;
}) {
  const details = resolved.details ?? [];
  const notice = resolved.notice;
  if (details.length === 0 && !notice) {
    return null;
  }

  return (
    <Stack spacing={0.75} sx={{ mt: 0.75, pl: indent }}>
      {details.length > 0 ? (
        <Box
          component="dl"
          sx={{
            m: 0,
            display: "grid",
            gridTemplateColumns: "minmax(110px, max-content) 1fr",
            columnGap: 1.25,
            rowGap: 0.25,
          }}
        >
          {details.map((detail) => (
            <Box key={detail.label} sx={{ display: "contents" }}>
              <Typography
                component="dt"
                level="body-xs"
                sx={{ color: "text.tertiary" }}
              >
                {detail.label}
              </Typography>
              <Typography
                component="dd"
                level="body-xs"
                sx={{ m: 0, color: "text.primary", overflowWrap: "anywhere" }}
              >
                {detail.value}
              </Typography>
            </Box>
          ))}
        </Box>
      ) : null}

      {notice ? (
        <Sheet
          color="warning"
          variant="soft"
          sx={{ borderRadius: "sm", px: 1, py: 0.75 }}
        >
          <Stack direction="row" spacing={0.75} alignItems="flex-start">
            <ShieldCheck
              size={14}
              aria-hidden
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography level="body-xs" sx={{ fontWeight: 700 }}>
                {notice.title}
              </Typography>
              <Typography level="body-xs" sx={{ overflowWrap: "anywhere" }}>
                {notice.body}
              </Typography>
              {notice.detail ? (
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                  {notice.detail}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        </Sheet>
      ) : null}
    </Stack>
  );
}
