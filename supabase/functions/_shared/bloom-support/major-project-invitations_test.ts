import {assertEquals,assertStringIncludes} from "@std/assert";
import {
  majorProjectInvitationIntent,
  findMajorProjectInvitationTarget,
  projectInviteSlackAnswer,
} from "./major-project-invitations.ts";

const triple={id:"11111111-1111-4111-8111-111111111111",project_name:"Triple Tree Nurseryland",project_code:"TRIPLE-TREE",stage:"internal_review"};
const winderberry={id:"22222222-2222-4222-8222-222222222222",project_name:"Winderberry & Edible Acres",project_code:"WINDERBERRY",stage:"building"};

Deno.test("only a clear, named Slack invitation request qualifies",()=>{
  assertEquals(majorProjectInvitationIntent("send the welcome invitation for Triple Tree"),"Triple Tree");
  assertEquals(majorProjectInvitationIntent("invite Triple Tree"),"Triple Tree");
  assertEquals(majorProjectInvitationIntent("prepare onboarding for Triple Tree"),"Triple Tree");
  assertEquals(majorProjectInvitationIntent("send an invitation to Triple Tree"),"Triple Tree");
  assertEquals(majorProjectInvitationIntent("How are Triple Tree invitations going?"),null);
  assertEquals(majorProjectInvitationIntent("send invites for all clients"),null);
  assertEquals(majorProjectInvitationIntent("invite client@example.com"),null);
  assertEquals(majorProjectInvitationIntent("send the welcome invitation for sk_live_fake"),null);
});

Deno.test("matches exactly one project or a unique distinctive partial name",()=>{
  const rows=[triple,winderberry];
  assertEquals(findMajorProjectInvitationTarget("Triple Tree",rows).kind,"matched");
  assertEquals(findMajorProjectInvitationTarget("TRIPLE-TREE",rows).kind,"matched");
  assertEquals(findMajorProjectInvitationTarget("Winderberry",rows).kind,"matched");
  assertEquals(findMajorProjectInvitationTarget("unknown project",rows).kind,"none");
  assertEquals(findMajorProjectInvitationTarget("tree",rows).kind,"none");
  assertEquals(findMajorProjectInvitationTarget("Triple Tree",[
    triple,{...triple,id:"33333333-3333-4333-8333-333333333333",project_code:"DUPLICATE"}
  ]).kind,"ambiguous");
});

Deno.test("returns an authenticated CMS handoff, not a client email or Slack send",()=>{
  const found=findMajorProjectInvitationTarget("Triple Tree",[triple]);
  const response=projectInviteSlackAnswer(found);
  assertStringIncludes(response,"*Welcome invitation: Triple Tree Nurseryland*");
  assertStringIncludes(response,"https://bloomsites.app/dashboard/admin/major-projects/invite?project=11111111-1111-4111-8111-111111111111");
  assertStringIncludes(response,"Review & send invitation");
  assertStringIncludes(response,"Nothing has been emailed yet");
  assertEquals(response.includes("rylan@"),false);
  assertEquals(response.includes("password"),false);
});

Deno.test("blocked and ambiguous requests fail safely",()=>{
  const declined=projectInviteSlackAnswer(findMajorProjectInvitationTarget("Triple Tree",[{...triple,stage:"declined"}]));
  assertStringIncludes(declined,"isn't ready");
  assertStringIncludes(declined,"No invitation was sent");
  assertStringIncludes(projectInviteSlackAnswer({kind:"none"}),"No invitation was sent");
  assertStringIncludes(projectInviteSlackAnswer({kind:"ambiguous"}),"No invitation was sent");
});

Deno.test("a dangerous project name cannot inject Slack actions or mentions",()=>{
  const target=findMajorProjectInvitationTarget("Scary",[{
    ...triple,project_name:"Scary <@U123> sk_live_abc",project_code:"SCARY"
  }]);
  const message=projectInviteSlackAnswer(target);
  assertEquals(message.includes("<@U123>"),false);
  assertEquals(message.includes("sk_live_abc"),false);
});
