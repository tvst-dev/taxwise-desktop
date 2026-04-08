/**
 * TaxWise — Send Team Invitation
 *
 * Uses supabase.auth.admin.generateLink({ type: 'invite' }) to create a
 * signed invite URL, then sends it via Resend (RESEND_API_KEY env var).
 *
 * If RESEND_API_KEY is not set, the invite link is returned to the caller
 * so the admin can share it manually — the invite still works, just no email.
 *
 * Required Supabase secrets (supabase secrets set ...):
 *   RESEND_API_KEY  — from resend.com (free tier: 100 emails/day)
 *
 * Supabase Dashboard → Auth → URL Configuration → Redirect URLs must include:
 *   https://taxwise-auth.vercel.app/auth/accept-invite
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

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    const resendApiKey   = Deno.env.get('RESEND_API_KEY');

    if (!serviceRoleKey) {
      return jsonResponse({ error: 'Service role key not configured' }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Supabase verifies the invite token and redirects to this URL with
    // #access_token=...&refresh_token=...&type=invite appended.
    // taxwise.com.ng/index.html already handles the full invite auth flow (set password + deep link).
    // This URL must be in Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
    const webAcceptUrl = 'https://www.taxwise.com.ng';

    // Generate the invite link (does NOT send an email — we send it ourselves)
    let { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: webAcceptUrl,
        data: {
          organization_id:    organizationId,
          organization_name:  organizationName || 'TaxWise',
          role:               role || 'viewer',
          invited_by_name:    inviterName || 'Your team admin',
        },
      },
    });

    if (linkError) {
      const isAlreadyRegistered =
        linkError.status === 422 ||
        (linkError.message || '').toLowerCase().includes('already registered');

      if (isAlreadyRegistered) {
        // Check whether the existing user is confirmed (real account) or unconfirmed (expired invite).
        // For unconfirmed users: delete them so we can re-invite cleanly.
        try {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existing = listData?.users?.find(
            (u: { email?: string; email_confirmed_at?: string | null; id: string }) =>
              u.email?.toLowerCase() === email.toLowerCase()
          );

          if (existing && !existing.email_confirmed_at) {
            // Unconfirmed — previous invite link expired. Delete and re-invite.
            await supabaseAdmin.auth.admin.deleteUser(existing.id);

            // Retry generateLink now that the user record is gone
            const { data: retryData, error: retryError } = await supabaseAdmin.auth.admin.generateLink({
              type: 'invite',
              email,
              options: {
                redirectTo: webAcceptUrl,
                data: {
                  organization_id:   organizationId,
                  organization_name: organizationName || 'TaxWise',
                  role:              role || 'viewer',
                  invited_by_name:   inviterName || 'Your team admin',
                },
              },
            });
            if (retryError) throw retryError;
            linkData = retryData;
          } else {
            // Confirmed user — they have an active account
            return jsonResponse(
              { error: 'This email already has an active TaxWise account. Ask them to sign in directly.' },
              409
            );
          }
        } catch (checkErr: unknown) {
          const e = checkErr as Error & { status?: number };
          if (e.status === 409) throw checkErr; // re-throw our own 409
          throw linkError; // fall back to original error
        }
      } else {
        throw linkError;
      }
    }

    const inviteLink = linkData?.properties?.action_link;
    if (!inviteLink) throw new Error('Failed to generate invite link');

    // Record invite in DB (best-effort)
    try {
      await supabaseAdmin.from('team_invitations').upsert(
        {
          organization_id: organizationId,
          email,
          role:       role || 'viewer',
          status:     'pending',
          token:      crypto.randomUUID(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: 'organization_id,email', ignoreDuplicates: false }
      );
    } catch (dbErr) {
      console.warn('team_invitations upsert failed (non-critical):', dbErr);
    }

    // Send email via Resend
    let emailSent = false;
    if (resendApiKey) {
      try {
        const emailHtml = buildInviteEmail({
          inviteLink,
          organizationName: organizationName || 'TaxWise',
          inviterName:      inviterName || 'Your team admin',
          role:             role || 'viewer',
          email,
        });

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from:    'TaxWise <hello@taxwise.com.ng>',
            to:      [email],
            subject: `You're invited to join ${organizationName || 'TaxWise'}`,
            html:    emailHtml,
          }),
        });

        if (res.ok) {
          emailSent = true;
        } else {
          const errBody = await res.json().catch(() => ({}));
          console.warn('Resend error:', errBody);
        }
      } catch (emailErr) {
        console.warn('Email send failed (non-critical):', emailErr);
      }
    }

    return jsonResponse({
      success:    true,
      userId:     linkData?.user?.id,
      email_sent: emailSent,
      // Return invite link so admin can share it manually if email wasn't sent
      invite_link: emailSent ? undefined : inviteLink,
    });

  } catch (err) {
    console.error('send-invite error:', err);
    return jsonResponse({ error: (err as Error).message || 'Failed to send invitation' }, 400);
  }
});

// ─── Email template ────────────────────────────────────────────────────────
function buildInviteEmail({
  inviteLink, organizationName, inviterName, role, email,
}: {
  inviteLink: string;
  organizationName: string;
  inviterName: string;
  role: string;
  email: string;
}) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#060A14;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060A14;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0D1117;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.07);">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(135deg,#3B82F6,#8B5CF6);border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-size:20px;font-weight:700;line-height:40px;">T</span>
                </td>
                <td style="padding-left:12px;color:#E2E8F0;font-size:20px;font-weight:700;">TaxWise</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <h1 style="margin:0 0 8px;color:#E2E8F0;font-size:22px;font-weight:700;">You're invited!</h1>
            <p style="margin:0 0 24px;color:#94A3B8;font-size:15px;line-height:1.6;">
              <strong style="color:#E2E8F0;">${inviterName}</strong> has invited you to join
              <strong style="color:#E2E8F0;">${organizationName}</strong> on TaxWise as a
              <span style="background:rgba(59,130,246,0.15);color:#60A5FA;padding:2px 8px;border-radius:4px;font-size:13px;">${roleLabel}</span>.
            </p>

            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="${inviteLink}"
                     style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3B82F6,#2563EB);color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                    Accept Invitation
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#64748B;font-size:13px;line-height:1.6;">
              Or copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 24px;word-break:break-all;">
              <a href="${inviteLink}" style="color:#3B82F6;font-size:12px;">${inviteLink}</a>
            </p>

            <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0 0 24px;" />
            <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
              This invitation was sent to <strong>${email}</strong>. It expires in 7 days.
              If you didn't expect this, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0;color:#334155;font-size:12px;">TaxWise · Nigerian Tax Management Software</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
