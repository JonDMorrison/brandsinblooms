import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { useAskDialog } from "./useAskDialog";
import { bloomSupport, PRODUCT_LABEL, type KnowledgeArticle, type KnowledgeProduct, type KnowledgeWrite, type Whoami } from "@/lib/bloomSupport/api";

const emptyDraft = () => ({ title: "", body: "", product: "platform" as KnowledgeProduct, audience: "client" as "client" | "internal" });

export function KnowledgePanel({ me }: { me: Whoami }) {
  const queryClient = useQueryClient();
  const articles = useQuery({ queryKey: ["bloom-support", "knowledge"], queryFn: () => bloomSupport.knowledge() });
  const [editing, setEditing] = useState<KnowledgeArticle | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { ask, dialog } = useAskDialog();
  const canWrite = me.permissions.includes("tickets.write");
  const canApprove = me.role === "platform_operator" || me.permissions.includes("admin.policy");
  const save = useMutation({
    mutationFn: (article: KnowledgeWrite) => bloomSupport.saveKnowledge(article),
    onSuccess: () => {
      setEditing(null);
      setDraft(emptyDraft());
      setNotice("Article saved. Only approved customer articles are used for answers and shown in the help centre.");
      queryClient.invalidateQueries({ queryKey: ["bloom-support"] });
      queryClient.invalidateQueries({ queryKey: ["bloom-help"] });
    },
    onError: () => { queryClient.invalidateQueries({ queryKey: ["bloom-support", "knowledge"] }); },
  });
  const edit = (article: KnowledgeArticle) => {
    setEditing(article);
    setDraft({ title: article.title, body: article.body, product: article.product, audience: article.audience });
    setNotice(null);
    save.reset();
  };
  const changeApproval = async (article: KnowledgeArticle, approved: boolean) => {
    if (approved && !(await ask({ title: "Approve this answer?", description: `“${article.title}” will be used in replies to clients and shown in the public help centre.`, confirmLabel: "Approve" }))) return;
    save.mutate({ id: article.id, expected_updated_at: article.updated_at, approved });
  };
  const needle = search.trim().toLowerCase();
  const matches = (articles.data ?? []).filter((article) => `${article.title} ${article.body}`.toLowerCase().includes(needle));

  return (
    <Stack spacing={2}>
      {dialog}
      <div>
        <Typography level="title-lg">Approved answers</Typography>
        <Typography level="body-sm" textColor="text.secondary">Support can draft answers. Jon and Jeff approve customer articles. Internal notes and drafts stay private.</Typography>
      </div>
      {notice && <Alert color="success" variant="soft">{notice}</Alert>}
      {save.error && <Alert color="danger">{save.error.message}</Alert>}
      {articles.error && <Alert color="danger">{articles.error.message}</Alert>}
      {canWrite && (
        <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg" }}>
          <Stack component="form" spacing={1.5} onSubmit={(event) => {
            event.preventDefault();
            setNotice(null);
            save.mutate({ ...draft, ...(editing ? { id: editing.id, expected_updated_at: editing.updated_at } : {}), approved: false });
          }}>
            <Typography level="title-md">{editing ? "Edit article" : "Draft an answer"}</Typography>
            {editing?.approved && <Alert color="warning" variant="soft">Saving an edit withdraws approval until Jon or Jeff reviews it again.</Alert>}
            <FormControl required><FormLabel>Question or title</FormLabel><Input value={draft.title} slotProps={{ input: { maxLength: 200 } }} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></FormControl>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <FormControl sx={{ flex: 1 }}><FormLabel>Product</FormLabel><Select value={draft.product} onChange={(_, product) => product && setDraft({ ...draft, product })}>{(["platform", "crm", "cms", "pos"] as const).map((product) => <Option key={product} value={product}>{product === "platform" ? "All products" : PRODUCT_LABEL[product]}</Option>)}</Select></FormControl>
              <FormControl sx={{ flex: 1 }}><FormLabel>Audience</FormLabel><Select value={draft.audience} onChange={(_, audience) => audience && setDraft({ ...draft, audience })}><Option value="client">Customers</Option><Option value="internal">Internal staff only</Option></Select></FormControl>
            </Stack>
            <FormControl required><FormLabel>Answer</FormLabel><Textarea minRows={5} value={draft.body} slotProps={{ textarea: { maxLength: 20000 } }} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></FormControl>
            <Typography level="body-xs" textColor="text.tertiary">Use verified product instructions. Never include client-specific data, credentials, or private conversations.</Typography>
            <Stack direction="row" spacing={1}>
              <Button type="submit" loading={save.isPending} disabled={!draft.title.trim() || !draft.body.trim()}>Save draft</Button>
              {editing && <Button variant="plain" disabled={save.isPending} onClick={() => { setEditing(null); setDraft(emptyDraft()); save.reset(); }}>Cancel edit</Button>}
            </Stack>
          </Stack>
        </Sheet>
      )}
      <FormControl><FormLabel>Find an article</FormLabel><Input placeholder="Search questions and answers" value={search} onChange={(event) => setSearch(event.target.value)} /></FormControl>
      {articles.isLoading && <Skeleton variant="rectangular" height={100} />}
      {!articles.isLoading && !articles.error && matches.length === 0 && <Typography level="body-sm">{needle ? "No matching articles." : "No articles yet. Start with the questions clients ask most often."}</Typography>}
      {matches.map((article) => (
        <Sheet key={article.id} variant="outlined" sx={{ p: 2, borderRadius: "lg" }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography level="title-md">{article.title}</Typography>
              <Chip size="sm" color={article.approved && article.audience === "client" ? "success" : "neutral"}>{article.audience === "internal" ? "Internal only" : article.approved ? "Approved for customers" : "Draft"}</Chip>
              <Chip size="sm" variant="outlined">{PRODUCT_LABEL[article.product]}</Chip>
            </Stack>
            <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{article.body}</Typography>
            <Stack direction="row" spacing={1}>
              {canWrite && <Button size="sm" variant="outlined" disabled={save.isPending} onClick={() => edit(article)}>Edit</Button>}
              {canApprove && article.audience === "client" && <Button size="sm" variant="soft" color={article.approved ? "neutral" : "primary"} disabled={save.isPending || editing !== null} onClick={() => changeApproval(article, !article.approved)}>{article.approved ? "Withdraw approval" : "Approve for answers"}</Button>}
            </Stack>
          </Stack>
        </Sheet>
      ))}
    </Stack>
  );
}
