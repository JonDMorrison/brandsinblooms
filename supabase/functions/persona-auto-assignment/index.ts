import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PersonaMatchResult {
  persona_id: string;
  confidence: number;
  matching_products: string[];
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { customer_id } = await req.json()
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    // Get customer and their order history
    const { data: customer, error: customerError } = await supabase
      .from('crm_customers')
      .select(`
        *,
        order_history
      `)
      .eq('id', customer_id)
      .eq('user_id', user.id)
      .single()

    if (customerError || !customer) {
      throw new Error('Customer not found')
    }

    // Get all personas with their buying triggers and ideal products
    const { data: personas, error: personasError } = await supabase
      .from('personas')
      .select('*')

    if (personasError) {
      throw new Error('Failed to fetch personas')
    }

    // Calculate persona matches based on purchase history
    const personaMatches: PersonaMatchResult[] = []

    for (const persona of personas) {
      let score = 0
      let matchingProducts: string[] = []
      let reasoning = ''

      // Extract product names from order history
      const orderHistory = customer.order_history || []
      const purchasedProducts = orderHistory.flatMap((order: any) => 
        order.items?.map((item: any) => item.name?.toLowerCase()) || []
      ).filter(Boolean)

      // Check buying triggers match
      const buyingTriggers = persona.buying_triggers || []
      const matchingTriggers = buyingTriggers.filter((trigger: string) =>
        purchasedProducts.some(product => 
          product.includes(trigger.toLowerCase()) || 
          trigger.toLowerCase().includes(product)
        )
      )

      // Check ideal products match
      const idealProducts = persona.ideal_products || []
      const matchingIdealProducts = idealProducts.filter((ideal: string) =>
        purchasedProducts.some(product => 
          product.includes(ideal.toLowerCase()) || 
          ideal.toLowerCase().includes(product)
        )
      )

      // Calculate score
      const triggerScore = (matchingTriggers.length / Math.max(buyingTriggers.length, 1)) * 50
      const productScore = (matchingIdealProducts.length / Math.max(idealProducts.length, 1)) * 50
      score = triggerScore + productScore

      // Check customer tags match
      const customerTags = customer.tags || []
      const tagMatches = buyingTriggers.filter((trigger: string) =>
        customerTags.some((tag: string) => 
          tag.toLowerCase().includes(trigger.toLowerCase()) ||
          trigger.toLowerCase().includes(tag.toLowerCase())
        )
      )
      
      if (tagMatches.length > 0) {
        score += tagMatches.length * 10
      }

      matchingProducts = [...matchingTriggers, ...matchingIdealProducts]
      
      if (score > 0) {
        reasoning = `Matched ${matchingTriggers.length} buying triggers and ${matchingIdealProducts.length} ideal products`
        if (tagMatches.length > 0) {
          reasoning += `, plus ${tagMatches.length} tag matches`
        }
        
        personaMatches.push({
          persona_id: persona.id,
          confidence: Math.min(score, 100),
          matching_products: matchingProducts,
          reasoning
        })
      }
    }

    // Sort by confidence score and get the best match
    personaMatches.sort((a, b) => b.confidence - a.confidence)
    const bestMatch = personaMatches[0]

    // Auto-assign if confidence is above 60%
    let assigned = false
    if (bestMatch && bestMatch.confidence >= 60) {
      const { error: updateError } = await supabase
        .from('crm_customers')
        .update({ 
          persona_id: bestMatch.persona_id,
          persona: personas.find(p => p.id === bestMatch.persona_id)?.name || null,
          persona_confidence_score: bestMatch.confidence / 100,
          persona_assignment_method: 'pos_auto'
        })
        .eq('id', customer_id)
        .eq('user_id', user.id)

      if (!updateError) {
        assigned = true
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        customer_id,
        assigned,
        best_match: bestMatch,
        all_matches: personaMatches.slice(0, 3), // Top 3 suggestions
        confidence_threshold: 60
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Persona auto-assignment error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})