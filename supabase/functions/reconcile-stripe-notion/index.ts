import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN')!
const NOTION_DB_ID = Deno.env.get('NOTION_PIPELINE_DB_ID')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

const notionHeaders = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28'
}

interface ReconEvent {
  stripe_customer_id: string
  customer_email: string | null
  customer_name?: string | null
  stripe_status: string
  notion_stage: string
  mismatch_type: string
  auto_fixed?: boolean
  fix_detail?: string
}

serve(async () => {
  const events: ReconEvent[] = []

  // Step 1: Get all active Stripe subscriptions
  const stripeRes = await fetch(
    'https://api.stripe.com/v1/subscriptions?status=active&limit=100&expand[]=data.customer',
    { headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` } }
  )
  const stripeData = await stripeRes.json()
  const activeSubscriptions = stripeData.data || []

  // Step 2: For each active Stripe sub, check Notion
  for (const sub of activeSubscriptions) {
    const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
    const email = typeof sub.customer === 'object' ? sub.customer.email : null
    const customerName = typeof sub.customer === 'object' ? sub.customer.name : null
    const subStartDate = sub.start_date ? new Date(sub.start_date * 1000).toISOString().split('T')[0] : null

    const notionRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders,
      body: JSON.stringify({
        filter: {
          or: [
            { property: 'External ID', rich_text: { equals: stripeCustomerId } },
            ...(email ? [{ property: 'Email', email: { equals: email } }] : [])
          ]
        }
      })
    })
    const notionData = await notionRes.json()

    if (!notionData.results || notionData.results.length === 0) {
      // ── AUTO-FIX: Create minimal Notion record ──
      let autoFixed = false
      let fixDetail = ''
      try {
        const createRes = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: notionHeaders,
          body: JSON.stringify({
            parent: { database_id: NOTION_DB_ID },
            properties: {
              'Garden Center': { title: [{ text: { content: email || customerName || stripeCustomerId } }] },
              'Stage': { select: { name: '⚠️ Broken' } },
              ...(email ? { 'Email': { email: email } } : {}),
              'External ID': { rich_text: [{ text: { content: stripeCustomerId } }] },
              'Next Action': { rich_text: [{ text: { content: 'Auto-created from Stripe reconciliation — needs review' } }] },
              'Next Action Date': { date: { start: new Date().toISOString().split('T')[0] } },
              ...(subStartDate ? { 'Won Date': { date: { start: subStartDate } } } : {}),
            }
          })
        })
        if (createRes.ok) {
          autoFixed = true
          fixDetail = `Created broken record in Notion with email ${email || 'unknown'}`
          console.log(`reconcile: auto-created Notion record for ${email}`)
        } else {
          fixDetail = `Failed to create Notion record: ${await createRes.text()}`
          console.error(`reconcile: failed to create Notion record for ${email}`, fixDetail)
        }
      } catch (err) {
        fixDetail = `Error creating Notion record: ${err}`
        console.error(`reconcile: error creating Notion record for ${email}`, err)
      }

      events.push({
        stripe_customer_id: stripeCustomerId,
        customer_email: email,
        customer_name: customerName,
        stripe_status: 'active',
        notion_stage: 'NOT FOUND',
        mismatch_type: 'active_not_in_notion',
        auto_fixed: autoFixed,
        fix_detail: fixDetail,
      })
      continue
    }

    const notionPage = notionData.results[0]
    const notionPageId = notionPage.id
    const notionStage = notionPage.properties['Stage']?.select?.name
    const wonDate = notionPage.properties['Won Date']?.date?.start

    // Flag wrong stage
    const validPayingStages = ['Won', 'Account Setup & Welcome', 'Onboarding & Setup', 'Active']
    if (notionStage && !validPayingStages.includes(notionStage) && notionStage !== 'Churned') {
      events.push({
        stripe_customer_id: stripeCustomerId,
        customer_email: email,
        stripe_status: 'active',
        notion_stage: notionStage,
        mismatch_type: 'active_wrong_stage',
      })
    }

    // ── AUTO-FIX: missing_won_date ──
    if (validPayingStages.includes(notionStage) && !wonDate) {
      let autoFixed = false
      let fixDetail = ''
      const wonDateValue = subStartDate || new Date().toISOString().split('T')[0]

      try {
        const patchRes = await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, {
          method: 'PATCH',
          headers: notionHeaders,
          body: JSON.stringify({
            properties: {
              'Won Date': { date: { start: wonDateValue } }
            }
          })
        })
        if (patchRes.ok) {
          autoFixed = true
          fixDetail = `won_date set to ${wonDateValue}`
          console.log(`reconcile: auto-fixed won_date for ${email} → ${wonDateValue}`)
        } else {
          fixDetail = `Failed to set won_date: ${await patchRes.text()}`
          console.error(`reconcile: failed to fix won_date for ${email}`)
        }
      } catch (err) {
        fixDetail = `Error setting won_date: ${err}`
      }

      events.push({
        stripe_customer_id: stripeCustomerId,
        customer_email: email,
        stripe_status: 'active',
        notion_stage: notionStage,
        mismatch_type: 'missing_won_date',
        auto_fixed: autoFixed,
        fix_detail: fixDetail,
      })
    }
  }

  // Step 3: Check cancelled Stripe subs still in paying stage in Notion
  const cancelledRes = await fetch(
    'https://api.stripe.com/v1/subscriptions?status=canceled&limit=50&expand[]=data.customer',
    { headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` } }
  )
  const cancelledData = await cancelledRes.json()

  for (const sub of (cancelledData.data || [])) {
    const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
    const email = typeof sub.customer === 'object' ? sub.customer.email : null

    const notionRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders,
      body: JSON.stringify({
        filter: {
          or: [
            { property: 'External ID', rich_text: { equals: stripeCustomerId } },
            ...(email ? [{ property: 'Email', email: { equals: email } }] : [])
          ]
        }
      })
    })
    const notionData = await notionRes.json()

    if (notionData.results?.length > 0) {
      const notionPage = notionData.results[0]
      const notionPageId = notionPage.id
      const notionStage = notionPage.properties['Stage']?.select?.name
      const payingStages = ['Won', 'Account Setup & Welcome', 'Onboarding & Setup', 'Active']

      if (payingStages.includes(notionStage)) {
        // ── AUTO-FIX: Set stage to Churned ──
        let autoFixed = false
        let fixDetail = ''

        try {
          const patchRes = await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, {
            method: 'PATCH',
            headers: notionHeaders,
            body: JSON.stringify({
              properties: {
                'Stage': { select: { name: 'Churned' } }
              }
            })
          })
          if (patchRes.ok) {
            autoFixed = true
            fixDetail = `stage set to Churned (was ${notionStage})`
            console.log(`reconcile: auto-fixed ${email} → Churned (was ${notionStage})`)
          } else {
            fixDetail = `Failed to set Churned: ${await patchRes.text()}`
            console.error(`reconcile: failed to churn ${email}`)
          }
        } catch (err) {
          fixDetail = `Error setting Churned: ${err}`
        }

        events.push({
          stripe_customer_id: stripeCustomerId,
          customer_email: email,
          stripe_status: 'canceled',
          notion_stage: notionStage,
          mismatch_type: 'cancelled_still_active',
          auto_fixed: autoFixed,
          fix_detail: fixDetail,
        })
      }
    }
  }

  // Step 4: Write to reconciliation_log
  if (events.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/reconciliation_log`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(events)
    })
  }

  // Step 5: Send reconciliation email
  const RECIPIENTS = ['jon@getclear.ca', 'jeff@brandsinblooms.com']
  const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const manualItems = events.filter(e => !e.auto_fixed)
  const autoFixedItems = events.filter(e => e.auto_fixed)

  function renderItem(m: ReconEvent): string {
    const addr = esc(m.customer_email || m.stripe_customer_id)
    const badge = m.auto_fixed
      ? `<span style="display:inline-block;background:#dcfce7;color:#166534;font-size:11px;padding:1px 6px;border-radius:4px;margin-left:6px;">auto-fixed</span>`
      : ''
    switch (m.mismatch_type) {
      case 'active_not_in_notion':
        return `<p style="font-size:14px;color:#374151;margin:0 0 10px;line-height:1.5;"><strong>${addr}</strong>${m.customer_name ? ` (${esc(m.customer_name)})` : ''} is paying in Stripe but had no Notion record.${badge}${m.auto_fixed ? ` Created as ⚠️ Broken — needs review.` : ' Create or update their Notion record.'}</p>`
      case 'active_wrong_stage':
        return `<p style="font-size:14px;color:#374151;margin:0 0 10px;line-height:1.5;"><strong>${addr}</strong> is paying in Stripe but their Notion stage is "${esc(m.notion_stage)}". Update their stage to Won or Active.</p>`
      case 'missing_won_date':
        return `<p style="font-size:14px;color:#374151;margin:0 0 10px;line-height:1.5;"><strong>${addr}</strong> — ${m.auto_fixed ? `Won Date auto-set to ${esc(m.fix_detail?.replace('won_date set to ', '') || '')}` : 'Won Date is blank. Open their pipeline record and set it.'}.${badge}</p>`
      case 'cancelled_still_active':
        return `<p style="font-size:14px;color:#374151;margin:0 0 10px;line-height:1.5;"><strong>${addr}</strong> cancelled in Stripe.${badge}${m.auto_fixed ? ` Stage auto-updated to Churned (was ${esc(m.notion_stage)}).` : ` Still marked "${esc(m.notion_stage)}" in Notion. Update to Churned.`}</p>`
      default:
        return `<p style="font-size:14px;color:#374151;margin:0 0 10px;line-height:1.5;"><strong>${addr}</strong> — ${esc(m.mismatch_type)}</p>`
    }
  }

  let bodyHtml = ''

  if (events.length === 0) {
    bodyHtml = `<div style="background:#f0fdf4;border-left:4px solid #1abc9c;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="font-size:15px;font-weight:500;color:#166534;margin:0;">All systems clean — Stripe and Notion are in sync.</p>
    </div>`
  } else {
    const summaryParts: string[] = []
    if (autoFixedItems.length > 0) summaryParts.push(`${autoFixedItems.length} auto-fixed`)
    if (manualItems.length > 0) summaryParts.push(`${manualItems.length} need manual attention`)

    bodyHtml = `<p style="font-size:14px;color:#374151;margin:0 0 24px;line-height:1.6;">Found <strong>${events.length}</strong> item${events.length === 1 ? '' : 's'}: ${summaryParts.join(', ')}.</p>`

    // Auto-fixed items (green)
    if (autoFixedItems.length > 0) {
      bodyHtml += `<div style="border-left:4px solid #1abc9c;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;background:#f0fdf4;">
        <p style="font-size:12px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;">Auto-Fixed (${autoFixedItems.length})</p>
        ${autoFixedItems.map(renderItem).join('')}
      </div>`
    }

    // Manual items (red/yellow)
    if (manualItems.length > 0) {
      const actionRequired = manualItems.filter(m => m.mismatch_type === 'active_not_in_notion' || m.mismatch_type === 'active_wrong_stage')
      const dataCleanup = manualItems.filter(m => m.mismatch_type === 'missing_won_date')
      const billingMismatch = manualItems.filter(m => m.mismatch_type === 'cancelled_still_active')

      if (actionRequired.length > 0) {
        bodyHtml += `<div style="border-left:4px solid #ef4444;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;background:#fef2f2;">
          <p style="font-size:12px;font-weight:600;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;">Action Required</p>
          ${actionRequired.map(renderItem).join('')}
        </div>`
      }
      if (dataCleanup.length > 0) {
        bodyHtml += `<div style="border-left:4px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;background:#fffbeb;">
          <p style="font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;">Data Cleanup</p>
          ${dataCleanup.map(renderItem).join('')}
        </div>`
      }
      if (billingMismatch.length > 0) {
        bodyHtml += `<div style="border-left:4px solid #ef4444;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;background:#fef2f2;">
          <p style="font-size:12px;font-weight:600;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;">Billing Mismatch</p>
          ${billingMismatch.map(renderItem).join('')}
        </div>`
      }
    }
  }

  const subject = events.length === 0
    ? 'BloomSuite Reconciliation — all clean'
    : `BloomSuite Reconciliation — ${events.length} item${events.length === 1 ? '' : 's'}${autoFixedItems.length > 0 ? ` (${autoFixedItems.length} auto-fixed)` : ''}`

  const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
  <tr><td style="background:#0d1f1a;padding:20px 40px;">
    <img src="https://udldmkqwnxhdeztyqcau.supabase.co/storage/v1/object/public/content-assets/bloomsuite-logo.png" alt="BloomSuite" style="height:36px;width:auto;display:block;" />
  </td></tr>
  <tr><td style="background:#1abc9c;padding:16px 40px;">
    <p style="color:#ffffff;font-size:16px;font-weight:500;margin:0;">Stripe / Notion Reconciliation</p>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    ${bodyHtml}
    <div style="text-align:center;margin-top:24px;">
      <a href="https://www.notion.so/344d234a0ae54f4185e19d260ac658a9" style="display:inline-block;background:#1abc9c;color:#ffffff;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;">Open Customer Pipeline →</a>
    </div>
    <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;border-top:1px solid #e5e7eb;padding-top:16px;">This reconciliation runs automatically. Auto-fixes are applied where safe. Only items that need human attention are flagged.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'BloomSuite System <system@bloomsuite.app>',
      to: RECIPIENTS,
      subject,
      html: emailHtml
    })
  })

  return new Response(
    JSON.stringify({
      total: events.length,
      auto_fixed: autoFixedItems.length,
      manual: manualItems.length,
      events
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
