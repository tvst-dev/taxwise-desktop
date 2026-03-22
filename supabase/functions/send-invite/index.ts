/**
 * TaxWise — Send Team Invitation (Production-grade)
 *
 * Flow:
 * 1. Try inviteUserByEmail normally
 * 2. If 422 (user already exists as pending invite):
 *    a. Look up the user in auth
 *    b. If confirmed → return 409 (they must sign in directly)
 *    c. If unconfirmed pending → delete stale invite user and re-invite fresh
 */
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Service role key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const redirectTo = `${supabaseUrl}/functions/v1/accept-invite`;

    const inviteData = {
      data: {
        organization_id: organizationId,
        organization_name: organizationName || 'TaxWise',
        role: role || 'viewer',
        invited_by_name: inviterName || 'Your team admin',
      },
      redirectTo,
    };

    // Attempt 1: normal invite
    let { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, inviteData);

    if (error) {
      // 422 = user already exists (confirmed account OR stale pending invite)
      const is422 = error.status === 422 || (error.message || '').includes('already') || (error.message || '').includes('registered');

      if (!is422) throw error;

      // Look up the user to determine their state
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = listData?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (!existing) {
        // User not found but still got 422 — unknown cause, surface it
        throw error;
      }

      if (existing.email_confirmed_at) {
        // Confirmed account — cannot be re-invited
        return new Response(
          JSON.stringify({
            error: 'This email already has an active TaxWise account. Ask them to sign in directly.',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Unconfirmed / stale pending invite — delete and re-invite
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existing.id);
      if (deleteError) throw deleteError;

      const retry = await supabaseAdmin.auth.admin.inviteUserByEmail(email, inviteData);
      if (retry.error) throw retry.error;
      data = retry.data;
    }

    return new Response(
      JSON.stringify({ success: true, userId: data?.user?.id }),
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
