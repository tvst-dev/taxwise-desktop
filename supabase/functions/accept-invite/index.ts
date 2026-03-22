/**
 * TaxWise — Accept Invite Bridge
 *
 * Supabase redirects here after verifying the invite email token.
 * URL contains: #access_token=...&refresh_token=...&type=invite
 *
 * This page extracts those tokens and launches the TaxWise desktop app
 * via the taxwise:// custom protocol deep link.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Opening TaxWise...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0D1117;
      color: #E6EDF3;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #161B22;
      border: 1px solid #30363D;
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 440px;
      width: 90%;
      text-align: center;
    }
    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 32px;
    }
    .logo-icon {
      width: 40px;
      height: 40px;
      background: #2563EB;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-text {
      font-size: 22px;
      font-weight: 700;
      color: #E6EDF3;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 3px solid #30363D;
      border-top-color: #2563EB;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 22px; font-weight: 700; color: #E6EDF3; margin-bottom: 12px; }
    p { font-size: 14px; color: #8B949E; line-height: 1.6; margin-bottom: 24px; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      background: #2563EB;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
    }
    .btn:hover { background: #1D4ED8; }
    .error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .download-link {
      margin-top: 20px;
      font-size: 13px;
      color: #6E7681;
    }
    .download-link a { color: #2563EB; text-decoration: none; }
    #loading { display: block; }
    #ready { display: none; }
    #error { display: none; }
    #no-app { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
      </div>
      <span class="logo-text">TaxWise</span>
    </div>

    <!-- Loading state -->
    <div id="loading">
      <div class="spinner"></div>
      <h1>Opening TaxWise&hellip;</h1>
      <p>Verifying your invitation and launching the app.<br>This only takes a moment.</p>
    </div>

    <!-- Ready state: app found, launching -->
    <div id="ready">
      <div class="spinner"></div>
      <h1>Launching TaxWise&hellip;</h1>
      <p>Your browser should ask permission to open TaxWise.<br>Click <strong>Open</strong> when prompted.</p>
      <a id="manual-btn" href="#" class="btn">Open TaxWise manually</a>
      <div class="download-link">
        Not seeing the prompt? Make sure TaxWise is installed.
      </div>
    </div>

    <!-- App not detected after timeout -->
    <div id="no-app">
      <div class="error-icon">💻</div>
      <h1>TaxWise not found</h1>
      <p>It looks like TaxWise isn&apos;t installed on this device.<br>
        Download and install it, then use the button below.</p>
      <a id="retry-btn" href="#" class="btn">Try Again</a>
      <div class="download-link">
        Need to install? Contact your organisation admin for the installer.
      </div>
    </div>

    <!-- Error state: no tokens in URL -->
    <div id="error">
      <div class="error-icon">⚠️</div>
      <h1>Invalid or expired link</h1>
      <p>This invitation link has already been used or has expired.<br>
        Ask your admin to resend the invitation.</p>
    </div>
  </div>

  <script>
    (function () {
      // Supabase redirects with tokens in the URL hash after verifying the invite
      var hash = window.location.hash.replace(/^#/, '');
      var params = new URLSearchParams(hash);
      var accessToken = params.get('access_token');
      var refreshToken = params.get('refresh_token');
      var type = params.get('type');

      if (!accessToken || !refreshToken) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        return;
      }

      // Build the deep link — taxwise:// is registered by the TaxWise installer
      var deepLink = 'taxwise://auth/callback#' + hash;

      document.getElementById('manual-btn').href = deepLink;
      document.getElementById('retry-btn').href = deepLink;

      // Small delay to let the page render, then attempt to open
      setTimeout(function () {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('ready').style.display = 'block';
        window.location.href = deepLink;

        // If user is still on this page after 5 seconds, assume app is not installed
        var launchTime = Date.now();
        var checkInterval = setInterval(function () {
          // If the user left the page (app opened), document will be hidden
          if (document.hidden) {
            clearInterval(checkInterval);
            return;
          }
          if (Date.now() - launchTime > 5000) {
            clearInterval(checkInterval);
            document.getElementById('ready').style.display = 'none';
            document.getElementById('no-app').style.display = 'block';
          }
        }, 500);
      }, 800);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Allow Supabase auth to redirect here
      'Access-Control-Allow-Origin': '*',
    },
  });
});
