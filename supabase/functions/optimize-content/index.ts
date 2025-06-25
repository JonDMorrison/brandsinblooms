
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { content, platform } = await req.json()
    
    if (!content || !platform) {
      throw new Error('Content and platform are required')
    }

    // Analyze content and generate suggestions
    const suggestions = analyzeContentForPlatform(content, platform)
    const optimizedContent = optimizeContentForPlatform(content, platform, suggestions)

    return new Response(
      JSON.stringify({ 
        suggestions,
        optimizedContent,
        platform 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error optimizing content:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function analyzeContentForPlatform(content: string, platform: string) {
  const suggestions = []
  const wordCount = content.split(' ').length
  const hasHashtags = content.includes('#')
  const hasQuestion = content.includes('?')
  const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(content)

  // Platform-specific analysis
  if (platform === 'instagram') {
    if (!hasHashtags) {
      suggestions.push({
        type: 'hashtags',
        title: 'Add Instagram hashtags',
        description: 'Instagram posts with hashtags get 12.6% more engagement',
        action: 'Add 5-10 relevant hashtags at the end of your post'
      })
    }

    if (wordCount > 50) {
      suggestions.push({
        type: 'content',
        title: 'Consider shortening',
        description: 'Instagram users prefer concise, visual content',
        action: 'Try to keep captions under 50 words for better engagement'
      })
    }

    if (!hasEmojis) {
      suggestions.push({
        type: 'content',
        title: 'Add emojis',
        description: 'Posts with emojis get 48% more engagement on Instagram',
        action: 'Add 2-3 relevant emojis to make your post more engaging'
      })
    }
  } else if (platform === 'facebook') {
    if (wordCount < 20) {
      suggestions.push({
        type: 'content',
        title: 'Add more context',
        description: 'Facebook users engage more with posts that tell a story',
        action: 'Expand your post to provide more context and value'
      })
    }

    if (!hasQuestion) {
      suggestions.push({
        type: 'content',
        title: 'Add a call-to-action',
        description: 'Posts with questions get 23% more comments',
        action: 'End with a question like "What do you think?" or "Share your experience!"'
      })
    }
  }

  // Universal suggestions
  if (wordCount > 100) {
    suggestions.push({
      type: 'content',
      title: 'Break into paragraphs',
      description: 'Long text blocks are harder to read on mobile',
      action: 'Use line breaks to make your content more scannable'
    })
  }

  // Add timing suggestion
  suggestions.push({
    type: 'timing',
    title: 'Optimal posting time',
    description: `Best time to post on ${platform} is typically 6-9 PM`,
  })

  return suggestions
}

function optimizeContentForPlatform(content: string, platform: string, suggestions: any[]) {
  let optimized = content

  // Apply automatic optimizations based on suggestions
  if (platform === 'instagram') {
    // Add line breaks for readability
    optimized = optimized.replace(/\. /g, '.\n\n')
    
    // Add suggested hashtags if none exist
    if (!content.includes('#')) {
      optimized += '\n\n#socialmedia #contentcreator #digitalmarketing #engagement #growth'
    }
  } else if (platform === 'facebook') {
    // Add a question if none exists
    if (!content.includes('?')) {
      optimized += '\n\nWhat are your thoughts on this? Share in the comments below! 👇'
    }
  }

  // Ensure proper formatting
  optimized = optimized.trim()
  
  return optimized
}
