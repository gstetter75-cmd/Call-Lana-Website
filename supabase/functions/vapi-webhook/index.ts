// VAPI Webhook Handler — Processes call events from VAPI
// Events: call.started, call.ended, call.transferred, transcript.ready
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-vapi-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify VAPI webhook secret
    const vapiSecret = Deno.env.get('VAPI_WEBHOOK_SECRET');
    if (vapiSecret) {
      const requestSecret = req.headers.get('x-vapi-secret');
      if (requestSecret !== vapiSecret) {
        return new Response(JSON.stringify({ error: 'Invalid webhook secret' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const payload = await req.json();
    const event = payload.type || payload.event;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (event) {
      case 'call.started':
      case 'call-started': {
        const { call } = payload;
        if (!call) break;

        // Find user by assistant's phone number
        const phoneNumber = call.phoneNumber?.number || call.to;
        const { data: assistant } = await supabase
          .from('assistants')
          .select('user_id')
          .eq('phone_number', phoneNumber)
          .single();

        if (assistant) {
          await supabase.from('calls').insert({
            user_id: assistant.user_id,
            phone_number: call.customer?.number || call.from || 'Unbekannt',
            caller_name: call.customer?.name || null,
            status: 'in_progress',
            created_at: new Date().toISOString(),
          });
        }
        break;
      }

      case 'call.ended':
      case 'call-ended': {
        const { call } = payload;
        if (!call?.id) break;

        const duration = call.duration || Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000);

        // Update existing call record
        await supabase
          .from('calls')
          .update({
            status: 'completed',
            duration,
            outcome: call.endedReason === 'customer-ended-call' ? 'info' : call.outcome || null,
          })
          .eq('phone_number', call.customer?.number || call.from)
          .order('created_at', { ascending: false })
          .limit(1);
        break;
      }

      case 'transcript.ready':
      case 'transcript': {
        const { call, transcript } = payload;
        if (!call || !transcript) break;

        await supabase
          .from('calls')
          .update({
            transcript: typeof transcript === 'string' ? transcript : JSON.stringify(transcript),
            sentiment_score: payload.sentimentScore || null,
          })
          .eq('phone_number', call.customer?.number || call.from)
          .order('created_at', { ascending: false })
          .limit(1);
        break;
      }

      case 'call.transferred':
      case 'transfer': {
        const { call, transferTo } = payload;
        if (!call) break;

        await supabase
          .from('calls')
          .update({
            outcome: 'weiterleitung',
            status: 'completed',
          })
          .eq('phone_number', call.customer?.number || call.from)
          .order('created_at', { ascending: false })
          .limit(1);
        break;
      }

      default:
        console.log(`Unhandled VAPI event: ${event}`);
    }

    return new Response(JSON.stringify({ success: true, event }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('VAPI webhook error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
