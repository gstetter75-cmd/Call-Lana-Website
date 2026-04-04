// Stripe Webhook Handler — Processes payment events
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    if (!signature) throw new Error('Missing stripe-signature header');

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        if (!userId) break;

        if (session.mode === 'payment') {
          // Top-up payment
          const amountCents = session.amount_total || 0;
          await supabase.rpc('atomic_balance_topup', {
            p_user_id: userId,
            p_amount_cents: amountCents,
          });
        } else if (session.mode === 'subscription') {
          // Plan upgrade
          const plan = session.metadata?.plan || 'starter';
          await supabase
            .from('subscriptions')
            .update({
              plan,
              stripe_subscription_id: session.subscription,
              stripe_customer_id: session.customer,
              service_active: true,
            })
            .eq('user_id', userId);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        // Find user by Stripe customer ID
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (sub) {
          await supabase.from('billing_transactions').insert({
            user_id: sub.user_id,
            type: 'plan_charge',
            amount_cents: invoice.amount_paid,
            description: `Rechnung ${invoice.number || invoice.id}`,
            status: 'completed',
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (sub) {
          await supabase.from('billing_transactions').insert({
            user_id: sub.user_id,
            type: 'plan_charge',
            amount_cents: invoice.amount_due,
            description: `Zahlung fehlgeschlagen: ${invoice.number || invoice.id}`,
            status: 'failed',
          });

          // Pause service if 3+ consecutive failures
          const { count } = await supabase
            .from('billing_transactions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', sub.user_id)
            .eq('status', 'failed')
            .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());

          if ((count || 0) >= 3) {
            await supabase
              .from('subscriptions')
              .update({ service_active: false, paused_reason: 'payment_failed' })
              .eq('user_id', sub.user_id);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (sub) {
          const isActive = subscription.status === 'active' || subscription.status === 'trialing';
          await supabase
            .from('subscriptions')
            .update({
              service_active: isActive,
              paused_reason: isActive ? null : subscription.status,
            })
            .eq('user_id', sub.user_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (sub) {
          await supabase
            .from('subscriptions')
            .update({ service_active: false, paused_reason: 'cancelled' })
            .eq('user_id', sub.user_id);
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true, type: event.type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
