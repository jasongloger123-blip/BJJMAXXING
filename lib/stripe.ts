import Stripe from 'stripe'

export const STRIPE_PRODUCTS = {
  guardPack: {
    name: 'Long Flexible Guard Pack',
    description: 'Fixer 5-Step-A-Plan, Fehlerkorrektur und vorbereitete Side-Paths fuer spaetere Erweiterung.',
    priceEnvKey: 'STRIPE_PRICE_GUARD_PACK',
    amount: 2900,
    mode: 'payment' as const,
    features: [
      'Fixer A-Plan statt Technik-Chaos',
      'Fehler pro Haupt-Step klar sichtbar',
      'Erweiterungen erst nach Completion',
      'Videos, Drills und Sparring-Fokus pro Node',
    ],
  },
  membership: {
    name: 'BJJMAXXING Membership',
    description: 'Alle Archetyp-Packs, Erweiterungsbereiche und neue Systeme fuer kontrolliertes Wachstum.',
    priceEnvKey: 'STRIPE_PRICE_MEMBERSHIP',
    amount: 1900,
    mode: 'subscription' as const,
    features: [
      'Alle 6 Archetypen',
      'Erweitern-Bereich mit Side-Paths',
      'Neue Systeme und Branches',
      'Community- und Review-Features',
      'Subscription-Status im Profil',
    ],
  },
  premiumReview: {
    name: 'Premium Review',
    description: 'Persoenliches Feedback, ob dein A-Plan bereits sitzt und welcher naechste Schritt sinnvoll ist.',
    priceEnvKey: 'STRIPE_PRICE_PREMIUM_REVIEW',
    amount: 4900,
    mode: 'payment' as const,
    features: [
      'Schriftliches Feedback',
      'Korrekturen fuer die komplette Kette',
      'Naechster Trainingsschritt oder Erweiterung',
    ],
  },
}

export function getStripeServerClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    return null
  }

  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
    typescript: true,
  })
}
