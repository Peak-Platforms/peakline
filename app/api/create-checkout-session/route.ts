import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const plan: 'starter' | 'unlimited' = body?.plan === 'starter' ? 'starter' : 'unlimited';
  const priceId = plan === 'starter' ? process.env.STRIPE_PRICE_ID_STARTER : process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    console.error('Missing Stripe price for plan:', plan);
    return NextResponse.json({ error: 'This plan is not available yet' }, { status: 503 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  const baseSession = {
    mode: 'subscription' as const,
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { plan },
    success_url: 'https://app.getpeaklink.com/dashboard?upgraded=1',
    cancel_url: 'https://app.getpeaklink.com/upgrade',
  };

  // Founders offer: a coupon (limited to the first 100 redemptions in Stripe) applies to Unlimited.
  // If the coupon is used up or invalid, fall back to the regular price instead of failing.
  const founders = plan === 'unlimited' ? process.env.STRIPE_FOUNDERS_COUPON_ID : undefined;
  let session;
  if (founders) {
    try {
      session = await stripe.checkout.sessions.create({ ...baseSession, discounts: [{ coupon: founders }] });
    } catch (err: any) {
      console.error('Founders coupon not applied:', err?.message);
    }
  }
  if (!session) {
    session = await stripe.checkout.sessions.create(baseSession);
  }

  return NextResponse.json({ url: session.url });
}