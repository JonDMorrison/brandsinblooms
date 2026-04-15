import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN')!
const NOTION_DB_ID = Deno.env.get('NOTION_PIPELINE_DB_ID')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const INTERNAL_ALERT_EMAIL = Deno.env.get('INTERNAL_ALERT_EMAIL') || 'jon@getclear.ca'

const notionHeaders = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28'
}

serve(async () => {
  const mismatches: any[] = []

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
      mismatches.push({
        stripe_customer_id: stripeCustomerId,
        customer_email: email,
        stripe_status: 'active',
        notion_stage: 'NOT FOUND',
        mismatch_type: 'active_not_in_notion'
      })
      continue
    }

    const notionPage = notionData.results[0]
    const notionStage = notionPage.properties['Stage']?.select?.name
    const wonDate = notionPage.properties['Won Date']?.date?.start

    // Flag if a paying Stripe subscriber is still in a non-paying Notion stage
    const validPayingStages = ['Won', 'Account Setup & Welcome', 'Onboarding & Setup', 'Active']
    if (notionStage && !validPayingStages.includes(notionStage) && notionStage !== 'Churned') {
      mismatches.push({
        stripe_customer_id: stripeCustomerId,
        customer_email: email,
        stripe_status: 'active',
        notion_stage: notionStage,
        mismatch_type: 'active_wrong_stage'
      })
    }

    if (validPayingStages.includes(notionStage) && !wonDate) {
      mismatches.push({
        stripe_customer_id: stripeCustomerId,
        customer_email: email,
        stripe_status: 'active',
        notion_stage: notionStage,
        mismatch_type: 'missing_won_date'
      })
    }
  }

  // Step 3: Check cancelled Stripe subs still Active in Notion
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
      const notionStage = notionData.results[0].properties['Stage']?.select?.name
      // Only flag if the Notion record is in a non-churned paying stage
      const payingStages = ['Won', 'Account Setup & Welcome', 'Onboarding & Setup', 'Active']
      if (payingStages.includes(notionStage)) {
        mismatches.push({
          stripe_customer_id: stripeCustomerId,
          customer_email: email,
          stripe_status: 'canceled',
          notion_stage: notionStage,
          mismatch_type: 'cancelled_still_active'
        })
      }
    }
  }

  // Step 4: Write mismatches to reconciliation_log
  if (mismatches.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/reconciliation_log`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mismatches)
    })
  }

  // Step 5: Send reconciliation email
  const RECIPIENTS = ['jon@getclear.ca', 'jeff@brandsinblooms.com']

  const actionRequired = mismatches.filter(m => m.mismatch_type === 'active_not_in_notion' || m.mismatch_type === 'active_wrong_stage')
  const dataCleanup = mismatches.filter(m => m.mismatch_type === 'missing_won_date')
  const billingMismatch = mismatches.filter(m => m.mismatch_type === 'cancelled_still_active' || m.mismatch_type === 'active_not_in_stripe')

  const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  function renderItem(m: any): string {
    const email = esc(m.customer_email || m.stripe_customer_id)
    switch (m.mismatch_type) {
      case 'active_not_in_notion':
        return `<p style="font-size:14px;color:#374151;margin:0 0 10px;line-height:1.5;"><strong>${email}</strong> is paying in Stripe but has no record in the Notion pipeline. Create or update their Notion record.</p>`
      case 'active_wrong_stage':
        return `<p style="font-size:14px;color:#374151;margin:0 0 10px;line-height:1.5;"><strong>${email}</strong> is paying in Stripe but their Notion stage is "${esc(m.notion_stage)}". Update their stage to Won or Active.</p>`
      case 'missing_won_date':
        return `<p style="font-size:14px;color:#374151;margin:0 0 10px;line-height:1.5;"><strong>${email}</strong> is an active paying client but their Won Date is blank in Notion. Open their pipeline record and set it.</p>`
      case 'cancelled_still_active':
        return `<p style="font-size:14px;color:#374151;margin:0 0 10px;line-height:1.5;"><strong>${email}</strong> has cancelled in Stripe but is still marked "${esc(m.notion_stage)}" in Notion. Update their stage to Churned.</p>`
      case 'active_not_in_stripe':
        return `<p style="font-size:14px;color:#374151;margin:0 0 10px;line-height:1.5;"><strong>${email}</strong> is marked active in Notion but has no active Stripe subscription. Verify whether they are still paying.</p>`
      default:
        return `<p style="font-size:14px;color:#374151;margin:0 0 10px;line-height:1.5;"><strong>${email}</strong> — ${esc(m.mismatch_type)}</p>`
    }
  }

  let bodyHtml = ''

  if (mismatches.length === 0) {
    bodyHtml = `<div style="background:#f0fdf4;border-left:4px solid #1abc9c;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="font-size:15px;font-weight:500;color:#166534;margin:0;">All systems clean — Stripe and Notion are in sync.</p>
    </div>`
  } else {
    const categories: string[] = []
    if (actionRequired.length > 0) categories.push('action required')
    if (dataCleanup.length > 0) categories.push('data cleanup')
    if (billingMismatch.length > 0) categories.push('billing mismatch')

    bodyHtml = `<p style="font-size:14px;color:#374151;margin:0 0 24px;line-height:1.6;">Found <strong>${mismatches.length}</strong> item${mismatches.length === 1 ? '' : 's'} across ${categories.join(', ')}. Action Required items need to be handled today. Data Cleanup items can be batched.</p>`

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

  const subject = mismatches.length === 0
    ? 'BloomSuite Reconciliation — all clean'
    : `BloomSuite Reconciliation — ${mismatches.length} item${mismatches.length === 1 ? '' : 's'} need attention`

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
    <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;border-top:1px solid #e5e7eb;padding-top:16px;">This reconciliation runs automatically. Only items that need human attention are shown.</p>
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
    JSON.stringify({ mismatches_found: mismatches.length, mismatches }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
