
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { holiday_id } = await req.json()
    
    if (!holiday_id) {
      throw new Error('Holiday ID is required')
    }

    // Get the holiday details with new schema
    const { data: holiday, error: holidayError } = await supabaseClient
      .from('holidays')
      .select('*')
      .eq('id', holiday_id)
      .single()

    if (holidayError || !holiday) {
      throw new Error('Holiday not found')
    }

    // Get user's company profile for personalization
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data: profile } = await supabaseClient
      .from('company_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Generate content using OpenAI
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a marketing content generator for garden centers and nurseries. Generate professional, engaging content for ${holiday.name} that relates to gardening and plants. Keep content concise, actionable, and avoid emojis. Focus on seasonal relevance and practical gardening advice.`
          },
          {
            role: 'user',
            content: `Generate 5 pieces of content for ${holiday.name} (${holiday.when}) for a garden center:

1. Facebook Post (2-3 sentences, engaging and shareable)
2. Instagram Post (2-3 sentences, visual-focused)
3. Video Script (90 seconds, conversational tone)
4. Newsletter Section (150-200 words, informative)
5. Blog Introduction (250 words, educational)

Holiday context: ${holiday.description}
Category: ${holiday.category}
Timing: ${holiday.when}
${profile?.company_name ? `Business: ${profile.company_name}` : ''}
${profile?.brand_voice ? `Brand voice: ${profile.brand_voice}` : ''}

Format the response as JSON with keys: facebook, instagram, video, newsletter, blog`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!openAIResponse.ok) {
      throw new Error('Failed to generate content with OpenAI')
    }

    const openAIData = await openAIResponse.json()
    const generatedContent = JSON.parse(openAIData.choices[0].message.content)

    // Create content tasks for each type
    const contentTypes = [
      { type: 'facebook', content: generatedContent.facebook },
      { type: 'instagram', content: generatedContent.instagram },
      { type: 'video', content: generatedContent.video },
      { type: 'newsletter', content: generatedContent.newsletter },
      { type: 'blog', content: generatedContent.blog }
    ]

    const tasksToCreate = contentTypes.map(({ type, content }) => ({
      user_id: user.id,
      holiday_id: holiday_id,
      post_type: type,
      ai_output: content,
      status: 'review',
      scheduled_date: getScheduledDate(holiday.when, holiday.category),
      hashtags: getHolidayHashtags(holiday.name, type),
      image_idea: getHolidayImageIdea(holiday.name, type)
    }))

    const { data: createdTasks, error: tasksError } = await supabaseClient
      .from('content_tasks')
      .insert(tasksToCreate)
      .select()

    if (tasksError) {
      throw new Error(`Failed to create content tasks: ${tasksError.message}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        holiday: holiday,
        tasks: createdTasks,
        message: `Generated ${createdTasks.length} pieces of content for ${holiday.name}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error generating holiday content:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})

function getScheduledDate(when: string, category: string): string {
  const today = new Date()
  
  // For specific dates, use those
  if (when.includes('-')) {
    return when
  }
  
  // For months, schedule for the beginning of that month
  if (category === 'Month') {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']
    const monthIndex = months.findIndex(m => when.includes(m))
    if (monthIndex !== -1) {
      const year = today.getFullYear()
      const targetMonth = monthIndex
      return new Date(year, targetMonth, 1).toISOString().split('T')[0]
    }
  }
  
  // Default to next week
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)
  return nextWeek.toISOString().split('T')[0]
}

function getHolidayHashtags(holidayName: string, contentType: string): string {
  const baseHashtags = ['#GardenCenter', '#Plants', '#Gardening']
  const holidaySpecific = {
    'Earth Day': ['#EarthDay', '#EcoFriendly', '#Sustainability', '#GreenLiving'],
    'Arbor Day': ['#ArborDay', '#TreePlanting', '#Trees', '#Conservation'],
    'World Bee Day': ['#WorldBeeDay', '#Pollinators', '#SaveTheBees', '#BeeGarden'],
    'National Garden Month': ['#GardenMonth', '#PlantSeason', '#GreenThumb'],
    'National Rose Month': ['#RoseMonth', '#Roses', '#FlowerGarden'],
    'National Indoor Plant Month': ['#IndoorPlants', '#Houseplants', '#PlantParent']
  }
  
  let specific = ['#SeasonalGardening']
  for (const [key, tags] of Object.entries(holidaySpecific)) {
    if (holidayName.includes(key.replace('National ', '').replace('World ', ''))) {
      specific = tags
      break
    }
  }
  
  return [...baseHashtags, ...specific].join(' ')
}

function getHolidayImageIdea(holidayName: string, contentType: string): string {
  const imageIdeas = {
    'Earth Day': 'Hands planting seedlings in rich soil with composting materials nearby',
    'Arbor Day': 'Young tree being planted with gardening tools and fresh soil',
    'World Bee Day': 'Bee-friendly flowers in bloom with pollinator garden display',
    'National Garden Month': 'Vibrant garden beds with diverse plants and flowers in peak condition',
    'National Rose Month': 'Beautiful rose garden display with various colored roses',
    'National Indoor Plant Month': 'Collection of healthy houseplants in decorative containers'
  }
  
  for (const [key, idea] of Object.entries(imageIdeas)) {
    if (holidayName.includes(key.replace('National ', '').replace('World ', ''))) {
      return idea
    }
  }
  
  return 'Seasonal garden display appropriate for the holiday theme'
}
