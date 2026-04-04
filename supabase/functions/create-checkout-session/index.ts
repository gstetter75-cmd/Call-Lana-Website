// Create Stripe Checkout Session — For top-ups and plan upgrades
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { mode, amount_cents, plan, success_url, cancel_url } = await req.json();
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Get or create Stripe customer
    const { data: sub } = await createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    ).from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).single();

    let customerId = sub?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      ).from('subscriptions').update({ stripe_customer_id: customerId }).eq('user_id', user.id);
    }

    let session;

    if (mode === 'topup') {
      // One-time payment for balance top-up
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: { name: 'Guthaben-Aufladung' },
            unit_amount: amount_cents || 5000,
          },
          quantity: 1,
        }],
        metadata: { user_id: user.id, type: 'topup' },
        success_url: success_url || `${Deno.env.get('ALLOWED_ORIGIN')}/dashboard.html?payment=success`,
        cancel_url: cancel_url || `${Deno.env.get('ALLOWED_ORIGIN')}/dashboard.html?payment=cancelled`,
      });
    } else if (mode === 'subscription') {
      // Plan upgrade/change
      const priceId = Deno.env.get(`STRIPE_PRICE_${(plan || 'starter').toUpperCase()}`);
      if (!priceId) throw new Error('Price not configured for plan: ' + plan);

      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { user_id: user.id, plan: plan || 'starter' },
        success_url: success_url || `${Deno.env.get('ALLOWED_ORIGIN')}/dashboard.html?payment=success&plan=${plan}`,
        cancel_url: cancel_url || `${Deno.env.get('ALLOWED_ORIGIN')}/dashboard.html?payment=cancelled`,
      });
    } else {
      throw new Error('Invalid mode. Use "topup" or "subscription".');
    }

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Checkout session error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
