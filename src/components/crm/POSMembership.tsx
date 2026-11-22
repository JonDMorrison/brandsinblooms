import React, {useState} from "react";
import {Alert, Button, Card, Checkbox, FormControl, FormLabel, Input, Option, Select, Stack, Textarea, Typography} from "@mui/joy";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useTenant} from "@/hooks/useTenant";
import {latestMembershipPolicies, loadMembershipWorkspace, reviewMembershipRequest, saveMembershipPolicy, validateMembershipPolicy, type MembershipPolicy, type MembershipPolicyInput, type MembershipRequest, type MembershipWorkspace} from "@/lib/crm/posMembership";

const blankPolicy: MembershipPolicyInput = {keyId: "", storeId: "", programmeVersionId: "", expectedVersion: null, authority: "", termsVersion: "", terms: "", emailStatement: "", smsStatement: "", enabled: false};
function PolicyEditor({workspace, onSaved}: {workspace: MembershipWorkspace; onSaved: () => Promise<unknown>}) {
  const [draft, setDraft] = useState<MembershipPolicyInput>({...blankPolicy});
  const [saved, setSaved] = useState(false);
  const latest = latestMembershipPolicies(workspace.policies);
  const save = useMutation({mutationFn: async () => {
    const current = latest.find(policy => policy.key_id === draft.keyId && policy.store_id === draft.storeId);
    if ((current?.version ?? null) !== draft.expectedVersion) throw new Error("Load the current store policy before saving a new version.");
    await saveMembershipPolicy(draft);
  }, onSuccess: async () => {setSaved(true); setDraft({...blankPolicy}); await onSaved();}});
  const change = <K extends keyof MembershipPolicyInput>(key: K, value: MembershipPolicyInput[K]) => {setSaved(false); setDraft(previous => ({...previous, [key]: value}));};
  const edit = (policy: MembershipPolicy) => {save.reset(); setSaved(false); setDraft({keyId: policy.key_id, storeId: policy.store_id, programmeVersionId: policy.programme_version_id, expectedVersion: policy.version, authority: policy.authority, termsVersion: policy.terms_version, terms: policy.terms, emailStatement: policy.email_statement, smsStatement: policy.sms_statement, enabled: policy.enabled});};
  return <Stack spacing={2}>
    <Typography level="title-md">Checkout membership policy</Typography>
    <Typography level="body-sm">Use the saved programme and the terms customers will actually see. Membership, email and text choices remain separate. Provider membership waits for provider confirmation; saving this policy does not activate rewards.</Typography>
    {latest.map(policy => <Stack key={policy.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      <Typography level="body-sm">Store {policy.store_id} · Version {policy.version} · {policy.enabled ? "Enabled" : "Disabled"} · {policy.authority === "PROVIDER" ? "Provider confirms membership" : "BloomSuite confirms membership"}</Typography>
      <Button size="sm" variant="outlined" disabled={save.isPending} onClick={() => edit(policy)}>Edit policy</Button>
    </Stack>)}
    {(!workspace.connections.length || !workspace.programmes.length) ? <Alert color="neutral">Connect a POS and save an eligible loyalty programme before configuring checkout membership.</Alert> : <>
      <FormControl><FormLabel>Connected POS</FormLabel><Select value={draft.keyId || null} disabled={save.isPending || draft.expectedVersion !== null} onChange={(_, value) => change("keyId", value || "")} placeholder="Choose a POS connection">{workspace.connections.map(connection => <Option key={connection.keyId} value={connection.keyId}>POS {connection.posTenantId}</Option>)}</Select></FormControl>
      <FormControl><FormLabel>POS store ID</FormLabel><Input value={draft.storeId} disabled={save.isPending || draft.expectedVersion !== null} onChange={event => change("storeId", event.target.value.trim())} placeholder="Store ID from your POS settings" /></FormControl>
      <FormControl><FormLabel>Saved programme</FormLabel><Select value={draft.programmeVersionId || null} disabled={save.isPending} onChange={(_, value) => change("programmeVersionId", value || "")} placeholder="Choose a saved programme">{workspace.programmes.map(programme => <Option key={programme.versionId} value={programme.versionId}>{programme.name}</Option>)}</Select></FormControl>
      <FormControl><FormLabel>Membership confirmation</FormLabel><Select value={draft.authority || null} placeholder="Choose who confirms membership" disabled={save.isPending} onChange={(_, value) => value && change("authority", value)}><Option value="NATIVE">BloomSuite</Option><Option value="PROVIDER">Existing loyalty provider</Option></Select></FormControl>
      <FormControl><FormLabel>Terms version</FormLabel><Input value={draft.termsVersion} disabled={save.isPending} onChange={event => change("termsVersion", event.target.value)} slotProps={{input: {maxLength: 120}}} /></FormControl>
      {[["terms", "Membership terms", 12000], ["emailStatement", "Email marketing statement", 2000], ["smsStatement", "Text marketing statement", 2000]].map(([key, label, max]) => <FormControl key={String(key)}><FormLabel>{String(label)}</FormLabel><Textarea minRows={3} value={draft[key as "terms" | "emailStatement" | "smsStatement"]} disabled={save.isPending} onChange={event => change(key as "terms" | "emailStatement" | "smsStatement", event.target.value)} slotProps={{textarea: {maxLength: Number(max)}}} /></FormControl>)}
      <Checkbox label="Enable this policy at the selected POS store" checked={draft.enabled} disabled={save.isPending} onChange={event => change("enabled", event.target.checked)} />
      {draft.enabled && <Alert color="warning">Saving publishes these terms and independent choices to this store's checkout.</Alert>}
      {save.error && <Alert color="danger">{save.error.message}</Alert>}
      <Stack direction="row" spacing={1}><Button loading={save.isPending} disabled={Boolean(validateMembershipPolicy(draft))} onClick={() => save.mutate()}>Save policy version</Button><Button variant="plain" disabled={save.isPending} onClick={() => {setDraft({...blankPolicy}); save.reset();}}>New store policy</Button></Stack>
    </>}
    {saved && <Alert color="success">Policy version saved.</Alert>}
  </Stack>;
}
function RequestReview({request, policy, tenantId, onSaved}: {request: MembershipRequest; policy?: MembershipPolicy; tenantId: string; onSaved: () => Promise<unknown>}) {
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const mutation = useMutation({mutationFn: (reject: boolean) => reviewMembershipRequest(tenantId, request.id, reject, reason), onSuccess: async () => {setReason(""); setChecked(false); await onSaved();}});
  const purchaseOnly = request.state === "CONFIRMED" && request.purchase_result !== "linked";
  const pending = purchaseOnly || request.state === "REVIEW_REQUIRED" || request.state === "PROVIDER_PENDING";
  const evidence = request.evidence;
  return <Card variant="outlined"><Stack spacing={1.25}>
    <Typography level="title-sm">{[evidence.firstName, evidence.lastName].filter(Boolean).join(" ") || evidence.email || evidence.phone || "Membership request"}</Typography>
    <Typography level="body-sm">{request.state.replaceAll("_", " ")} · {new Date(request.observed_at).toLocaleString()}</Typography>
    <Typography level="body-sm">{[evidence.email, evidence.phone].filter(Boolean).join(" · ")} · Store {request.store_id}</Typography>
    <Typography level="body-sm">Membership agreed: {evidence.membershipAgreed ? "Yes" : "No"} · Terms {evidence.termsVersion || "unavailable"}</Typography>
    <Typography level="body-sm">Purchase link: {request.purchase_result?.replaceAll("_", " ") || "Pending"}</Typography>
    <Typography level="body-sm">Email choice: {evidence.emailConsent ? "Requested" : "Not requested"} — {request.email_result.replaceAll("_", " ")}</Typography>
    <Typography level="body-sm">Text choice: {evidence.smsConsent ? "Requested" : "Not requested"} — {request.sms_result.replaceAll("_", " ")}</Typography>
    {policy && <details><summary>Captured policy and separate statements</summary><Typography sx={{whiteSpace: "pre-wrap"}}>{policy.terms}</Typography><Typography sx={{whiteSpace: "pre-wrap"}}>Email: {policy.email_statement}</Typography><Typography sx={{whiteSpace: "pre-wrap"}}>Text: {policy.sms_statement}</Typography></details>}
    {request.customer_id && <Typography level="body-sm">Linked contact: {request.customer_id}</Typography>}
    <Typography level="body-sm">Identity match: {String(request.identity_result.match_method || "Needs review")}{request.identity_result.conflict_id ? " · Conflict requires resolution in the customer record" : ""}</Typography>
    {request.review_reason && <Typography level="body-sm">Previous review: {request.review_reason}</Typography>}
    {request.state === "PROVIDER_PENDING" && <Alert color="neutral">The existing provider must confirm membership. Retrying does not enroll the customer with that provider or grant rewards.</Alert>}
    {pending && <>
      <Checkbox label="I checked the captured identity and resolved any matching conflict in the customer record" checked={checked} disabled={mutation.isPending} onChange={event => setChecked(event.target.checked)} />
      <FormControl><FormLabel>Review notes</FormLabel><Textarea minRows={2} value={reason} disabled={mutation.isPending} onChange={event => setReason(event.target.value)} slotProps={{textarea: {maxLength: 2000}}} /></FormControl>
      <Stack direction="row" spacing={1} flexWrap="wrap"><Button disabled={!checked || reason.trim().length < 20} loading={mutation.isPending} onClick={() => mutation.mutate(false)}>{purchaseOnly ? "Retry purchase link" : "Retry identity resolution"}</Button>{!purchaseOnly && <Button color="danger" variant="outlined" disabled={reason.trim().length < 20 || mutation.isPending} onClick={() => mutation.mutate(true)}>Reject request</Button>}</Stack>
    </>}
    {mutation.error && <Alert color="danger">{mutation.error.message}</Alert>}
  </Stack></Card>;
}
function MembershipWorkspacePanel({tenantId}: {tenantId: string}) {
  const queryClient = useQueryClient();
  const key = ["pos-membership", tenantId];
  const query = useQuery({queryKey: key, queryFn: () => loadMembershipWorkspace(tenantId), retry: false});
  const refresh = () => queryClient.invalidateQueries({queryKey: key});
  return <Card sx={{mt: 2}}><Stack spacing={2}>
    <Typography level="h4">POS membership</Typography>
    <Typography level="body-sm">Checkout agreements appear here with their identity and separate marketing choices. A membership request does not grant marketing permission by itself.</Typography>
    <Button variant="outlined" loading={query.isFetching} onClick={() => void query.refetch()}>Refresh membership</Button>
    {query.error && <Alert color="danger">{query.error.message}</Alert>}
    {query.data && <>
      {query.data.role === "owner_admin" ? <PolicyEditor workspace={query.data} onSaved={refresh} /> : <Typography level="body-sm">An account owner manages checkout membership policies.</Typography>}
      <Typography level="title-md">Recent requests</Typography>
      {!query.data.requests.length && <Typography>No membership requests yet.</Typography>}
      {query.data.requests.map(request => <RequestReview key={request.id} request={request} policy={query.data!.policies.find(policy => policy.id === request.policy_id)} tenantId={tenantId} onSaved={refresh} />)}
    </>}
  </Stack></Card>;
}
export function POSMembership() {
  const {tenant} = useTenant();
  return tenant?.id ? <MembershipWorkspacePanel key={tenant.id} tenantId={tenant.id} /> : null;
}
