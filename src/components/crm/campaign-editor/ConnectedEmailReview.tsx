import React, {useRef, useState} from "react";
import {Alert, Box, Button, DialogActions, DialogContent, DialogTitle, Modal, ModalDialog, Stack, Typography} from "@mui/joy";
import {useMutation, useQuery} from "@tanstack/react-query";
import {useNavigate} from "react-router-dom";
import {loadConnectedEmailReview, replaceConnectedEmailDraft} from "@/lib/crm/connectedEmailReview";
import {renderDraftPreviewHtml} from "@/lib/crm/campaignDraftPersistence";

export function ConnectedEmailReview({tenantId, campaignId, reason}: {tenantId: string; campaignId: string; reason: string | null}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const busy = useRef(false);
  const query = useQuery({queryKey: ["connected-email-review", tenantId, campaignId], enabled: open,
    queryFn: () => loadConnectedEmailReview(tenantId, campaignId), staleTime: 0, retry: false});
  const replace = useMutation({mutationFn: async () => {
    if (!query.data) throw new Error("Open the website review first.");
    return replaceConnectedEmailDraft(tenantId, query.data);
  }, onSuccess: id => navigate(`/crm/campaigns/${id}`)});
  const review = query.data;
  const close = () => {if (!busy.current) setOpen(false);};
  const confirm = async () => {
    if (busy.current || !review || query.isFetching || query.error) return;
    busy.current = true;
    try {await replace.mutateAsync();} catch {/* Mutation feedback is displayed below. */}
    finally {busy.current = false;}
  };
  return <Stack spacing={1.5} sx={{width: "100%", textAlign: "left"}}>
    <Alert color="warning">{reason || "Website details changed. Review this newsletter before sending."}</Alert>
    <Button onClick={() => {replace.reset(); setOpen(true);}}>Review website changes</Button>
    <Modal open={open} onClose={close}>
      <ModalDialog sx={{width: "min(1100px, 96vw)", maxHeight: "92vh"}}>
        <DialogTitle>Review website changes</DialogTitle>
        <DialogContent>
          {query.isFetching && <Typography>Checking the current website details…</Typography>}
          {query.error && <Alert color="danger"><Stack><Typography>{query.error.message}</Typography><Typography level="body-sm">If the source was removed or unpublished, restore it on the website and check again, or start a new newsletter without that content. The original campaign stays paused.</Typography></Stack></Alert>}
          {review?.replacementId ? <Button onClick={() => navigate(`/crm/campaigns/${review.replacementId}`)}>Open reviewed draft</Button> : review && !query.isFetching && !query.error && <Stack spacing={2}>
            <Typography>Compare the saved newsletter with the refreshed draft. Website text, dates, images and links will be replaced; review any custom wording again in the editor.</Typography>
            {review.warnings.map(warning => <Alert color="warning" key={warning}>{warning}</Alert>)}
            <Box sx={{display: "grid", gridTemplateColumns: {xs: "1fr", md: "1fr 1fr"}, gap: 2}}>
              {[["Saved newsletter", review.original], ["Refreshed draft", review.refreshed]].map(([title, blocks]) => <Box key={String(title)}>
                <Typography level="title-md">{String(title)}</Typography>
                <Box component="iframe" title={String(title)} sandbox="" referrerPolicy="no-referrer"
                  srcDoc={renderDraftPreviewHtml(blocks as typeof review.original, review.campaign.subject_line || "", review.campaign.preheader_text || "")}
                  sx={{width: "100%", height: 420, border: "1px solid", borderColor: "divider", backgroundColor: "#fff"}} />
              </Box>)}
            </Box>
            <Typography level="body-sm">Create a new draft with no audience or send time. The original stays paused, its unsent queue is stopped, and delivery receipts are preserved. Choose recipients carefully to avoid contacting people who already received the original.</Typography>
          </Stack>}
          {replace.error && <Alert color="danger">{replace.error.message}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button variant="plain" disabled={replace.isPending} onClick={close}>Cancel</Button>
          {query.error && <Button variant="outlined" onClick={() => void query.refetch()}>Check again</Button>}
          {!review?.replacementId && <Button loading={replace.isPending} disabled={!review || query.isFetching || Boolean(query.error)} onClick={() => void confirm()}>Create reviewed draft</Button>}
        </DialogActions>
      </ModalDialog>
    </Modal>
  </Stack>;
}
