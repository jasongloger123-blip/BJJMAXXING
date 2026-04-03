import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeServerClient } from '@/lib/stripe'

function toIsoDate(timestamp?: number | null) {
  return typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : null
}

export async function POST(request: Request) {
  const stripe = getStripeServerClient()
  const admin = createAdminClient()
  const signature = headers().get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripe || !admin || !signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook ist noch nicht vollstaendig konfiguriert.' }, { status: 400 })
  }

  const body = await request.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    return NextResponse.json(
      { error: `Webhook-Validierung fehlgeschlagen: ${(error as Error).message}` },
      { status: 400 }
    )
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
    const userId = (session.metadata?.userId as string | undefined) ?? session.client_reference_id ?? null
    const productKey = (session.metadata?.productKey as string | undefined) ?? 'membership'
    const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null

    let currentPeriodEnd: string | null = null
    let status = session.mode === 'subscription' ? 'active' : 'paid'

    if (stripeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
      currentPeriodEnd = toIsoDate(subscription.current_period_end)
      status = subscription.status
    }

    if (userId) {
      await admin.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSubscriptionId,
        status,
        tier: productKey,
        current_period_end: currentPeriodEnd,
      })
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

    const { data: existingSubscription } = await admin
      .from('subscriptions')
      .select('user_id, tier')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle()

    if (existingSubscription?.user_id) {
      await admin.from('subscriptions').upsert({
        user_id: existingSubscription.user_id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        tier: existingSubscription.tier ?? 'membership',
        current_period_end: toIsoDate(subscription.current_period_end),
      })
    }
  }

  return NextResponse.json({ received: true })
}
