
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

    // Get the holiday details
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
            content: `You are a marketing content generator for garden centers and nurseries. Generate professional, engaging content for ${holiday.holiday_name} that relates to gardening and plants. Keep content concise, actionable, and avoid emojis. Focus on seasonal relevance and practical gardening advice.`
          },
          {
            role: 'user',
            content: `Generate 5 pieces of content for ${holiday.holiday_name} (${holiday.holiday_date}) for a garden center:

1. Facebook Post (2-3 sentences, engaging and shareable)
2. Instagram Post (2-3 sentences, visual-focused)
3. Video Script (90 seconds, conversational tone)
4. Newsletter Section (150-200 words, informative)
5. Blog Introduction (250 words, educational)

Holiday context: ${holiday.description}
Garden relevance: ${holiday.garden_relevance}
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
      scheduled_date: holiday.holiday_date,
      hashtags: getHolidayHashtags(holiday.holiday_name, type),
      image_idea: getHolidayImageIdea(holiday.holiday_name, type)
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
        message: `Generated ${createdTasks.length} pieces of content for ${holiday.holiday_name}`
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

function getHolidayHashtags(holidayName: string, contentType: string): string {
  const baseHashtags = ['#GardenCenter', '#Plants', '#Gardening']
  const holidaySpecific = {
    'Earth Day': ['#EarthDay', '#EcoFriendly', '#Sustainability', '#GreenLiving'],
    'Mother\'s Day': ['#MothersDay', '#FlowersForMom', '#GardenGifts', '#MomLove'],
    'Memorial Day Weekend': ['#MemorialDay', '#SummerGardening', '#PatrioticPlants'],
    'Summer Solstice': ['#SummerSolstice', '#SummerGarden', '#LongestDay'],
    'Independence Day': ['#July4th', '#PatrioticGarden', '#RedWhiteBlue'],
    'Labor Day Weekend': ['#LaborDay', '#FallGardening', '#SeasonTransition'],
    'Halloween': ['#Halloween', '#FallDecor', '#Pumpkins', '#AutumnGarden'],
    'Thanksgiving': ['#Thanksgiving', '#HarvestSeason', '#FallCenterpieces']
  }
  
  const specific = holidaySpecific[holidayName] || ['#SeasonalGardening']
  return [...baseHashtags, ...specific].join(' ')
}

function getHolidayImageIdea(holidayName: string, contentType: string): string {
  const imageIdeas = {
    'Earth Day': 'Hands planting seedlings in rich soil with composting materials nearby',
    'Mother\'s Day': 'Beautiful bouquet of fresh flowers from the garden center with gift wrapping',
    'Memorial Day Weekend': 'Red, white, and blue flower arrangements with American flag in garden setting',
    'Summer Solstice': 'Vibrant sun-loving plants in full bloom during golden hour lighting',
    'Independence Day': 'Patriotic themed garden containers with red geraniums, white petunias, blue lobelia',
    'Labor Day Weekend': 'Fall planting scene with mums, pumpkins, and autumn decorations',
    'Halloween': 'Spooky garden display with carved pumpkins, fall mums, and autumn leaves',
    'Thanksgiving': 'Harvest themed centerpiece with gourds, fall flowers, and seasonal produce'
  }
  
  return imageIdeas[holidayName] || 'Seasonal garden display appropriate for the holiday'
}
