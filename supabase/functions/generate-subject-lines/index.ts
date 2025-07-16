import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubjectLineRequest {
  topic?: string;
  content?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, content }: SubjectLineRequest = await req.json();

    if (!topic && !content) {
      return new Response(JSON.stringify({ 
        error: 'Either topic or content must be provided' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const context = topic || content || '';
    
    const prompt = `You are helping a garden center owner write an email subject line.

Context: ${context}

Suggest 3 friendly, engaging subject lines that:
- Are under 60 characters
- Highlight seasonal relevance or helpfulness
- Make the reader curious, but stay professional
- Avoid spammy words (e.g., FREE, URGENT)
- Use garden/plant emojis sparingly and naturally

Tone: Helpful, natural, clear.

Return only the 3 subject lines, each on a separate line, without numbering or bullet points.`;

    console.log('Generating subject lines for context:', context);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that generates email subject lines for garden centers.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;
    
    // Parse the subject lines
    const subjectLines = generatedText
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .slice(0, 3); // Ensure we only get 3 suggestions

    console.log('Generated subject lines:', subjectLines);

    return new Response(JSON.stringify({ 
      subjectLines,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-subject-lines function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);