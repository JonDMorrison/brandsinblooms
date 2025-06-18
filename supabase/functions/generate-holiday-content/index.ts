import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Add connection diagnostics
  console.log('🚀 Holiday content generation function started');
  console.log('📊 Function environment check:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: Object.fromEntries(req.headers.entries())
  });

  try {
    // Environment validation with detailed logging
    const openAIKey = Deno.env.get('OPENAI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    console.log('🔑 Environment variables check:', {
      openAI: openAIKey ? 'Present' : 'Missing',
      supabaseUrl: supabaseUrl ? 'Present' : 'Missing',
      supabaseKey: supabaseKey ? 'Present' : 'Missing'
    });

    if (!openAIKey) {
      console.error('❌ OpenAI API key not found in environment variables')
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your Supabase project secrets.',
          code: 'MISSING_OPENAI_KEY',
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase environment variables missing')
      return new Response(
        JSON.stringify({ 
          error: 'Supabase configuration missing',
          code: 'MISSING_SUPABASE_CONFIG',
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = await req.json()
      console.log('📝 Request body parsed:', requestBody);
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request body format',
          code: 'INVALID_REQUEST_BODY',
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    const { holiday_id } = requestBody
    
    if (!holiday_id) {
      console.error('❌ Holiday ID is required but not provided')
      return new Response(
        JSON.stringify({ 
          error: 'Holiday ID is required',
          code: 'MISSING_HOLIDAY_ID',
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    console.log('🎯 Processing holiday content generation for ID:', holiday_id);

    // Initialize Supabase client with error handling
    let supabaseClient;
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      })
      console.log('✅ Supabase client initialized successfully');
    } catch (clientError) {
      console.error('❌ Failed to initialize Supabase client:', clientError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to initialize database connection',
          code: 'SUPABASE_CLIENT_ERROR',
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // Get the holiday details
    console.log('🔍 Fetching holiday details...');
    const { data: holiday, error: holidayError } = await supabaseClient
      .from('holidays')
      .select('*')
      .eq('id', holiday_id)
      .single()

    if (holidayError || !holiday) {
      console.error('❌ Holiday not found:', holidayError);
      return new Response(
        JSON.stringify({ 
          error: `Holiday not found: ${holidayError?.message || 'Unknown error'}`,
          code: 'HOLIDAY_NOT_FOUND',
          holidayId: holiday_id,
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
    }

    console.log('✅ Found holiday:', holiday.holiday_name);

    // Get user authentication
    console.log('🔐 Checking user authentication...');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      console.error('❌ User authentication failed:', authError);
      return new Response(
        JSON.stringify({ 
          error: 'User not authenticated',
          code: 'AUTH_FAILED',
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    console.log('✅ User authenticated:', user.id);

    // Get user's company profile
    const { data: profile } = await supabaseClient
      .from('company_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log('👤 User profile:', profile?.company_name || 'No profile found');

    // Generate content using OpenAI with retry logic
    console.log('🤖 Calling OpenAI API...');
    
    let openAIResponse;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
        
        if (openAIResponse.ok) {
          console.log('✅ OpenAI API call successful');
          break;
        } else {
          throw new Error(`OpenAI API error: ${openAIResponse.status} ${openAIResponse.statusText}`);
        }
      } catch (openAIError) {
        retryCount++;
        console.error(`❌ OpenAI API attempt ${retryCount} failed:`, openAIError);
        
        if (retryCount > maxRetries) {
          return new Response(
            JSON.stringify({ 
              error: `OpenAI API failed after ${maxRetries + 1} attempts: ${openAIError.message}`,
              code: 'OPENAI_API_ERROR',
              retryCount,
              timestamp: new Date().toISOString()
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            }
          )
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    const openAIData = await openAIResponse.json()
    
    if (!openAIData.choices || !openAIData.choices[0] || !openAIData.choices[0].message) {
      console.error('❌ Invalid OpenAI response structure:', openAIData);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid response from OpenAI API',
          code: 'INVALID_OPENAI_RESPONSE',
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    let generatedContent
    try {
      generatedContent = JSON.parse(openAIData.choices[0].message.content)
      console.log('✅ Generated content types:', Object.keys(generatedContent));
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response as JSON:', parseError);
      console.error('Raw content:', openAIData.choices[0].message.content);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse generated content as JSON',
          code: 'CONTENT_PARSE_ERROR',
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // Create content tasks
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

    console.log('📝 Creating tasks:', tasksToCreate.length);

    const { data: createdTasks, error: tasksError } = await supabaseClient
      .from('content_tasks')
      .insert(tasksToCreate)
      .select()

    if (tasksError) {
      console.error('❌ Tasks creation error:', tasksError);
      return new Response(
        JSON.stringify({ 
          error: `Failed to create content tasks: ${tasksError.message}`,
          code: 'TASK_CREATION_ERROR',
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    console.log('✅ Created tasks successfully:', createdTasks?.length || 0);

    return new Response(
      JSON.stringify({ 
        success: true, 
        holiday: holiday,
        tasks: createdTasks,
        message: `Generated ${createdTasks.length} pieces of content for ${holiday.holiday_name}`,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('💥 Unexpected error in holiday content generation:', error);
    return new Response(
      JSON.stringify({ 
        error: `Unexpected error: ${error.message}`,
        code: 'UNEXPECTED_ERROR',
        stack: error.stack,
        timestamp: new Date().toISOString()
      }),
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
