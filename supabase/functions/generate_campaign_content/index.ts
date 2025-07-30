
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Define all 5 required content types
const REQUIRED_CONTENT_TYPES = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    const { campaign_id, campaign_title, description, user_id, week_number, tenant_id } = await req.json();
    
    console.log('🎯 Generating campaign content for:', { campaign_id, campaign_title, user_id, tenant_id });

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company profile for context
    let companyProfile = null;
    if (user_id) {
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user_id)
        .single();
      companyProfile = profile;
    }

    const businessName = companyProfile?.company_name || 'Your Garden Center';
    const businessContext = companyProfile?.company_overview || 'A local garden center helping customers grow beautiful gardens';

    console.log('📝 Generating content for all 5 required types in parallel:', REQUIRED_CONTENT_TYPES);

    // Check for existing content to prevent duplicates
    const { data: existingTasks } = await supabase
      .from('content_tasks')
      .select('post_type')
      .eq('campaign_id', campaign_id)
      .in('post_type', REQUIRED_CONTENT_TYPES);

    const existingTypes = existingTasks?.map(task => task.post_type) || [];
    const typesToGenerate = REQUIRED_CONTENT_TYPES.filter(type => !existingTypes.includes(type));
    
    if (typesToGenerate.length === 0) {
      console.log('⚠️ All content types already exist for this campaign');
      return corsJsonResponse({
        success: true,
        tasks: [],
        message: 'All content types already exist for this campaign'
      });
    }

    console.log(`📝 Generating content for missing types: ${typesToGenerate.join(', ')}`);

    // Define content prompts with strict topic adherence
    const contentPrompts = {
      instagram: `Create an engaging Instagram post specifically about "${campaign_title}" for ${businessName}. 

      CRITICAL REQUIREMENT: Your content MUST be entirely focused on "${campaign_title}". 
      - Do NOT mix in generic gardening advice unless directly related to this specific topic
      - If the topic is "National Honey Month", focus ONLY on bees, pollinators, honey, bee-friendly plants
      - If the topic mentions specific plants, focus ONLY on those plants
      
      Structure:
      - Opening hook specific to "${campaign_title}"
      - 2-3 specific tips or insights about this exact topic
      - Relevant hashtags using topic keywords
      - Call-to-action mentioning the specific topic
      
      Do NOT use any emojis. Stay laser-focused on the exact topic provided.`,
      
      facebook: `Write a Facebook post specifically about "${campaign_title}" for ${businessName}. 

      CRITICAL REQUIREMENT: Focus EXCLUSIVELY on "${campaign_title}". Do not dilute with general advice.
      
      Structure:
      - Opening question or statement specifically about "${campaign_title}"
      - 2-3 specific insights or tips related only to this topic
      - Community engagement question about this specific topic
      - Call-to-action that mentions "${campaign_title}"
      
      If the topic is specific (like "National Honey Month"), every sentence should relate to that theme.
      Do NOT use any emojis. Stay completely focused on the provided topic.`,
      
      blog: `Write a comprehensive blog post exclusively about "${campaign_title}" for ${businessName}. 

      CRITICAL REQUIREMENT: Every section must relate directly to "${campaign_title}". Do not include generic advice.
      
      Structure:
      - Title that includes "${campaign_title}"
      - Introduction explaining why "${campaign_title}" matters now
      - 3-4 sections each diving deep into specific aspects of "${campaign_title}"
      - Each section should use keywords related to the topic
      - Conclusion reinforcing the importance of "${campaign_title}"
      
      For specific topics like "National Honey Month", focus on bee-friendly plants, pollinator gardens, honey production, etc.
      Do NOT use any emojis. Maintain laser focus on the exact topic.`,
      
      video: `Create a 90-second video script exclusively about "${campaign_title}" for ${businessName}. 

      CRITICAL REQUIREMENT: The entire script must focus on "${campaign_title}" only. No generic content.
      
      Structure:
      - Opening hook (10-15 seconds): Start with an intriguing fact about "${campaign_title}"
      - Main teaching (60-70 seconds): Share specific knowledge about this exact topic
      - Closing (15-20 seconds): Encourage action related to "${campaign_title}"
      
      For "National Honey Month": focus on bee behavior, pollinator plants, honey facts.
      Write ONLY spoken words - no scene descriptions. Stay completely on topic. Do NOT use emojis.`,
      
      newsletter: `Create a structured newsletter exclusively about "${campaign_title}" for ${businessName} in this YAML format:

      CRITICAL REQUIREMENT: Every section must relate directly to "${campaign_title}". Do NOT use seasonal defaults or generic topics.

      TOPIC ENFORCEMENT RULES:
      - If "${campaign_title}" mentions "Vegetarian Day", focus ONLY on: growing vegetables, plant-based gardens, edible plants, vegetable varieties, harvesting tips
      - If "${campaign_title}" mentions "National Honey Month", focus ONLY on: pollinators, bee-friendly plants, nectar plants, honey production
      - If "${campaign_title}" mentions specific plants, focus ONLY on those plants
      - NEVER use "Beat the Heat", "Summer Care", or other seasonal defaults unless specifically in the topic title
      - NEVER dilute the topic with generic gardening advice

      newsletter_md: |
        # ${campaign_title} Newsletter
        [Write an introduction paragraph specifically about "${campaign_title}" - explain exactly why this topic matters now. Use keywords from the topic title.]

      blocks:
        - title: "Growing [specific vegetables/plants from ${campaign_title}]"
          body: "Detailed content focusing only on the plants/topics mentioned in ${campaign_title}. Include specific varieties, care tips, and timing related to this exact topic."
          cta: "Learn more about ${campaign_title}"
          link: "#"
          image_prompt: "${campaign_title.toLowerCase().includes('vegetarian') ? 'vegetable garden growing fresh vegetables' : campaign_title.toLowerCase().includes('honey') || campaign_title.toLowerCase().includes('pollinator') ? 'honey bees pollinator garden flowers' : campaign_title + ' specific gardening'}"
          alt_text: "Image showing ${campaign_title} related content"
        - title: "[Specific aspect of ${campaign_title} - use topic keywords]"
          body: "More focused content about ${campaign_title} - address specific challenges or opportunities related to this exact topic. NO generic advice."
          cta: "Discover ${campaign_title} solutions"
          link: "#"
          image_prompt: "${campaign_title.toLowerCase().includes('vegetarian') ? 'homegrown vegetables edible plants' : campaign_title.toLowerCase().includes('honey') || campaign_title.toLowerCase().includes('pollinator') ? 'bee garden flowers pollinator plants' : campaign_title + ' garden advice'}"
          alt_text: "Image demonstrating ${campaign_title} concepts"
        - title: "[Advanced ${campaign_title} techniques]"
          body: "Expert-level advice specifically for ${campaign_title}. Share professional techniques, timing, or varieties that relate directly to this topic."
          cta: "Get expert ${campaign_title} advice"
          link: "#"
          image_prompt: "${campaign_title.toLowerCase().includes('vegetarian') ? 'professional vegetable garden techniques' : campaign_title.toLowerCase().includes('honey') || campaign_title.toLowerCase().includes('pollinator') ? 'expert pollinator garden design' : campaign_title + ' expert techniques'}"
          alt_text: "Professional ${campaign_title} techniques"
        - title: "[${campaign_title} success planning]"
          body: "Help customers plan their success with ${campaign_title}. Provide actionable next steps, timing, or resources specific to this topic."
          cta: "Plan your ${campaign_title} success"
          link: "#"
          image_prompt: "${campaign_title.toLowerCase().includes('vegetarian') ? 'vegetable garden planning success' : campaign_title.toLowerCase().includes('honey') || campaign_title.toLowerCase().includes('pollinator') ? 'pollinator garden planning' : campaign_title + ' planning success'}"
          alt_text: "${campaign_title} planning and success"

      extra_content_ideas:
        - title: "Advanced ${campaign_title} Tips"
          quick_desc: "Further exploration of ${campaign_title} techniques and strategies"

      meta:
        reading_time: "≈3 min"
        theme: "${campaign_title}"
        week_focus: "Focused exclusively on ${campaign_title} - NO seasonal defaults"
      
      VALIDATION CHECK: Before finalizing, verify that:
      1. Every section title includes keywords from "${campaign_title}"
      2. No generic seasonal content like "Beat the Heat" appears anywhere
      3. All image prompts relate specifically to the topic, not generic gardening
      4. The content would be relevant for someone specifically interested in "${campaign_title}"
      
      Do NOT use emojis. Stay completely focused on the exact topic provided.`
    };

    // Function to validate topic alignment and clean content
    const validateTopicAlignment = (content: string, topic: string) => {
      const normalizedContent = content.toLowerCase();
      const normalizedTopic = topic.toLowerCase();
      
      // Enhanced topic-specific keywords that should appear in content
      const topicKeywords = {
        'world vegetarian day': ['vegetarian', 'vegetable', 'edible', 'harvest', 'plant-based', 'growing', 'organic', 'fresh', 'homegrown'],
        'vegetarian day': ['vegetarian', 'vegetable', 'edible', 'harvest', 'plant-based', 'growing'],
        'national honey month': ['honey', 'bee', 'pollinator', 'nectar', 'hive', 'pollen'],
        'honey month': ['honey', 'bee', 'pollinator'],
        'hydrangea care': ['hydrangea', 'bloom', 'pruning', 'acidic', 'alkaline'],
        'rose pruning': ['rose', 'pruning', 'cane', 'deadhead'],
        'orchid care': ['orchid', 'epiphyte', 'humidity', 'bark'],
        'national herb month': ['herb', 'basil', 'rosemary', 'thyme', 'culinary', 'aromatic'],
        'national houseplant week': ['houseplant', 'indoor', 'succulent', 'fern', 'pothos']
      };
      
      // Get expected keywords for this topic
      const expectedKeywords = topicKeywords[normalizedTopic] || 
        normalizedTopic.split(' ').filter(word => word.length > 3);
      
      // Count how many topic keywords appear in content
      const foundKeywords = expectedKeywords.filter(keyword => 
        normalizedContent.includes(keyword)
      );
      
      // Check for forbidden seasonal defaults that override the topic
      const forbiddenDefaults = ['beat the heat', 'summer survival', 'heat wave', 'blazing sun'];
      const hasForbiddenContent = forbiddenDefaults.some(forbidden => 
        normalizedContent.includes(forbidden)
      );
      
      // Special validation for vegetarian/vegetable topics
      if (normalizedTopic.includes('vegetarian') || normalizedTopic.includes('vegetable')) {
        const vegetableKeywords = ['vegetable', 'edible', 'harvest', 'plant-based', 'growing', 'organic', 'fresh', 'homegrown', 'tomato', 'lettuce', 'herbs', 'leafy', 'produce'];
        const foundVeggieKeywords = vegetableKeywords.filter(keyword => 
          normalizedContent.includes(keyword)
        );
        
        if (foundVeggieKeywords.length === 0 && hasForbiddenContent) {
          console.warn(`🚨 TOPIC OVERRIDE DETECTED: "${topic}" content contains seasonal defaults instead of vegetable focus`);
          return {
            isAligned: false,
            score: 0,
            foundKeywords: [],
            expectedKeywords: vegetableKeywords,
            issues: ['Topic completely overridden by seasonal defaults']
          };
        }
      }
      
      const topicAlignment = foundKeywords.length / expectedKeywords.length;
      
      // Apply penalty for forbidden content
      const finalScore = hasForbiddenContent ? Math.max(0, topicAlignment - 0.5) : topicAlignment;
      
      console.log(`[TOPIC VALIDATION] ${topic}: ${Math.round(finalScore * 100)}% alignment (${foundKeywords.length}/${expectedKeywords.length} keywords)${hasForbiddenContent ? ' ⚠️ Contains forbidden defaults' : ''}`);
      
      return {
        isAligned: finalScore >= 0.6, // Stricter requirement: 60% alignment
        score: finalScore,
        foundKeywords,
        expectedKeywords,
        hasForbiddenContent,
        issues: hasForbiddenContent ? ['Contains seasonal defaults that override topic'] : []
      };
    };

    // Function to validate and clean content
    const validateAndCleanContent = (content: string, contentType: string) => {
      let cleanedContent = content;
      
      // Strip emojis from all content
      cleanedContent = cleanedContent.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
      
      // Clean video scripts of production formatting
      if (contentType === 'video') {
        cleanedContent = cleanedContent
          // Remove scene headers and formatting
          .replace(/\*\*\[Scene \d+:.*?\]\*\*/g, '')
          .replace(/\[Scene \d+:.*?\]/g, '')
          .replace(/\*\*\[.*?\]\*\*/g, '')
          .replace(/\[.*?\]/g, '')
          // Remove visual and audio cues
          .replace(/\*Visual:.*?\*/g, '')
          .replace(/\*Background Music:.*?\*/g, '')
          .replace(/\*.*?music.*?\*/gi, '')
          // Remove narrator and host labels
          .replace(/\*\*Narrator \(Voiceover\):\*\*/g, '')
          .replace(/Narrator \(Voiceover\):/g, '')
          .replace(/\*\*Host:\*\*/g, '')
          .replace(/Host:/g, '')
          .replace(/\*\*Host \(.*?\):\*\*/g, '')
          // Remove video title formatting
          .replace(/\*\*Video Title:.*?\*\*/g, '')
          .replace(/\*\*Title:.*?\*\*/g, '')
          // Clean up separators and extra formatting
          .replace(/---+/g, '')
          .replace(/\*\*\[End.*?\]\*\*/g, '')
          .replace(/\[End.*?\]/g, '')
          // Clean up extra whitespace
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();
      }
      
      // Remove any remaining placeholders
      cleanedContent = cleanedContent
        .replace(/\[company\s*name\]/gi, businessName)
        .replace(/\[garden\s*center\s*name\]/gi, businessName)
        .replace(/\[business\s*name\]/gi, businessName)
        .replace(/your\s*garden\s*center(?!\s+name)/gi, 'our garden center')
        .replace(/\[region\]/gi, 'your area')
        .replace(/\[location\]/gi, 'your area')
        .replace(/\[garden\s*center\s*location\]/gi, 'your area');

      return cleanedContent;
    };

    // Function to generate content for a single content type
    const generateContentForType = async (contentType: string) => {
      try {
        console.log(`📝 Generating ${contentType} content...`);
        
        // Enhanced prompts to prevent emojis and video formatting
        let systemPrompt = `You are a professional content creator for garden centers. Create engaging, helpful content. Business: ${businessName}. Focus: ${campaign_title}. ${description ? `Context: ${description}` : ''} 
        
        CRITICAL RULES:
        - NEVER use emojis or emoticons
        - Focus on practical gardening advice
        - Write in a professional, friendly tone
        - ${contentType === 'video' ? 'Write ONLY the script dialogue/narration without any scene descriptions, visual cues, or production notes. Just the spoken words.' : ''}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.7,
            max_tokens: contentType === 'blog' ? 2000 : 1000,
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: contentPrompts[contentType]
              }
            ]
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error for ${contentType}: ${response.status}`);
        }

        const data = await response.json();
        let content = data.choices[0].message.content;
        
        // Validate topic alignment first
        const topicValidation = validateTopicAlignment(content, campaign_title);
        
        if (!topicValidation.isAligned) {
          console.warn(`⚠️ Topic alignment issue for ${contentType}: ${Math.round(topicValidation.score * 100)}% alignment`);
          console.warn(`Expected keywords: ${topicValidation.expectedKeywords.join(', ')}`);
          console.warn(`Found keywords: ${topicValidation.foundKeywords.join(', ')}`);
          
          if (topicValidation.hasForbiddenContent) {
            console.error(`🚨 CRITICAL: ${contentType} content overridden by seasonal defaults for topic "${campaign_title}"`);
            console.error(`Issues: ${topicValidation.issues.join(', ')}`);
          }
        }
        
        // Validate and clean the content
        content = validateAndCleanContent(content, contentType);
        
        console.log(`✅ Generated ${contentType} content (${content.length} chars, ${Math.round(topicValidation.score * 100)}% topic alignment${topicValidation.hasForbiddenContent ? ', ⚠️ contains defaults' : ''})`);

        return {
          contentType,
          content,
          success: true,
          topicAlignment: topicValidation.score,
          issues: topicValidation.issues
        };
        
      } catch (error) {
        console.error(`❌ Error generating ${contentType} content:`, error);
        return {
          contentType,
          error: error.message,
          success: false
        };
      }
    };

    // Generate only missing content types in parallel
    const startTime = Date.now();
    const contentResults = await Promise.allSettled(
      typesToGenerate.map(contentType => generateContentForType(contentType))
    );
    const generationTime = Date.now() - startTime;
    console.log(`🚀 Content generation completed for ${typesToGenerate.length} types in ${generationTime}ms`);

    // Process results and prepare database inserts
    const tasksToInsert = [];
    const failedTasks = [];

    for (const result of contentResults) {
      if (result.status === 'fulfilled' && result.value.success) {
        const { contentType, content } = result.value;
        tasksToInsert.push({
          campaign_id,
          post_type: contentType,
          ai_output: content,
          status: 'review',
          scheduled_date: new Date().toISOString().split('T')[0],
          user_id,
          tenant_id,
          created_by_user_id: user_id,
          notes: `Generated for ${campaign_title} campaign`
        });
      } else {
        const errorInfo = result.status === 'fulfilled' ? result.value : { contentType: 'unknown', error: result.reason };
        failedTasks.push({
          post_type: errorInfo.contentType,
          error: errorInfo.error,
          status: 'failed'
        });
      }
    }

    // Batch insert all successful tasks
    let generatedTasks = [...failedTasks];
    if (tasksToInsert.length > 0) {
      console.log(`💾 Batch inserting ${tasksToInsert.length} tasks...`);
      const { data: tasks, error: batchError } = await supabase
        .from('content_tasks')
        .insert(tasksToInsert)
        .select();

      if (batchError) {
        console.error('❌ Batch insert error:', batchError);
        // Fallback to individual inserts
        for (const taskData of tasksToInsert) {
          try {
            const { data: task, error: taskError } = await supabase
              .from('content_tasks')
              .insert(taskData)
              .select()
              .single();
            
            if (taskError) {
              failedTasks.push({
                post_type: taskData.post_type,
                error: taskError.message,
                status: 'failed'
              });
            } else {
              generatedTasks.push(task);
            }
          } catch (error) {
            failedTasks.push({
              post_type: taskData.post_type,
              error: error.message,
              status: 'failed'
            });
          }
        }
      } else {
        generatedTasks.push(...tasks);
        console.log(`✅ Successfully created ${tasks.length} tasks`);
      }
    }

    console.log('✅ Content generation completed for all types');

    const successfulTasks = generatedTasks.filter(task => !task.error);
    const finalFailedTasks = generatedTasks.filter(task => task.error);

    return corsJsonResponse({
      success: finalFailedTasks.length < REQUIRED_CONTENT_TYPES.length, // Success if at least some content was generated
      tasks: generatedTasks,
      message: `Generated ${successfulTasks.length}/${REQUIRED_CONTENT_TYPES.length} content pieces${finalFailedTasks.length > 0 ? `. Failed: ${finalFailedTasks.map(t => t.post_type).join(', ')}` : ''}`
    });

  } catch (error) {
    console.error('❌ Error in generate_campaign_content:', error);
    return corsJsonResponse({
      success: false,
      error: error.message,
      tasks: []
    }, { status: 500 });
  }
});
