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

    if (['Lead', 'Trial'].includes(notionStage)) {
      mismatches.push({
        stripe_customer_id: stripeCustomerId,
        customer_email: email,
        stripe_status: 'active',
        notion_stage: notionStage,
        mismatch_type: 'active_not_in_notion'
      })
    }

    if (['Won', 'Account Setup & Welcome', 'Onboarding & Setup', 'Active'].includes(notionStage) && !wonDate) {
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
          and: [
            {
              or: [
                { property: 'External ID', rich_text: { equals: stripeCustomerId } },
                ...(email ? [{ property: 'Email', email: { equals: email } }] : [])
              ]
            },
            { property: 'Stage', select: { equals: 'Active' } }
          ]
        }
      })
    })
    const notionData = await notionRes.json()

    if (notionData.results?.length > 0) {
      mismatches.push({
        stripe_customer_id: stripeCustomerId,
        customer_email: email,
        stripe_status: 'canceled',
        notion_stage: 'Active',
        mismatch_type: 'cancelled_still_active'
      })
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

    const mismatchList = mismatches.map(m =>
      `<li><strong>${m.customer_email || m.stripe_customer_id}</strong>: ${m.mismatch_type} (Stripe: ${m.stripe_status}, Notion: ${m.notion_stage})</li>`
    ).join('')

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'BloomSuite System <system@bloomsuite.app>',
        to: INTERNAL_ALERT_EMAIL,
        subject: `⚠️ BloomSuite: ${mismatches.length} reconciliation issue(s) detected`,
        html: `<h2>Reconciliation Report</h2><p>${mismatches.length} mismatch(es) found:</p><ul>${mismatchList}</ul>`
      })
    })
  }

  return new Response(
    JSON.stringify({ mismatches_found: mismatches.length, mismatches }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
