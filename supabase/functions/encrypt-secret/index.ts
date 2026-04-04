// Supabase Edge Function: encrypt-secret
// Encrypts API keys and credentials server-side using AES-256-GCM.
// The encryption key is stored as a Supabase secret (ENCRYPTION_KEY).
// Returns a reference ID that can be used to retrieve/decrypt the secret later.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://call-lana.de',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { provider, secret } = await req.json()
    if (!provider || !secret) {
      return new Response(JSON.stringify({ error: 'Missing provider or secret' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Get encryption key from Supabase secrets
    const encKeyHex = Deno.env.get('ENCRYPTION_KEY')
    if (!encKeyHex) {
      return new Response(JSON.stringify({ error: 'Encryption not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Import encryption key
    const keyBytes = new Uint8Array(encKeyHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBytes, 'AES-GCM', false, ['encrypt']
    )

    // Encrypt the secret
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(secret)
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoded
    )

    // Store encrypted blob: iv (12 bytes) + ciphertext
    const encrypted = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
    encrypted.set(iv)
    encrypted.set(new Uint8Array(ciphertext), iv.length)

    // Store in database using service role client
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Update the integration record with encrypted data
    const { error: updateError } = await serviceClient
      .from('integrations')
      .update({
        access_token_encrypted: Array.from(encrypted),
        encryption_key_id: 'env:ENCRYPTION_KEY',
      })
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (updateError) {
      // If integration record doesn't exist yet, that's OK — it will be created by connSaveRecord
      console.warn('Integration update skipped (record may not exist yet):', updateError.message)
    }

    const ref = `enc:${provider}:${user.id.slice(0, 8)}`

    return new Response(JSON.stringify({ ref, encrypted: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('encrypt-secret error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
