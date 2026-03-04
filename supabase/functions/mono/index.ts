// Mono Bank Integration Edge Function
// Deploy: supabase functions deploy mono
// Secrets: supabase secrets set MONO_SECRET_KEY=live_sk_xxx

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const MONO_API_URL = 'https://api.withmono.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY')
    
    if (!MONO_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Mono not configured. Set MONO_SECRET_KEY via Supabase CLI.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, code, account_id, start, end, limit, paginate } = await req.json()

    const headers = {
      'Content-Type': 'application/json',
      'mono-sec-key': MONO_SECRET_KEY
    }

    let response

    switch (action) {
      case 'exchange_token':
        // Exchange auth code for account ID
        response = await fetch(`${MONO_API_URL}/account/auth`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ code })
        })
        break

      case 'get_account':
        // Get account details
        response = await fetch(`${MONO_API_URL}/accounts/${account_id}`, {
          method: 'GET',
          headers
        })
        break

      case 'get_transactions':
        // Get account transactions
        let url = `${MONO_API_URL}/accounts/${account_id}/transactions`
        const params = new URLSearchParams()
        if (start) params.append('start', start)
        if (end) params.append('end', end)
        if (limit) params.append('limit', limit.toString())
        if (paginate) params.append('paginate', paginate)
        
        if (params.toString()) url += `?${params.toString()}`
        
        response = await fetch(url, {
          method: 'GET',
          headers
        })
        break

      case 'get_statement':
        // Get account statement (PDF)
        response = await fetch(`${MONO_API_URL}/accounts/${account_id}/statement`, {
          method: 'GET',
          headers
        })
        break

      case 'sync':
        // Manually trigger data sync
        response = await fetch(`${MONO_API_URL}/accounts/${account_id}/sync`, {
          method: 'POST',
          headers
        })
        break

      case 'unlink':
        // Unlink account
        response = await fetch(`${MONO_API_URL}/accounts/${account_id}/unlink`, {
          method: 'POST',
          headers
        })
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const data = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.message || 'Mono API error', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Mono function error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
