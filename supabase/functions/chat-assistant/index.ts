import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return jsonResponse({ error: "OpenAI API key not configured" }, 500);
    }

    // Parse request
    const { messages, context } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return jsonResponse({ error: "messages array is required" }, 400);
    }

    // Call OpenAI chat completions
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 1000,
        temperature: 0.4,
        stream: false
      }),
    });

    if (!aiResponse.ok) {
      const errData = await aiResponse.json().catch(() => ({}));
      console.error("OpenAI API error:", JSON.stringify(errData));
      return jsonResponse({
        error: errData.error?.message || `OpenAI error: ${aiResponse.status}`
      }, 500);
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content;

    if (!reply) {
      return jsonResponse({ error: "No response from AI" }, 500);
    }

    return jsonResponse({ reply, usage: aiData.usage });

  } catch (err) {
    console.error("Chat assistant error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
