const NOTION_TOKEN = Deno.env.get('NOTION_TOKEN')!
const NOTION_DB_ID = Deno.env.get('NOTION_PIPELINE_DB_ID')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const INTERNAL_ALERT_EMAIL = Deno.env.get('INTERNAL_ALERT_EMAIL') || 'jon@getclear.ca'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const notionHeaders = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28'
}

export async function findNotionRecord(externalId?: string, email?: string): Promise<string | null> {
  if (externalId) {
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders,
      body: JSON.stringify({
        filter: { property: 'External ID', rich_text: { equals: externalId } }
      })
    })
    const data = await res.json()
    if (data.results?.length > 0) return data.results[0].id
  }
  if (email) {
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders,
      body: JSON.stringify({
        filter: { property: 'Email', email: { equals: email } }
      })
    })
    const data = await res.json()
    if (data.results?.length > 0) return data.results[0].id
  }
  return null
}

export async function updateNotionRecord(
  pageId: string,
  properties: Record<string, any>,
  context: string
): Promise<boolean> {
  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: notionHeaders,
        body: JSON.stringify({ properties })
      })
      if (res.ok) return true
      const error = await res.json()
      throw new Error(`Notion API error: ${JSON.stringify(error)}`)
    } catch (err: any) {
      console.error(`[${context}] Attempt ${attempt} failed:`, err)
      if (attempt === maxRetries) {
        await logError(context, err.message, { pageId, properties })
        await createBrokenRecord(context, err.message, pageId)
        await sendInternalAlert(context, err.message, pageId)
        return false
      }
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
    }
  }
  return false
}

export async function createNotionRecord(
  properties: Record<string, any>,
  context: string
): Promise<string | null> {
  const maxRetries = 3
  let lastError = ''
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const requestBody = {
        parent: { database_id: NOTION_DB_ID },
        properties
      }
      console.log(`[${context}] Create attempt ${attempt} request:`, JSON.stringify(requestBody))
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify(requestBody)
      })
      if (res.ok) {
        const data = await res.json()
        return data.id
      }
      const errorBody = await res.text()
      lastError = `Notion API ${res.status}: ${errorBody}`
      console.error(`[${context}] Create attempt ${attempt} failed — ${res.status}: ${errorBody}`)
      throw new Error(lastError)
    } catch (err: any) {
      lastError = lastError || err.message
      console.error(`[${context}] Create attempt ${attempt} error:`, err.message)
      if (attempt === maxRetries) {
        await logError(context, lastError, { properties })
        await sendInternalAlert(context, lastError, null)
        createNotionRecord.lastError = lastError
        return null
      }
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
    }
  }
  return null
}
createNotionRecord.lastError = ''

async function createBrokenRecord(context: string, errorMsg: string, originalPageId?: string): Promise<void> {
  try {
    await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: notionHeaders,
      body: JSON.stringify({
        parent: { database_id: NOTION_DB_ID },
        properties: {
          'Garden Center': { title: [{ text: { content: `⚠️ BROKEN — ${context}` } }] },
          'Stage': { select: { name: '⚠️ Broken' } },
          'Notes': { rich_text: [{ text: { content: `Error: ${errorMsg}\n\nOriginal page: ${originalPageId || 'unknown'}\n\nTime: ${new Date().toISOString()}` } }] },
          'Next Action': { rich_text: [{ text: { content: 'Investigate and resolve automation failure' } }] },
          'Next Action Date': { date: { start: new Date().toISOString().split('T')[0] } }
        }
      })
    })
  } catch (e) {
    console.error('Failed to create broken record:', e)
  }
}

async function logError(functionName: string, errorMessage: string, payload: any): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/edge_function_errors`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ function_name: functionName, error_message: errorMessage, payload })
    })
  } catch (e) {
    console.error('Failed to log error:', e)
  }
}

async function sendInternalAlert(context: string, errorMsg: string, pageId?: string | null): Promise<void> {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'BloomSuite System <system@bloomsuite.app>',
        to: INTERNAL_ALERT_EMAIL,
        subject: `⚠️ BloomSuite Automation Failure: ${context}`,
        html: `<p><strong>Function:</strong> ${context}</p><p><strong>Error:</strong> ${errorMsg}</p><p><strong>Page ID:</strong> ${pageId || 'N/A'}</p><p><strong>Time:</strong> ${new Date().toISOString()}</p><p>A broken record has been created in the Notion pipeline.</p>`
      })
    })
  } catch (e) {
    console.error('Failed to send internal alert:', e)
  }
}
