# Talking to Bloom in Slack

## Where to talk

Mention `@Bloom` to start, then continue in the same thread without another mention. `#ask-bloom` is for approved product help and general recommendations. Use the private `#bloom-tickets` channel for client/support operations, and the existing ticket's thread for a specific issue. Being a channel member does not grant a support role; the Slack identity must be linked to active authorized staff.

Keep personal customer records, passwords, API keys and payment details out of public channels. Bloom verifies channel privacy before exposing client tools and checks the acting person's access again before replying.

## Useful requests

- Product help: `How do I reopen a closed BloomSites pre-sale?`
- Private support overview: `What needs attention, and how many reply approvals are waiting?`
- Client context: `Find West Coast Gardens and explain the recorded support issues.` If several names match, identify the exact business.
- Marketing: `Suggest a three-step plan for this pre-sale. Separate verified facts from recommendations; don't invent dates, stock or offers.`
- In a ticket thread: `Draft a reply using the current evidence, but do not send it.` The proposal belongs in Reply approvals, not the customer's public conversation.
- Human help: `Get a human to help with this.` A recorded escalation is not proof someone has already read it.
- Explicit coding request: `Fix this and deploy it.` This enters the existing repair pipeline under your real permissions. It cannot bypass human stops, review, attempt limits, release checks or payment/security protections.
- Existing merged release: `Resume this release.` This resumes tracking, not a declaration that the deployment succeeded.
- Owner-level private inbox request: `Answer our support emails.` Each request examines at most 25 new ingested support tickets and queues eligible routine questions. It skips sensitive/human-owned/already-active work and reports the actual counts. It does not empty a person's whole Gmail inbox.

## Approvals and trustworthy status

New held replies use one durable Reply approvals queue, including when Gmail is configured. Existing Gmail drafts are unchanged. Review the precise primary recipient and full message. A changed ticket requires a new review. Approval and the one send job are created together; the delivery boundary rechecks the approved content and does not append later messages or new CC recipients.

Keep these states separate: draft prepared, approved, queued, provider accepted, delivered, repair opened, merged, deployed, affected flow verified. Bloom must not turn an earlier state into a later success claim.

## Slack permission prerequisite discovered in live QA

The bot had `chat:write`, `app_mentions:read`, `channels:history` and `groups:history`, but lacked the channel-metadata scopes required by `conversations.info`. The new privacy guard correctly refused operational lookups rather than assuming a private destination.

An app administrator must open the **Bloom** app's **OAuth & Permissions**, add **`groups:read`** and **`channels:read`** under **Bot Token Scopes**, then **Reinstall to Workspace** and approve the requested scopes. Do not change the event endpoint, create another bot, add arbitrary privileges or paste the bot token into chat. If Slack rotates the token, update only `BLOOM_SUPPORT_SLACK_BOT_TOKEN` through the existing secret-management path. After reinstallation, repeat the private read-only support lookup and verify the final Slack reply and tool audit. Do not claim private operations work until that succeeds.

Official references:
https://docs.slack.dev/reference/methods/conversations.info/
https://docs.slack.dev/reference/scopes/groups.read/
https://docs.slack.dev/messaging/retrieving-messages/

## Current technical release evidence

PR #556 merged at `7862633747cc25d28452a4bbdff11c747c5c1ea1`; production migration and Edge Function deployments passed. The new agent was activated using the existing `slack_agent` setting. PR #557 merged at `fe5df834123bb8b89d56af8afbc54d690f53cf1e`; the diagnostic deployment succeeded. Public knowledge retrieval and public-channel privacy refusal have been verified. Private operational lookups remain blocked until the Slack metadata scopes are granted and the live test passes.

The rollback setting is `slack_agent.enabled=false`, which returns conversation answers to the prior responder. Do not undo the database approval fixes: they corrected references to a nonexistent identity table. No recurring coding agent or new paid service is required for the conversational runtime.
