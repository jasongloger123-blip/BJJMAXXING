import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { STRIPE_PRODUCTS, getStripeServerClient } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const stripe = getStripeServerClient()
    const supabase = createClient()

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe ist noch nicht konfiguriert. Trage zuerst STRIPE_SECRET_KEY und Price IDs ein.' },
        { status: 400 }
      )
    }

    const body = (await request.json()) as { productKey?: keyof typeof STRIPE_PRODUCTS; accessToken?: string }
    const productKey = body.productKey
    const accessToken = body.accessToken

    if (!productKey || !(productKey in STRIPE_PRODUCTS)) {
      return NextResponse.json({ error: 'Ungueltiger Produkt-Key.' }, { status: 400 })
    }

    const product = STRIPE_PRODUCTS[productKey]
    const priceId = process.env[product.priceEnvKey]
    const {
      data: { user: cookieUser },
    } = await supabase.auth.getUser()
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin

    if (!priceId) {
      return NextResponse.json(
        { error: `Die Environment Variable ${product.priceEnvKey} fehlt noch.` },
        { status: 400 }
      )
    }

    let user = cookieUser

    if (!user && accessToken) {
      const tokenClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const {
        data: { user: tokenUser },
      } = await tokenClient.auth.getUser(accessToken)

      user = tokenUser
    }

    if (!user) {
      return NextResponse.json(
        {
          error: 'Fuer den Premium-Checkout brauchst du zuerst ein Konto oder einen Login.',
          requiresAuth: true,
        },
        { status: 401 }
      )
    }

    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const stripeCustomerId =
      typeof existingSubscription?.stripe_customer_id === 'string' && existingSubscription.stripe_customer_id.trim()
        ? existingSubscription.stripe_customer_id
        : undefined

    const session = await stripe.checkout.sessions.create({
      mode: product.mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/profile?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : user.email ?? undefined,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        productKey,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout failed', error)

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message || 'Stripe konnte den Checkout nicht erstellen.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Checkout konnte serverseitig nicht gestartet werden.' },
      { status: 500 }
    )
  }
}
