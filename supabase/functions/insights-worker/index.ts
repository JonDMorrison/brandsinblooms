
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.38.0'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  try {
    console.log('Insights worker starting...')
    
    // Get published posts from 24-48 hours ago that need insights
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const { data: scheduledPosts, error: fetchError } = await supabaseAdmin
      .from('scheduled_posts')
      .select(`
        id,
        user_id,
        platform,
        published_id,
        insights_fetched,
        social_connections!inner (
          access_token,
          platform_account_id
        )
      `)
      .eq('status', 'PUBLISHED')
      .eq('insights_fetched', false)
      .gte('publish_at', twoDaysAgo.toISOString())
      .lte('publish_at', yesterday.toISOString())
      .limit(50)

    if (fetchError) {
      console.error('Error fetching posts for insights:', fetchError)
      return new Response('Error fetching posts', { status: 500 })
    }

    console.log(`Found ${scheduledPosts?.length || 0} posts to collect insights for`)

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return new Response('No posts need insights collection', { status: 200 })
    }

    for (const post of scheduledPosts) {
      try {
        console.log(`Collecting insights for post ${post.id} on ${post.platform}`)
        
        const connection = post.social_connections
        let insights = null

        if (post.platform === 'FB') {
          insights = await fetchFacebookInsights(post.published_id, connection.access_token)
        } else if (post.platform.startsWith('IG_')) {
          insights = await fetchInstagramInsights(post.published_id, connection.access_token)
        }

        if (insights) {
          // Store insights in post_metrics table
          await supabaseAdmin
            .from('post_metrics')
            .insert({
              scheduled_id: post.id,
              impressions: insights.impressions || 0,
              reach: insights.reach || 0,
              likes: insights.likes || 0,
              comments: insights.comments || 0
            })

          // Mark insights as fetched
          await supabaseAdmin
            .from('scheduled_posts')
            .update({ insights_fetched: true })
            .eq('id', post.id)

          console.log(`Successfully collected insights for post ${post.id}`)
        }

      } catch (error) {
        console.error(`Error collecting insights for post ${post.id}:`, error)
        
        // Mark as fetched even if failed to avoid retry loops
        await supabaseAdmin
          .from('scheduled_posts')
          .update({ insights_fetched: true })
          .eq('id', post.id)
      }
    }

    return new Response(`Processed insights for ${scheduledPosts.length} posts`, { status: 200 })

  } catch (error) {
    console.error('Insights worker error:', error)
    return new Response('Worker error', { status: 500 })
  }
})

async function fetchFacebookInsights(postId: string, accessToken: string) {
  const url = `https://graph.facebook.com/v19.0/${postId}/insights?metric=post_impressions,post_engaged_users&access_token=${accessToken}`
  
  const response = await fetch(url)
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Facebook insights API error')
  }
  
  const insights: any = {}
  data.data?.forEach((metric: any) => {
    if (metric.name === 'post_impressions') {
      insights.impressions = metric.values?.[0]?.value || 0
    } else if (metric.name === 'post_engaged_users') {
      insights.reach = metric.values?.[0]?.value || 0
    }
  })
  
  return insights
}

async function fetchInstagramInsights(postId: string, accessToken: string) {
  const url = `https://graph.facebook.com/v19.0/${postId}/insights?metric=impressions,reach,likes,comments&access_token=${accessToken}`
  
  const response = await fetch(url)
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Instagram insights API error')
  }
  
  const insights: any = {}
  data.data?.forEach((metric: any) => {
    insights[metric.name] = metric.values?.[0]?.value || 0
  })
  
  return insights
}
