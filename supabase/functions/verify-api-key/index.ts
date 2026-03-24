/**
 * TaxWise — Verify API Key
 *
 * Accepts a TaxWise API key via Authorization header (Bearer tw_live_...) or
 * X-Api-Key header and verifies it against the api_keys table.
 *
 * Returns: organization info + permissions if valid.
 * Usage:
 *   GET /functions/v1/verify-api-key
 *   Authorization: Bearer tw_live_<key>
 *   apikey: <supabase-anon-key>
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, x-client-info, apikey, content-type',
};

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Accept key from Authorization: Bearer tw_live_... or X-Api-Key header
    let apiKey: string | null = null;
    const authHeader = req.headers.get('authorization') || '';
    const xApiKey = req.headers.get('x-api-key') || '';

    if (xApiKey.startsWith('tw_')) {
      apiKey = xApiKey;
    } else if (authHeader.toLowerCase().startsWith('bearer tw_')) {
      apiKey = authHeader.replace(/^bearer\s+/i, '');
    }

    if (!apiKey) {
      return jsonResponse({ error: 'API key required. Pass as Authorization: Bearer tw_live_... or X-Api-Key header.' }, 401);
    }

    if (!apiKey.startsWith('tw_live_') && !apiKey.startsWith('tw_test_')) {
      return jsonResponse({ error: 'Invalid API key format. Must start with tw_live_ or tw_test_.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      return jsonResponse({ error: 'Service configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Hash the provided key and look it up
    const keyHash = await sha256(apiKey);
    const { data: keyRecord, error } = await supabase
      .from('api_keys')
      .select('id, name, organization_id, permissions, rate_limit, is_active, expires_at, created_at')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !keyRecord) {
      return jsonResponse({ error: 'Invalid or revoked API key' }, 401);
    }

    // Check expiry
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return jsonResponse({ error: 'API key has expired' }, 401);
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id);

    // Fetch organization info
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, subscription_tier')
      .eq('id', keyRecord.organization_id)
      .single();

    return jsonResponse({
      valid: true,
      key_id: keyRecord.id,
      key_name: keyRecord.name,
      permissions: keyRecord.permissions,
      rate_limit: keyRecord.rate_limit,
      organization: org
        ? { id: org.id, name: org.name, plan: org.subscription_tier }
        : { id: keyRecord.organization_id },
      created_at: keyRecord.created_at,
    });
  } catch (err) {
    console.error('verify-api-key error:', err);
    return jsonResponse({ error: (err as Error).message || 'Verification failed' }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
