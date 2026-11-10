/**
 * Slack starts the invitation review, but cannot authorize account creation.
 * Only a signed-in BloomSites account creator can send the invite.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const prohibited=/@|https?:|www\.|[<>]|(?:\b(?:all|every|everyone|bulk|multiple|entire)\s+(?:projects?|clients?|customers?|accounts?)\b)|(?:sk_(?:live|test)_|xox[baprs]-|gh[pousr]_|rk_(?:live|test)_)/i;
const normalize=(s:string)=>s.trim().toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
const safeProjectName=(s:string)=>s.replace(/[<>&@*_\x60~\r\n]/g," ").replace(/\s+/g," ").trim().slice(0,90);

/** Exact affirmative commands. A status question or bulk request is not an invite command. */
export function majorProjectInvitationIntent(input:unknown):string|null{
  if(typeof input!=="string")return null;
  const raw=input.trim().replace(/[.!]\s*$/,"");
  if(raw.length<12||raw.length>180||prohibited.test(raw))return null;
  if(/^(?:did|have|has|was|is|are|when|why|which|what|where)\b/i.test(raw))return null;
  const patterns=[
    /^(?:please\s+)?(?:can you\s+)?send\s+(?:(?:the|a|our)\s+)?(?:(?:new|client|major project)\s+){0,2}(?:welcome\s+)?(?:onboarding\s+)?(?:invitation|invite|email)\s+(?:to|for)\s+(.+)$/i,
    /^(?:please\s+)?(?:can you\s+)?(?:invite|onboard)\s+(?:the\s+)?(?:owner\s+(?:of|at|for)\s+)?(?:new\s+)?(?:major\s+project\s+)?(.+)$/i,
    /^(?:please\s+)?(?:can you\s+)?(?:prepare|start)\s+(?:the\s+)?(?:new\s+)?(?:major\s+project\s+)?(?:welcome\s+)?(?:invitation|onboarding)\s+(?:for|at)\s+(.+)$/i,
  ];
  const value=patterns.map(pattern=>pattern.exec(raw)?.[1]?.trim()).find(Boolean);
  if(!value||value.length<3||value.length>90||prohibited.test(value)||!/[a-z]/i.test(value))return null;
  return value;
}
export interface ProjectInviteSummary {
  id?:unknown; project_name?:unknown;project_code?:unknown;stage?:unknown;
}
export type InviteMatch={kind:"matched";project:{id:string;name:string;stage:string}}|
  {kind:"none"|"ambiguous"};

/** Select only one genuine project. No first-result guesses or invented IDs. */
export function findMajorProjectInvitationTarget(hint:string,items:unknown):InviteMatch{
  if(!Array.isArray(items))return {kind:"none"};
  const wanted=normalize(hint);
  if(wanted.length<3)return {kind:"none"};
  const rows=(items as ProjectInviteSummary[]).flatMap(row=>{
    if(!row||typeof row!=="object"||typeof row.id!=="string"||!UUID.test(row.id)||
       typeof row.project_name!=="string")return [];
    return [{id:row.id,name:safeProjectName(row.project_name),stage:typeof row.stage==="string"?row.stage:"unknown",
      normalized:normalize(row.project_name),code:typeof row.project_code==="string"?normalize(row.project_code):""}];
  });
  const exact=rows.filter(r=>r.normalized===wanted||r.code===wanted);
  const candidates=exact.length>0?exact:rows.filter(r=>r.normalized.includes(wanted));
  if(!candidates.length)return {kind:"none"};
  if(candidates.length>1)return {kind:"ambiguous"};
  const {id,name,stage}=candidates[0];
  return {kind:"matched",project:{id,name,stage}};
}
const reviewLink=(id:string)=>"https://bloomsites.app/dashboard/admin/major-projects/invite?project="+id;
export function projectInviteSlackAnswer(result:InviteMatch):string{
  const projectsLink="<https://bloomsites.app/dashboard/admin/major-projects|Open Major Projects>";
  if(result.kind==="none")return "I couldn't find that Major Project. Check its name in "+projectsLink+". No invitation was sent.";
  if(result.kind==="ambiguous")return "I found more than one matching project. Use the full name or code. No invitation was sent. "+projectsLink;
  const {id,name,stage}=result.project;
  if(["lead","discovery_scheduled","discovery_complete","proposal_draft","proposal_sent","declined","paused"].includes(stage)){
    return "*"+safeProjectName(name)+"* isn't ready for client onboarding yet. Accept the project in "+projectsLink+" first. No invitation was sent.";
  }
  return [
    "*Welcome invitation: "+safeProjectName(name)+"*",
    "I found the Major Project. Let's confirm the client owner before sending.",
    "<"+reviewLink(id)+"|Review & send invitation>",
    "_Only an authorized account creator can send this. BloomSites checks the recipient, store and previous invitations. Nothing has been emailed yet._",
  ].join("\n");
}
