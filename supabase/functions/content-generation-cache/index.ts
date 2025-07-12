import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache with TTL
class GenerationCache {
  private cache = new Map();
  
  set(key: string, value: any, ttlMs: number = 600000) { // 10 minutes default
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  delete(key: string) {
    this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  // Clean expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

const cache = new GenerationCache();

// Cleanup every 5 minutes
setInterval(() => cache.cleanup(), 300000);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    );

    const { action, key, data, ttl } = await req.json();

    switch (action) {
      case 'get':
        const cachedData = cache.get(key);
        return new Response(JSON.stringify({ 
          success: true, 
          data: cachedData,
          hit: !!cachedData 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'set':
        cache.set(key, data, ttl);
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Data cached successfully' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'delete':
        cache.delete(key);
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Cache entry deleted' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'clear':
        cache.clear();
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Cache cleared' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'stats':
        return new Response(JSON.stringify({ 
          success: true, 
          stats: {
            size: cache.cache.size,
            entries: Array.from(cache.cache.keys())
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid action' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Cache function error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});