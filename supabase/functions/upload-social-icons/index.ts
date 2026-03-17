import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ICON_PROMPTS: Record<string, string> = {
  facebook: "Simple minimalist social media icon, white circular outline on solid black background, lowercase letter f in the center representing Facebook, clean line-art style, vector-like, symmetrical, 1:1 aspect ratio",
  instagram: "Simple minimalist social media icon, white circular outline on solid black background, camera Instagram symbol in the center, clean line-art style, vector-like, symmetrical, 1:1 aspect ratio",
  tiktok: "Simple minimalist social media icon, white circular outline on solid black background, TikTok musical note symbol in the center, clean line-art style, vector-like, symmetrical, 1:1 aspect ratio",
  pinterest: "Simple minimalist social media icon, white circular outline on solid black background, letter P representing Pinterest in the center, clean line-art style, vector-like, symmetrical, 1:1 aspect ratio",
  youtube: "Simple minimalist social media icon, white circular outline on solid black background, play button triangle representing YouTube in the center, clean line-art style, vector-like, symmetrical, 1:1 aspect ratio",
  linkedin: "Simple minimalist social media icon, white circular outline on solid black background, letters in representing LinkedIn in the center, clean line-art style, vector-like, symmetrical, 1:1 aspect ratio",
};

async function generateIcon(prompt: string): Promise<string | null> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      console.error(`AI API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return imageUrl || null;
  } catch (error) {
    console.error("Error generating icon:", error);
    return null;
  }
}

async function uploadToStorage(
  supabase: any,
  platform: string,
  base64Data: string
): Promise<boolean> {
  try {
    // Extract base64 content (remove data:image/png;base64, prefix)
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));

    const filePath = `social-icons/${platform}.png`;
    
    const { error } = await supabase.storage
      .from("assets")
      .upload(filePath, binaryData, {
        contentType: "image/png",
        upsert: true
      });

    if (error) {
      console.error(`Upload error for ${platform}:`, error);
      return false;
    }

    console.log(`Successfully uploaded ${platform}.png`);
    return true;
  } catch (error) {
    console.error(`Error uploading ${platform}:`, error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for a simple secret key to prevent unauthorized access
    const url = new URL(req.url);
    const secretKey = url.searchParams.get("key");
    if (secretKey !== "generate-icons-2024") {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const results: Record<string, boolean> = {};
    
    for (const [platform, prompt] of Object.entries(ICON_PROMPTS)) {
      console.log(`Generating ${platform} icon...`);
      
      const base64Image = await generateIcon(prompt);
      
      if (base64Image) {
        const uploaded = await uploadToStorage(supabase, platform, base64Image);
        results[platform] = uploaded;
      } else {
        results[platform] = false;
      }
    }

    const successCount = Object.values(results).filter(Boolean).length;
    
    return new Response(
      JSON.stringify({
        success: successCount === 6,
        message: `Uploaded ${successCount}/6 icons`,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
