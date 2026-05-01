// VAPI Webhook Handler — end-of-call-report → calls table
//
// One event, one atomic INSERT. No intermediate state, no two-step
// started/ended pattern. VAPI sends a single end-of-call-report when
// a call finishes with all data (transcript, summary, cost, duration).
//
// Auth:  x-vapi-secret header checked against VAPI_WEBHOOK_SECRET env var.
//        Fails CLOSED: if the env var is not set all requests are rejected.
//
// Lookup: finds assistant by provider='vapi' AND provider_phone_number_id first.
//         If payload carries call.assistantId, verifies it matches or uses it
//         as a secondary lookup when the phone-number lookup finds nothing.
//         Falls back to phone_number string match if provider identifiers are
//         not configured on the assistant row (legacy path).
//
// Write:  direct INSERT using service_role key (bypasses RLS — same as all other
//         edge functions in this project). Duplicate webhook deliveries for the
//         same provider_call_id are detected via unique index (23505) and return
//         200 so VAPI stops retrying without creating duplicate rows.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // CORS preflight — Supabase dashboard and browser-based tests need this.
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type, x-vapi-secret',
      },
    });
  }

  // ── 1. Authenticate ────────────────────────────────────────────────────────
  // Fail CLOSED: reject everything if the secret is not configured.
  // This prevents an accidental open webhook endpoint on deploy.
  const expectedSecret = Deno.env.get('VAPI_WEBHOOK_SECRET');
  if (!expectedSecret) {
    console.error('[vapi-webhook] VAPI_WEBHOOK_SECRET env var not set — rejecting request');
    return respond({ error: 'Webhook not configured' }, 500);
  }

  const receivedSecret = req.headers.get('x-vapi-secret');
  if (receivedSecret !== expectedSecret) {
    console.warn('[vapi-webhook] Invalid or missing x-vapi-secret header');
    return respond({ error: 'Unauthorized' }, 401);
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    console.error('[vapi-webhook] Failed to parse JSON body');
    return respond({ error: 'Invalid JSON body' }, 400);
  }

  // VAPI wraps events in a `message` envelope in server-url webhook mode.
  // Support both wrapped ({ message: { type, ... } }) and flat ({ type, ... }).
  const msg: Record<string, unknown> =
    (body.message != null ? body.message : body) as Record<string, unknown>;

  const eventType = typeof msg.type === 'string' ? msg.type : '';

  // ── 3. Route events ────────────────────────────────────────────────────────
  // Only end-of-call-report creates a call record. All other event types
  // (assistant-request, function-call, speech-update, transcript, hang, etc.)
  // are acknowledged with 200 so VAPI doesn't retry them.
  if (eventType !== 'end-of-call-report') {
    console.log('[vapi-webhook] Ignored event type:', eventType);
    return respond({ handled: false, type: eventType }, 200);
  }

  // ── 4. Extract call object ─────────────────────────────────────────────────
  const call = msg.call as Record<string, unknown> | undefined;
  if (!call) {
    console.error('[vapi-webhook] end-of-call-report is missing call object');
    return respond({ error: 'Missing call object in payload' }, 400);
  }

  const artifact = (msg.artifact as Record<string, unknown>) ?? {};
  const analysis  = (msg.analysis  as Record<string, unknown>) ?? {};

  // Provider identifiers extracted from the call object
  const providerCallId      = typeof call.id          === 'string' ? call.id          : null;
  const providerAssistantId = typeof call.assistantId === 'string' ? call.assistantId : null;

  // VAPI phone-number identifiers for assistant lookup
  const phoneNumberId  = typeof call.phoneNumberId === 'string' ? call.phoneNumberId : null;
  const phoneNumberObj = (call.phoneNumber as Record<string, unknown>) ?? {};
  const lanaPhoneNumber = typeof phoneNumberObj.number === 'string' ? phoneNumberObj.number : null;

  // ── 5. Supabase client (service_role bypasses RLS) ─────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // ── 6. Find the assistant row ──────────────────────────────────────────────
  // Matching priority:
  //   a) provider='vapi' + provider_phone_number_id  — primary, most reliable
  //      → if payload also has assistantId and row has provider_assistant_id,
  //        verify they agree (mismatch is logged but does not drop the call)
  //   b) provider='vapi' + provider_assistant_id     — if phone lookup misses
  //      but call.assistantId is present (e.g. phone number not yet configured)
  //   c) phone_number column                         — legacy fallback

  type AssistantRow = {
    id: string;
    user_id: string;
    name: string;
    provider_assistant_id: string | null;
  };
  let assistantRow: AssistantRow | null = null;

  // (a) Primary: provider_phone_number_id
  if (phoneNumberId) {
    const { data, error } = await supabase
      .from('assistants')
      .select('id, user_id, name, provider_assistant_id')
      .eq('provider', 'vapi')
      .eq('provider_phone_number_id', phoneNumberId)
      .maybeSingle();

    if (error) {
      console.error('[vapi-webhook] Primary assistant lookup error:', error.message);
    } else {
      assistantRow = data;
    }
  }

  // Verify assistantId agreement when both sides have it configured.
  // A mismatch signals misconfiguration — log it but never drop a real call.
  if (assistantRow && providerAssistantId && assistantRow.provider_assistant_id) {
    if (assistantRow.provider_assistant_id !== providerAssistantId) {
      console.warn(
        '[vapi-webhook] provider_assistant_id mismatch: row=%s payload=%s callId=%s' +
        ' — proceeding with phone-number match',
        assistantRow.provider_assistant_id,
        providerAssistantId,
        providerCallId
      );
    }
  }

  // (b) Secondary: provider_assistant_id (phone lookup found nothing)
  if (!assistantRow && providerAssistantId) {
    const { data, error } = await supabase
      .from('assistants')
      .select('id, user_id, name, provider_assistant_id')
      .eq('provider', 'vapi')
      .eq('provider_assistant_id', providerAssistantId)
      .maybeSingle();

    if (error) {
      console.error('[vapi-webhook] Assistant-id lookup error:', error.message);
    } else {
      assistantRow = data;
      if (data) {
        console.log(
          '[vapi-webhook] Matched assistant by provider_assistant_id=%s (phone-number lookup found nothing)',
          providerAssistantId
        );
      }
    }
  }

  // (c) Fallback: phone_number column (Lana's number, not the caller's number)
  if (!assistantRow && lanaPhoneNumber) {
    const { data, error } = await supabase
      .from('assistants')
      .select('id, user_id, name, provider_assistant_id')
      .eq('phone_number', lanaPhoneNumber)
      .maybeSingle();

    if (error) {
      console.error('[vapi-webhook] Fallback assistant lookup error:', error.message);
    } else {
      assistantRow = data;
      if (data) {
        console.log(
          '[vapi-webhook] Used phone_number fallback for lookup — ' +
          'set provider_phone_number_id=%s on assistant %s to use reliable path',
          phoneNumberId,
          data.id
        );
      }
    }
  }

  if (!assistantRow) {
    console.error(
      '[vapi-webhook] No assistant found — phoneNumberId=%s lanaPhone=%s callId=%s',
      phoneNumberId,
      lanaPhoneNumber,
      providerCallId
    );
    return respond(
      {
        error: 'No assistant mapping found',
        phoneNumberId,
        lanaPhoneNumber,
        callId: providerCallId,
      },
      404
    );
  }

  // ── 7. Map VAPI payload → calls columns ───────────────────────────────────

  // Status: derived from endedReason
  const endedReason = typeof msg.endedReason === 'string' ? msg.endedReason : '';
  const callStatus  = mapEndedReasonToStatus(endedReason);

  // Duration in seconds.
  // Prefer msg.duration (VAPI provides it as a float in seconds).
  // Fall back to calculating from startedAt / endedAt timestamps.
  let durationSeconds = 0;
  if (typeof msg.duration === 'number') {
    durationSeconds = Math.round(msg.duration);
  } else if (typeof call.startedAt === 'string' && typeof call.endedAt === 'string') {
    const started = new Date(call.startedAt).getTime();
    const ended   = new Date(call.endedAt).getTime();
    if (!isNaN(started) && !isNaN(ended) && ended >= started) {
      durationSeconds = Math.round((ended - started) / 1000);
    }
  }

  // Caller (the person who called Lana, not Lana's number)
  const customer     = (call.customer as Record<string, unknown>) ?? {};
  const callerNumber = typeof customer.number === 'string' ? customer.number : null;
  const callerName   = typeof customer.name   === 'string' ? customer.name   : null;

  // Cost — VAPI provides it as a float (USD). Store as-is in the numeric(10,4) column.
  const cost = typeof call.cost === 'number' ? call.cost : 0;

  // Transcript: prefer artifact.transcript (full text), fall back to call-level field
  const transcript =
    (typeof artifact.transcript === 'string' ? artifact.transcript : null) ??
    (typeof call.transcript     === 'string' ? call.transcript     : null);

  // Summary: prefer analysis.summary (AI-generated), fall back to call-level field
  const summary =
    (typeof analysis.summary === 'string' ? analysis.summary : null) ??
    (typeof call.summary     === 'string' ? call.summary     : null);

  // ── 8. Insert call record ──────────────────────────────────────────────────
  // Duplicate delivery of the same end-of-call-report is detected via the
  // unique partial index on (provider, provider_call_id). Postgres returns
  // error code 23505 (unique_violation). We return 200 on duplicate so VAPI
  // stops retrying — the data is already safely stored.
  const { data: inserted, error: insertError } = await supabase
    .from('calls')
    .insert({
      user_id:          assistantRow.user_id,
      assistant_id:     assistantRow.id,
      assistant_name:   assistantRow.name,
      phone_number:     callerNumber,       // the caller's number
      caller_name:      callerName,
      direction:        'inbound',
      status:           callStatus,
      duration_seconds: durationSeconds,
      cost,
      summary,
      transcript,
      provider:         'vapi',
      provider_call_id: providerCallId,
    })
    .select('id')
    .single();

  if (insertError) {
    // 23505 = unique_violation — same call delivered twice, data already saved.
    if (insertError.code === '23505') {
      console.log(
        '[vapi-webhook] Duplicate delivery for provider_call_id=%s — returning 200 (idempotent)',
        providerCallId
      );
      return respond({ success: true, duplicate: true }, 200);
    }
    console.error('[vapi-webhook] DB insert failed:', insertError.message);
    return respond({ error: 'DB insert failed', detail: insertError.message }, 500);
  }

  console.log(
    '[vapi-webhook] Call record created: id=%s user=%s duration=%ds status=%s provider_call_id=%s',
    inserted.id,
    assistantRow.user_id,
    durationSeconds,
    callStatus,
    providerCallId
  );

  return respond({ success: true, callId: inserted.id }, 200);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Maps VAPI's endedReason to the calls.status CHECK constraint values:
 *   'completed' | 'missed' | 'no-answer' | 'busy' | 'failed'
 *
 * VAPI endedReason reference (non-exhaustive):
 *   customer-ended-call, assistant-ended-call, assistant-forwarded-call,
 *   silence-timed-out, max-duration-reached, voicemail,
 *   no-answer, busy, failed, pipeline-error, call-start-error-*
 */
function mapEndedReasonToStatus(reason: string): string {
  switch (reason) {
    case 'no-answer':
      return 'no-answer';
    case 'busy':
      return 'busy';
    case 'voicemail':
      return 'missed';
    case 'failed':
    case 'pipeline-error':
    case 'call-start-error-telnyx-failed':
    case 'call-start-error-twilio-failed':
    case 'call-start-error-vapi-failed':
      return 'failed';
    default:
      // customer-ended-call, assistant-ended-call, assistant-forwarded-call,
      // silence-timed-out, max-duration-reached, and any future reasons
      return 'completed';
  }
}
