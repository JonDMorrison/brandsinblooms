
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HolidayCalculationRule {
  type: 'fixed' | 'nth_weekday' | 'last_weekday' | 'spring_equinox' | 'summer_solstice' | 'fall_equinox' | 'winter_solstice';
  month?: number;
  day?: number;
  weekday?: number;
  occurrence?: number;
}

interface HolidayTemplate {
  id: string;
  holiday_name: string;
  category: string;
  description: string;
  garden_relevance_template: string;
  calculation_rule: HolidayCalculationRule;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { target_year, trigger_type = 'manual' } = await req.json()
    const targetYear = target_year || new Date().getFullYear() + 1

    console.log(`Starting holiday calendar update for year ${targetYear}`)

    // Get the user who triggered this (if authenticated)
    let triggeredBy = null
    try {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
        triggeredBy = user?.id
      }
    } catch (error) {
      console.log('No authenticated user found, proceeding as system')
    }

    // Fetch all active holiday templates
    const { data: templates, error: templatesError } = await supabaseClient
      .from('holiday_templates')
      .select('*')
      .eq('is_active', true)

    if (templatesError) {
      throw new Error(`Failed to fetch holiday templates: ${templatesError.message}`)
    }

    console.log(`Found ${templates?.length || 0} holiday templates`)

    let generatedCount = 0
    let deactivatedCount = 0
    const errors: string[] = []

    // Mark previous year holidays as inactive (if they exist)
    const previousYear = targetYear - 1
    const { error: deactivateError, count: deactivatedRows } = await supabaseClient
      .from('holidays')
      .update({ is_active: false })
      .eq('is_active', true)
      .like('holiday_date', `${previousYear}-%`)

    if (deactivateError) {
      console.error('Error deactivating previous year holidays:', deactivateError)
      errors.push(`Failed to deactivate ${previousYear} holidays: ${deactivateError.message}`)
    } else {
      deactivatedCount = deactivatedRows || 0
      console.log(`Deactivated ${deactivatedCount} holidays from ${previousYear}`)
    }

    // Generate new holidays for target year
    const holidaysToInsert = []

    for (const template of templates || []) {
      try {
        const holidayDate = calculateHolidayDate(targetYear, template.calculation_rule)
        const gardenRelevance = processGardenRelevanceTemplate(template.garden_relevance_template || '', targetYear)

        holidaysToInsert.push({
          holiday_name: template.holiday_name,
          category: template.category,
          description: template.description,
          garden_relevance: gardenRelevance,
          holiday_date: formatHolidayDate(holidayDate),
          is_active: true
        })

        generatedCount++
      } catch (error) {
        console.error(`Error calculating date for ${template.holiday_name}:`, error)
        errors.push(`Failed to calculate date for ${template.holiday_name}: ${error.message}`)
      }
    }

    // Insert new holidays
    if (holidaysToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('holidays')
        .insert(holidaysToInsert)

      if (insertError) {
        throw new Error(`Failed to insert new holidays: ${insertError.message}`)
      }

      console.log(`Successfully inserted ${holidaysToInsert.length} holidays for ${targetYear}`)
    }

    // Log the generation activity
    const { error: logError } = await supabaseClient
      .from('holiday_generation_logs')
      .insert({
        year: targetYear,
        holidays_generated: generatedCount,
        holidays_deactivated: deactivatedCount,
        generation_type: trigger_type,
        triggered_by: triggeredBy,
        success: errors.length === 0,
        error_message: errors.length > 0 ? errors.join('; ') : null
      })

    if (logError) {
      console.error('Failed to log generation activity:', logError)
    }

    const response = {
      success: true,
      year: targetYear,
      holidays_generated: generatedCount,
      holidays_deactivated: deactivatedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully generated ${generatedCount} holidays for ${targetYear}${deactivatedCount > 0 ? ` and deactivated ${deactivatedCount} from ${previousYear}` : ''}`
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error updating holiday calendar:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// Holiday calculation functions
function calculateHolidayDate(year: number, rule: HolidayCalculationRule): Date {
  switch (rule.type) {
    case 'fixed':
      return new Date(year, (rule.month || 1) - 1, rule.day || 1)
    
    case 'nth_weekday':
      return getNthWeekdayOfMonth(year, rule.month || 1, rule.weekday || 0, rule.occurrence || 1)
    
    case 'last_weekday':
      return getLastWeekdayOfMonth(year, rule.month || 1, rule.weekday || 0)
    
    case 'spring_equinox':
      return new Date(year, 2, 20) // March 20
    
    case 'summer_solstice':
      return new Date(year, 5, 21) // June 21
    
    case 'fall_equinox':
      return new Date(year, 8, 22) // September 22
    
    case 'winter_solstice':
      return new Date(year, 11, 21) // December 21
    
    default:
      throw new Error(`Unknown holiday calculation type: ${rule.type}`)
  }
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, occurrence: number): Date {
  const firstDay = new Date(year, month - 1, 1)
  const firstWeekday = firstDay.getDay()
  
  let daysToAdd = weekday - firstWeekday
  if (daysToAdd < 0) {
    daysToAdd += 7
  }
  
  daysToAdd += (occurrence - 1) * 7
  
  return new Date(year, month - 1, 1 + daysToAdd)
}

function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month, 0)
  const lastWeekday = lastDay.getDay()
  
  let daysToSubtract = lastWeekday - weekday
  if (daysToSubtract < 0) {
    daysToSubtract += 7
  }
  
  return new Date(year, month - 1, lastDay.getDate() - daysToSubtract)
}

function formatHolidayDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function processGardenRelevanceTemplate(template: string, year: number): string {
  return template.replace(/{year}/g, year.toString())
}
