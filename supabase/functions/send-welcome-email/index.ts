// Send Welcome Email — Triggered after user signup
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, firstName } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const name = firstName || 'dort';
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a2e;">
        <div style="text-align:center;margin-bottom:30px;">
          <h1 style="color:#7c3aed;margin:0;">Call Lana</h1>
          <p style="color:#666;margin:4px 0 0;">Dein KI-Telefonassistent</p>
        </div>
        <h2 style="color:#1a1a2e;">Willkommen bei Call Lana, ${name}! 🎉</h2>
        <p>Wir freuen uns, dich an Bord zu haben. In wenigen Schritten ist dein KI-Assistent einsatzbereit:</p>
        <ol style="line-height:2;">
          <li><strong>Assistenten erstellen</strong> — Gib deinem Assistenten einen Namen und eine Stimme</li>
          <li><strong>Telefonnummer zuweisen</strong> — Verbinde eine Nummer mit deinem Assistenten</li>
          <li><strong>Begrüßung konfigurieren</strong> — Lege fest, wie dein Assistent Anrufer begrüßt</li>
          <li><strong>Testanruf durchführen</strong> — Probiere es selbst aus</li>
          <li><strong>Live schalten</strong> — Aktiviere deinen Assistenten für echte Anrufe</li>
        </ol>
        <div style="text-align:center;margin:30px 0;">
          <a href="https://call-lana.de/dashboard.html" style="display:inline-block;background:#7c3aed;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;">Zum Dashboard →</a>
        </div>
        <p style="color:#666;font-size:13px;">Bei Fragen erreichst du uns jederzeit unter <a href="mailto:info@call-lana.de" style="color:#7c3aed;">info@call-lana.de</a>.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
        <p style="color:#999;font-size:11px;text-align:center;">Call Lana GmbH · Wetzellplatz 2 · 31137 Hildesheim</p>
      </body>
      </html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Call Lana <noreply@call-lana.de>',
        to: [email],
        subject: `Willkommen bei Call Lana, ${name}! 🚀`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Resend API error: ${err}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Welcome email error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
