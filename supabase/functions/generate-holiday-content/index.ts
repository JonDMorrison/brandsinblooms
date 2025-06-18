
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
    // Check if OpenAI API key is available
    const openAIKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIKey) {
      console.error('OpenAI API key not found in environment variables')
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your Supabase project secrets.' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

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
      console.error('Holiday ID is required but not provided')
      return new Response(
        JSON.stringify({ error: 'Holiday ID is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    console.log('Processing holiday content generation for ID:', holiday_id)

    // Get the holiday details with correct schema
    const { data: holiday, error: holidayError } = await supabaseClient
      .from('holidays')
      .select('*')
      .eq('id', holiday_id)
      .single()

    if (holidayError || !holiday) {
      console.error('Holiday not found:', holidayError)
      return new Response(
        JSON.stringify({ error: `Holiday not found: ${holidayError?.message || 'Unknown error'}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
    }

    console.log('Found holiday:', holiday.holiday_name)

    // Get user's company profile for personalization
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      console.error('User not authenticated')
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    const { data: profile } = await supabaseClient
      .from('company_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log('User profile:', profile?.company_name || 'No profile found')

    // Generate content using OpenAI
    console.log('Calling OpenAI API...')
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
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
Category: ${holiday.category}
Date: ${holiday.holiday_date}
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
      const errorText = await openAIResponse.text()
      console.error('OpenAI API error:', openAIResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: `OpenAI API error (${openAIResponse.status}): ${errorText}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    const openAIData = await openAIResponse.json()
    
    if (!openAIData.choices || !openAIData.choices[0] || !openAIData.choices[0].message) {
      console.error('Invalid OpenAI response structure:', openAIData)
      return new Response(
        JSON.stringify({ error: 'Invalid response from OpenAI API' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    let generatedContent
    try {
      generatedContent = JSON.parse(openAIData.choices[0].message.content)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError)
      console.error('Raw content:', openAIData.choices[0].message.content)
      return new Response(
        JSON.stringify({ error: 'Failed to parse generated content as JSON' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    console.log('Generated content types:', Object.keys(generatedContent))

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
      scheduled_date: getScheduledDate(holiday.holiday_date, holiday.category),
      hashtags: getHolidayHashtags(holiday.holiday_name, type),
      image_idea: getHolidayImageIdea(holiday.holiday_name, type)
    }))

    console.log('Creating tasks:', tasksToCreate.length)

    const { data: createdTasks, error: tasksError } = await supabaseClient
      .from('content_tasks')
      .insert(tasksToCreate)
      .select()

    if (tasksError) {
      console.error('Tasks creation error:', tasksError)
      return new Response(
        JSON.stringify({ error: `Failed to create content tasks: ${tasksError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    console.log('Created tasks successfully:', createdTasks?.length || 0)

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
      JSON.stringify({ error: `Unexpected error: ${error.message}` }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

function getScheduledDate(holidayDate: string, category: string): string {
  const today = new Date()
  const targetDate = new Date(holidayDate)
  
  // For specific dates, schedule a week before for preparation
  if (category === 'Day') {
    const scheduleDate = new Date(targetDate)
    scheduleDate.setDate(targetDate.getDate() - 7)
    return scheduleDate.toISOString().split('T')[0]
  }
  
  // For months, schedule for the beginning of that month
  if (category === 'Month') {
    const scheduleDate = new Date(targetDate)
    scheduleDate.setDate(1)
    return scheduleDate.toISOString().split('T')[0]
  }
  
  // For weeks, schedule at the start of the week
  if (category === 'Week') {
    return targetDate.toISOString().split('T')[0]
  }
  
  // Default to the holiday date itself
  return holidayDate
}

function getHolidayHashtags(holidayName: string, contentType: string): string {
  const baseHashtags = ['#GardenCenter', '#Plants', '#Gardening']
  const holidaySpecific = {
    'Earth Day': ['#EarthDay', '#EcoFriendly', '#Sustainability', '#GreenLiving'],
    'Arbor Day': ['#ArborDay', '#TreePlanting', '#Trees', '#Conservation'],
    'World Bee Day': ['#WorldBeeDay', '#Pollinators', '#SaveTheBees', '#BeeGarden'],
    'National Garden Month': ['#GardenMonth', '#PlantSeason', '#GreenThumb'],
    'National Rose Month': ['#RoseMonth', '#Roses', '#FlowerGarden'],
    'National Indoor Plant Month': ['#IndoorPlants', '#Houseplants', '#PlantParent'],
    'Mother\'s Day': ['#MothersDay', '#FlowersForMom', '#GardenGifts'],
    'Father\'s Day': ['#FathersDay', '#GardenDad', '#PlantGifts'],
    'Valentine\'s Day': ['#ValentinesDay', '#LovePlants', '#RomanticGarden']
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
    'National Indoor Plant Month': 'Collection of healthy houseplants in decorative containers',
    'Mother\'s Day': 'Beautiful flowering hanging baskets and colorful spring planters',
    'Father\'s Day': 'Garden tools with vegetable plants and herbs arranged attractively',
    'Valentine\'s Day': 'Romantic red and pink flowering plants with heart-shaped planters'
  }
  
  for (const [key, idea] of Object.entries(imageIdeas)) {
    if (holidayName.includes(key.replace('National ', '').replace('World ', ''))) {
      return idea
    }
  }
  
  return 'Seasonal garden display appropriate for the holiday theme with relevant plants and decorations'
}
