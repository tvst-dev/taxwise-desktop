/**
 * TaxWise — Send Team Invitation
 *
 * Uses supabase admin.generateLink to create the invite token
 * then sends the email directly via Resend API — no dependency
 * on Supabase SMTP configuration at all.
 *
 * Required Supabase secret:
 *   npx supabase secrets set RESEND_API_KEY=re_xxxx --project-ref xgicdlwxjkqtarfytbgz
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
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!serviceRoleKey) {
      return jsonResponse({ error: 'Service role key not configured' }, 500);
    }
    if (!resendKey) {
      return jsonResponse({ error: 'RESEND_API_KEY secret not set. Run: npx supabase secrets set RESEND_API_KEY=re_xxxx --project-ref xgicdlwxjkqtarfytbgz' }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const redirectTo = `${supabaseUrl}/functions/v1/accept-invite`;

    const inviteOptions = {
      data: {
        organization_id: organizationId,
        organization_name: organizationName || 'TaxWise',
        role: role || 'viewer',
        invited_by_name: inviterName || 'Your team admin',
      },
      redirectTo,
    };

    // Generate invite link without sending email (we send it ourselves via Resend)
    let linkResult = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: inviteOptions,
    });

    if (linkResult.error) {
      const err = linkResult.error;
      const is422 = err.status === 422 || (err.message || '').toLowerCase().includes('already') || (err.message || '').toLowerCase().includes('registered');

      if (!is422) throw err;

      // Look up the existing user
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

      if (!existing) throw err;

      if (existing.email_confirmed_at) {
        return jsonResponse({
          error: 'This email already has an active TaxWise account. Ask them to sign in directly.',
        }, 409);
      }

      // Stale pending invite — delete and regenerate
      const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(existing.id);
      if (deleteErr) throw deleteErr;

      linkResult = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: inviteOptions,
      });
      if (linkResult.error) throw linkResult.error;
    }

    const inviteUrl = linkResult.data?.properties?.action_link;
    if (!inviteUrl) throw new Error('Failed to generate invite link');

    // Send email via Resend
    const orgName = organizationName || 'TaxWise';
    const senderName = inviterName || 'Your team admin';
    const roleName = (role || 'viewer').charAt(0).toUpperCase() + (role || 'viewer').slice(1);

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1117;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr><td align="center" style="padding-bottom:28px;">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <div style="width:40px;height:40px;background:#2563EB;border-radius:10px;display:inline-block;text-align:center;line-height:40px;">
              <span style="color:white;font-size:20px;font-weight:700;">T</span>
            </div>
            <span style="font-size:22px;font-weight:700;color:#E6EDF3;">TaxWise</span>
          </div>
        </td></tr>
        <tr><td style="background:#161B22;border:1px solid #30363D;border-radius:16px;padding:40px;">
          <h1 style="color:#E6EDF3;font-size:24px;font-weight:700;margin:0 0 8px;">You're invited!</h1>
          <p style="color:#8B949E;font-size:15px;margin:0 0 24px;">
            <strong style="color:#E6EDF3;">${senderName}</strong> has invited you to join
            <strong style="color:#E6EDF3;">${orgName}</strong> on TaxWise as a
            <strong style="color:#2563EB;">${roleName}</strong>.
          </p>
          <p style="color:#8B949E;font-size:14px;margin:0 0 28px;">
            Click the button below to accept your invitation and create your account.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td style="background:#2563EB;border-radius:8px;">
              <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;color:white;font-size:15px;font-weight:600;text-decoration:none;">
                Accept Invitation
              </a>
            </td></tr>
          </table>
          <p style="color:#6E7681;font-size:12px;margin:0;line-height:1.6;">
            This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.<br>
            If the button doesn't work, copy this link: <a href="${inviteUrl}" style="color:#2563EB;">${inviteUrl}</a>
          </p>
        </td></tr>
        <tr><td align="center" style="padding-top:20px;">
          <p style="color:#6E7681;font-size:12px;margin:0;">
            &copy; ${new Date().getFullYear()} TaxWise &mdash; Nigerian Tax Compliance Platform
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TaxWise <noreply@taxwise.com.ng>',
        to: email,
        subject: `You're invited to join ${orgName} on TaxWise`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errData = await emailResponse.json().catch(() => ({}));
      throw new Error(errData.message || `Resend API error: ${emailResponse.status}`);
    }

    const emailData = await emailResponse.json();

    return jsonResponse({
      success: true,
      userId: linkResult.data?.user?.id,
      emailId: emailData.id,
    });

  } catch (err) {
    console.error('send-invite error:', err);
    return jsonResponse({ error: (err as Error).message || 'Failed to send invitation' }, 400);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
