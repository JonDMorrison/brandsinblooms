
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function getFacebookInsights(postId: string, accessToken: string) {
  const url = `https://graph.facebook.com/v19.0/${postId}/insights?metric=post_impressions,post_engaged_users&access_token=${accessToken}`
  
  const response = await fetch(url)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error?.message || 'Facebook insights API error')
  }
  
  const insights = {
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0
  }
  
  if (result.data) {
    for (const metric of result.data) {
      if (metric.name === 'post_impressions') {
        insights.impressions = metric.values[0]?.value || 0
      } else if (metric.name === 'post_engaged_users') {
        insights.reach = metric.values[0]?.value || 0
      }
    }
  }
  
  return insights
}

async function getInstagramInsights(mediaId: string, accessToken: string) {
  const url = `https://graph.facebook.com/v19.0/${mediaId}/insights?metric=impressions,reach,likes,comments&access_token=${accessToken}`
  
  const response = await fetch(url)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error?.message || 'Instagram insights API error')
  }
  
  const insights = {
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0
  }
  
  if (result.data) {
    for (const metric of result.data) {
      if (metric.name === 'impressions') {
        insights.impressions = metric.values[0]?.value || 0
      } else if (metric.name === 'reach') {
        insights.reach = metric.values[0]?.value || 0
      } else if (metric.name === 'likes') {
        insights.likes = metric.values[0]?.value || 0
      } else if (metric.name === 'comments') {
        insights.comments = metric.values[0]?.value || 0
      }
    }
  }
  
  return insights
}

serve(async (req) => {
  try {
    console.log('Insights worker starting...')
    
    // Get published posts that haven't had insights fetched yet (and are at least 1 hour old)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data: publishedPosts, error: fetchError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('id, user_id, platform, published_id, updated_at')
      .eq('status', 'PUBLISHED')
      .eq('insights_fetched', false)
      .not('published_id', 'is', null)
      .lt('updated_at', oneHourAgo)
      .limit(50)

    if (fetchError) {
      console.error('Error fetching published posts:', fetchError)
      return new Response('Error fetching posts', { status: 500 })
    }

    console.log(`Found ${publishedPosts?.length || 0} posts to fetch insights for`)

    if (!publishedPosts || publishedPosts.length === 0) {
      return new Response('No posts need insights', { status: 200 })
    }

    for (const post of publishedPosts) {
      try {
        console.log(`Fetching insights for post ${post.id} on ${post.platform}`)
        
        // Get social connection
        const { data: connection, error: connectionError } = await supabaseAdmin
          .from('social_connections')
          .select('access_token')
          .eq('user_id', post.user_id)
          .eq('platform', post.platform.toLowerCase())
          .eq('is_active', true)
          .single()

        if (connectionError || !connection) {
          console.log(`No active connection for ${post.platform}, skipping insights`)
          continue
        }

        let insights
        
        if (post.platform === 'FB') {
          insights = await getFacebookInsights(post.published_id, connection.access_token)
        } else if (post.platform.startsWith('IG_')) {
          insights = await getInstagramInsights(post.published_id, connection.access_token)
        } else {
          console.log(`Unsupported platform for insights: ${post.platform}`)
          continue
        }

        // Insert post metrics
        await supabaseAdmin
          .from('post_metrics')
          .insert({
            scheduled_id: post.id,
            impressions: insights.impressions,
            reach: insights.reach,
            likes: insights.likes,
            comments: insights.comments
          })

        // Mark insights as fetched
        await supabaseAdmin
          .from('scheduled_posts')
          .update({ insights_fetched: true })
          .eq('id', post.id)

        console.log(`Successfully fetched insights for post ${post.id}`)

      } catch (error) {
        console.error(`Error fetching insights for post ${post.id}:`, error)
        
        // Mark as fetched even on error to prevent infinite retries
        await supabaseAdmin
          .from('scheduled_posts')
          .update({ insights_fetched: true })
          .eq('id', post.id)
      }
    }

    return new Response(`Processed insights for ${publishedPosts.length} posts`, { status: 200 })

  } catch (error) {
    console.error('Insights worker error:', error)
    return new Response('Worker error', { status: 500 })
  }
})
