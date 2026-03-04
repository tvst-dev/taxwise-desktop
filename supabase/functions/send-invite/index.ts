import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, role, organizationId, organizationName, inviterName } = await req.json();

    if (!email || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'email and organizationId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Service role key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey
    );

    // Send invitation via Supabase Auth — this emails the invitee a magic link
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        organization_id: organizationId,
        organization_name: organizationName || 'TaxWise',
        role: role || 'viewer',
        invited_by_name: inviterName || 'Your team admin',
      },
      redirectTo: 'taxwise://auth/callback',
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, userId: data.user?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('send-invite error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to send invitation' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
