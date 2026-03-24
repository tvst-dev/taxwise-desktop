/**
 * TaxWise — Send Team Invitation
 *
 * Uses Supabase's built-in inviteUserByEmail (no custom redirectTo).
 * Supabase sends its default invite email using the project's configured
 * email template and Site URL.
 *
 * On 422 (user already exists as pending invite):
 *   - If confirmed → return 409 (they must sign in directly)
 *   - If unconfirmed → delete stale pending user and re-invite
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
      return jsonResponse({ error: 'email and organizationId are required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

    if (!serviceRoleKey) {
      return jsonResponse({ error: 'Service role key not configured' }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // redirectTo must be in Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
    // taxwise://auth/callback is the Electron deep-link handler registered in main.js.
    // After the user clicks the email link, Supabase verifies the token and redirects to:
    //   taxwise://auth/callback#access_token=...&refresh_token=...&type=invite
    // Electron catches this URL, sends it to the renderer via IPC, and the app calls
    // supabase.auth.setSession() to sign the user in.
    const inviteData = {
      data: {
        organization_id: organizationId,
        organization_name: organizationName || 'TaxWise',
        role: role || 'viewer',
        invited_by_name: inviterName || 'Your team admin',
      },
      redirectTo: 'taxwise://auth/callback',
    };

    let { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, inviteData);

    if (error) {
      const is422 =
        error.status === 422 ||
        (error.message || '').toLowerCase().includes('already') ||
        (error.message || '').toLowerCase().includes('registered');

      if (!is422) throw error;

      // User already exists — check confirmed vs pending
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = listData?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (!existing) throw error;

      if (existing.email_confirmed_at) {
        return jsonResponse(
          { error: 'This email already has an active TaxWise account. Ask them to sign in directly.' },
          409
        );
      }

      // Stale pending invite — delete and re-invite fresh
      const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(existing.id);
      if (deleteErr) throw deleteErr;

      const retry = await supabaseAdmin.auth.admin.inviteUserByEmail(email, inviteData);
      if (retry.error) throw retry.error;
      data = retry.data;
    }

    // Also record in team_invitations table (best-effort)
    try {
      const token = crypto.randomUUID();
      await supabaseAdmin.from('team_invitations').insert({
        organization_id: organizationId,
        email,
        role: role || 'viewer',
        status: 'pending',
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (dbErr) {
      console.warn('team_invitations insert failed (non-critical):', dbErr);
    }

    return jsonResponse({ success: true, userId: data?.user?.id });
  } catch (err) {
    console.error('send-invite error:', err);
    return jsonResponse(
      { error: (err as Error).message || 'Failed to send invitation' },
      400
    );
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
