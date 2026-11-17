# Bloom Support — Language Audit

Updated 2026-11-16. Deliverable C of the World-Class Support initiative.

Covers all customer-facing strings from `voice.ts`. Each string is quoted exactly, assessed, and given a rewrite.

**Principles applied:**
- Garden centre owners are small business people, not enterprise users. Warm, specific, human.
- Bloom is an AI. Never say "our team" for something the AI did. Be honest.
- Short for routine messages. Clear and specific when something went wrong.
- Never promise what we can't back up. Never claim a fix is live until verified.

---

## `bloomAcknowledgement(ticketNumber)`

**Current:**
> "I'm Bloom, the BloomSuite support agent. I've received your request (#N). I'll take the first look. If this needs a person, I'll hand it over."

**Assessment:** ✅ Good bones. The role disclosure is honest. "Take the first look" is accurate.
One issue: "I'll hand it over" is vague — hand it over to whom? In what timeframe? A garden centre owner
who filed a ticket at 7pm on a Sunday may wonder if this means "in 30 seconds" or "in three days."

**Recommended rewrite:**
> "I'm Bloom, BloomSuite's AI support assistant. I've got your request (#N) and I'm looking at it now. If I can't resolve it myself, I'll flag it for Jon or Jeff to pick up."

*Why:* Names "Jon or Jeff" (the actual people) rather than the abstract "a person." Makes the AI role explicit.
Removes the ambiguity about timing.

*Note: When staff names are configurable via settings, this should pull from `settings.support.default_owner_email`.*

---

## `bloomClarification(details[])`

**Current:**
> "I need a little more detail so I can move this forward:\n• {question1}\n• {question2}\nReply here and I'll pick it up from there."

**Assessment:** ✅ Solid. "Move this forward" is a little corporate but acceptable. "Reply here and I'll pick it up" is clear.
Main issue: no acknowledgement that we already have their previous message — a client who sent a long
description might feel like we didn't read it.

**Recommended rewrite:**
> "To help you properly, I need a couple more details:\n• {question1}\n• {question2}\nReply to this email and I'll continue from where we left off."

*Why:* "Continue from where we left off" signals we have the context. "Help you properly" is warmer than
"move this forward."

---

## `bloomFeatureReceived()`

**Current:**
> "I've recorded this as a feature idea and sent it to our product team for a decision. I can't promise it will be built, but I'll share the outcome on this request."

**Assessment:** ⚠️ Concern: "sent it to our product team for a decision" implies a human team received a notification.
In reality, it's logged in the database; a human reviews it on their own schedule. This could set an expectation
of faster follow-up than is accurate.

**Recommended rewrite:**
> "I've logged this as a feature idea. Jon and Jeff review these and decide what gets built — I can't promise a date or outcome, but I'll update you on this request when there's a decision."

*Why:* "Jon and Jeff review these" is accurate and specific. Removes the false sense of urgency that "sent to our
product team" creates.

---

## `bloomInvestigationStarted("bug")`

**Current:**
> "I've logged this as a possible product problem and sent the evidence to our support team for review. Any repair must be approved, tested and checked before it goes live."

**Assessment:** ⚠️ "Sent the evidence to our support team for review" — same issue as above. Evidence is logged; a person
reviews it. The second sentence about approval process is good — accurate, sets expectations.

Also: "possible product problem" is vague. If we're calling it a bug investigation, we can be more specific.

**Recommended rewrite:**
> "I've flagged this as a possible product bug and recorded the details. Before anything is released, Jon or Jeff needs to review and approve the fix — I'll keep you updated here as it moves forward."

*Why:* More specific about what "investigation started" means. Accurate about the approval gate.

---

## `bloomInvestigationStarted("incident")`

**Current:**
> "I've flagged this as a possible incident and alerted our support team so they can assess the impact. I'll keep this request tied to any investigation they approve."

**Assessment:** ⚠️ Same issue: "alerted our support team" implies an immediate human notification. Only happens if
Slack is configured. Also "assessment" language is cold for a garden centre owner worried about their POS being down.

**Recommended rewrite:**
> "I've flagged this as a possible service incident. I've noted the urgency and I'll make sure Jon or Jeff sees this. I'll keep updating you here — you don't need to file another report."

*Why:* Warmer, more human. Addresses the anxiety of "is anyone actually looking at this." Removes the false
precision of "alerted our support team."

---

## `bloomEngineeringProgress("investigating")`

**Current:**
> "I've started the technical investigation and I'm checking the affected workflow against the evidence on your request."

**Assessment:** ✅ Accurate and honest. "Against the evidence on your request" is a good detail.

**Recommended rewrite:** Minor polish only:
> "I've started the technical investigation. I'm checking the affected steps against the details you provided."

*Why:* "Details you provided" is slightly warmer than "evidence on your request."

---

## `bloomEngineeringProgress("reproduced")`

**Current:**
> "I've confirmed the problem. The investigation is now focused on a safe fix, with your request linked to the repair."

**Assessment:** ✅ Good. Clear, accurate, honest.

**Recommended rewrite:** Minor only:
> "I've been able to reproduce the problem you described. The investigation is now focused on a safe fix."

*Why:* "Been able to reproduce the problem you described" is more conversational and links the confirmation
back to the client's report.

---

## `bloomEngineeringProgress("fixing")`

**Current:**
> "The problem is confirmed and a fix is being prepared. It still needs to pass testing and review before anything can go live."

**Assessment:** ✅ Accurate. The caveat about testing is important.

Suggested minor improvement:
> "The problem is confirmed and a fix is in progress. It still needs to pass review and testing before it reaches the app — I'll let you know when that happens."

*Why:* "Before it reaches the app" is clearer to a non-technical user than "before anything can go live."

---

## `bloomEngineeringProgress("in_review")` / `"awaiting_approval"`

**Current:**
> "A fix has been prepared and is being reviewed. Nothing will be released until the checks and approval are complete."

**Assessment:** ✅ Accurate and appropriately cautious.

Suggested improvement:
> "A fix is ready and is being reviewed. Nothing goes live until it passes the checks and Jon or Jeff gives the go-ahead."

*Why:* "Jon or Jeff gives the go-ahead" grounds the abstract "approval" in a real person.

---

## `bloomEngineeringProgress("approved")` / `"merging"` / `"deploying"`

**Current:**
> "The fix has passed review and is moving through release. I'll keep the request open until the affected workflow is checked live."

**Assessment:** ✅ Good. Accurate — it doesn't claim the fix is live.

Suggested improvement:
> "The fix has been approved and is being released now. I'll keep this request open until we've confirmed it's working in the app — that check happens before I mark this resolved."

*Why:* "Before I mark this resolved" is reassuring — the client knows we won't just close the ticket on them.

---

## `bloomEngineeringProgress("verifying")`

**Current:**
> "The fix is live and the affected steps are being checked now. I won't mark this resolved until that verification passes."

**Assessment:** ✅ Excellent. Clear, specific, honest. Keep as-is.

---

## `bloomEngineeringProgress("not_reproduced")`

**Current:**
> "I couldn't reproduce the problem reliably, so I've handed the evidence to a person on our support team for a closer look."

**Assessment:** ✅ Honest and clear. "Handed the evidence to a person" is good — accurate about what happens
(the logs are available for a human to review).

Suggested improvement:
> "I wasn't able to reproduce this reliably, so I've passed the details to Jon or Jeff for a closer look. You don't need to send anything again — they have everything I recorded."

*Why:* Naming Jon/Jeff and reassuring the client they don't need to resend anything.

---

## `bloomEngineeringProgress("failed")` / `"escalated"`

**Current:**
> "The automatic repair has stopped. This request is in our support team's review queue. The next step is for an admin to choose how to continue; you don't need to submit it again."

**Assessment:** ✅ Accurate. "You don't need to submit it again" is a helpful detail.

Suggested improvement:
> "The automated repair process has stopped — it hit a problem it can't safely resolve on its own. Jon or Jeff will review this and decide what happens next. You don't need to do anything; I'll keep you updated here."

*Why:* More specific about why it stopped. Warmer ending.

---

## `bloomEngineeringProgress("rolled_back")`

**Current:**
> "The live check did not pass, so the change was rolled back. A person on our support team has been alerted, and the request remains open."

**Assessment:** ✅ Accurate and appropriately cautious. "Change was rolled back" is clear.

Suggested improvement:
> "The live check didn't pass, so the change has been rolled back — the app is as it was before. Jon or Jeff has been alerted and will decide the next step. I'll keep this request open."

*Why:* "The app is as it was before" is reassuring — the client knows nothing is worse.

---

## `bloomFeatureDecision("accepted")`

**Current:**
> "Our product team has accepted your idea for further consideration. It isn't scheduled yet, so I can't promise a date, but your request is now linked to it."

**Assessment:** ⚠️ "Our product team" again — same precision issue.

**Recommended rewrite:**
> "Jon and Jeff have reviewed your idea and added it to the product backlog. There's no date yet, but your request is linked to it — I'll let you know if that changes."

---

## `bloomFeatureDecision("planned")`

**Current:**
> "Good news — our product team plans to build this. There isn't a date I can promise yet, but your request will stay linked to the feature."

**Assessment:** ✅ Good. The "Good news" opener is nice. Same minor issue with "our product team."

**Recommended rewrite:**
> "Good news — Jon and Jeff have decided to build this. No date yet, but your request is linked to it and I'll update you when it ships."

---

## `bloomFeatureDecision("shipped")`

**Current:**
> "Good news — this feature is now available. If you'd like help finding or using it, reply here and I'll help you get started."

**Assessment:** ✅ Excellent. Clear, warm, actionable. Keep as-is.

---

## `bloomFeatureDecision("declined")`

**Current:**
> "Our product team reviewed the idea and decided not to add it right now. I know that may not be the answer you hoped for. If you tell me more about the outcome you need, I'll help look for another way."

**Assessment:** ✅ Very good. The empathy line is genuine. The redirect to "what outcome do you need" is excellent.
Minor: "our product team reviewed."

**Recommended rewrite:**
> "Jon and Jeff reviewed your idea and decided not to build it right now. I know that might not be what you were hoping for. If you tell me more about what you're trying to do, I'll see if there's another way."

---

## `bloomResolution(summary?)`

**Current:**
> "Good news — this is resolved.\n\n{summary}\n\nIf anything still isn't right, reply to this email. I'll reopen the request and continue from here."

**Assessment:** ✅ Good. The invitation to reply if something isn't right is excellent — it's the main defense
against silently unresolved issues. The "continue from here" is reassuring.

One issue: when there's no `summary`, the message is very bare. A resolution without any explanation of *what*
was resolved is frustrating.

**Recommended rewrite when no summary:**
> "Good news — this has been resolved. I may not have explained what was done in detail — if you'd like to know more, or if something still isn't right, reply here and I'll pick it up."

**Recommended rewrite when summary present (keep structure, improve opener):**
> "This has been resolved.\n\n{summary}\n\nIf something still isn't right, reply to this email and I'll reopen the request right away."

*Why:* "This has been resolved" is calmer than "Good news — this is resolved" when the client was frustrated.
"I'll reopen the request right away" is more specific than "continue from here."

---

## `bloomReopened()`

**Current:**
> "Thanks for letting me know. I've reopened this request and I'm taking another look. You don't need to start over — the earlier conversation and details are still here."

**Assessment:** ✅ Good. "You don't need to start over" is exactly the right reassurance.

Suggested minor improvement:
> "Got it — I've reopened this request and I'm looking at it again. Everything from before is still here; you don't need to repeat yourself."

*Why:* "Got it" is more natural. "You don't need to repeat yourself" is warmer and more specific.

---

## `bloomAttachmentRejection(rejected[])`

**Current:**
> "I received your email, but I couldn't safely accept these attachments:\n• {files}\nPlease reply with a supported file if it is still needed. Your request is already open, so you don't need to send everything again."

**Assessment:** ✅ Good. Accurate, clear, reassuring. "Couldn't safely accept" is better than "file type not allowed."

Suggested minor improvement:
> "I received your message, but couldn't accept these attachments:\n• {files}\nIf a file is still needed, reply with a supported format. Your request is already open — you don't need to resend everything else."

*Why:* "Reply with a supported format" is slightly clearer. "Resend everything else" is natural language.

---

## `bloomHandoff(reason)`

**Current:**
> "{reason}. I'm handing this to a person on our support team rather than guessing. They'll continue with you here."

**Assessment:** ✅ Excellent. "Rather than guessing" is honest and appropriate. "They'll continue with you here"
sets the right expectation.

One addition: tell the client *who* is picking it up if that's known, and give a rough sense of timing.

**Recommended rewrite:**
> "{reason}. I'm passing this to Jon or Jeff rather than guessing — they'll have the full context from this conversation. I'll leave a note for them so they can pick up where I left off."

*Why:* "They'll have the full context" is reassuring. "I'll leave a note" makes the handoff feel deliberate
and cared-for.

---

## Summary of changes

| Function | Severity | Issue | Fix |
|---|---|---|---|
| `bloomAcknowledgement` | Low | Vague about who handles escalation | Name Jon/Jeff |
| `bloomFeatureReceived` | Medium | "sent to product team" implies immediate human notification | "Jon and Jeff review these" |
| `bloomInvestigationStarted (bug)` | Medium | Same over-promise | "Jon or Jeff needs to review" |
| `bloomInvestigationStarted (incident)` | Medium | Same issue, plus cold tone | Warmer, more specific |
| `bloomFeatureDecision (accepted/planned/declined)` | Low | "our product team" abstraction | Name Jon/Jeff |
| `bloomHandoff` | Low | Doesn't mention context transfer | "I'll leave a note" |
| `bloomResolution (no summary)` | Medium | Very bare when no summary provided | Add "reply if you'd like to know more" |

Strings with no changes recommended: `bloomClarification`, `bloomEngineeringProgress (verifying)`,
`bloomFeatureDecision (shipped)`, `bloomAttachmentRejection` (minor polish only).
