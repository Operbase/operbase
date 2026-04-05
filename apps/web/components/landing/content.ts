import {
  TrendingUp,
  Box,
  Users,
  Zap,
  CheckCircle2,
  BarChart3,
  ShoppingBag,
  Clock,
  Shield,
  Layers,
} from 'lucide-react'

type LandingIcon = typeof Box

// ─── Homepage ───────────────────────────────────────────────────────────────

export const problemCards: { icon: LandingIcon; title: string; description: string }[] = [
  {
    icon: TrendingUp,
    title: "You don't know your real profit",
    description:
      'Revenue looks good until you factor in ingredients and production. Without connected data, the number is a guess.',
  },
  {
    icon: Box,
    title: 'Stock lives in your head',
    description:
      'Between spreadsheets, voice notes, and memory, nothing adds up to a number you can act on.',
  },
  {
    icon: Users,
    title: 'Production and sales are disconnected',
    description:
      'No link between what you made and what you sold means planning is always a step behind.',
  },
]

export const productPillars: { icon: LandingIcon; title: string; description: string }[] = [
  {
    icon: Box,
    title: 'Stock',
    description:
      'One place for every ingredient and packaging item. Real quantities, clear units, low-stock alerts.',
  },
  {
    icon: Zap,
    title: 'Production',
    description:
      'Log batches, tie them to ingredients, and know exactly what each run costs before you price it.',
  },
  {
    icon: TrendingUp,
    title: 'Sales',
    description:
      'Record sales in seconds. Compare revenue to cost so your margin is visible — not a monthly surprise.',
  },
]

export const homepageSteps: { title: string; description: string }[] = [
  {
    title: 'Set up your items',
    description: 'Add ingredients, packaging, and how you count them. Do it once.',
  },
  {
    title: 'Log production',
    description: 'Record batches and what you used. Stock updates automatically.',
  },
  {
    title: 'Track sales and profit',
    description: 'Enter sales quickly. See money in, costs out, and what remains.',
  },
]

export const testimonials: { quote: string; name: string; role: string }[] = [
  {
    quote:
      'I finally see which products actually make money after flour and packaging. Wish I had this a year ago.',
    name: 'Owner',
    role: 'Home bakery',
  },
  {
    quote:
      'We stopped losing track of stock between the kitchen and the counter. One log for the whole week.',
    name: 'Manager',
    role: 'Neighbourhood café',
  },
  {
    quote:
      'Simple enough that the team uses it daily without being reminded. No training manual required.',
    name: 'Founder',
    role: 'Small food brand',
  },
]

// ─── Product page ─────────────────────────────────────────────────────────

export const productModules: {
  icon: LandingIcon
  title: string
  tagline: string
  features: string[]
}[] = [
  {
    icon: Box,
    title: 'Stock',
    tagline: 'Know what you have. Act before you run out.',
    features: [
      'Track every ingredient and packaging item',
      'Purchase units vs recipe units — no confusion',
      'Low-stock alerts before you hit zero',
      'Cost-per-unit calculated automatically',
    ],
  },
  {
    icon: Zap,
    title: 'Production',
    tagline: 'Log batches. Understand cost. Price with confidence.',
    features: [
      'Record production runs in seconds',
      'Ingredients deducted from stock automatically',
      'Cost per batch and cost per unit calculated',
      'Full history of what you made and when',
    ],
  },
  {
    icon: ShoppingBag,
    title: 'Sales',
    tagline: 'Simple entry. Instant profit visibility.',
    features: [
      'Log sales by product in one tap',
      'Revenue vs cost comparison per period',
      'Sales history with daily and weekly views',
      'Link sales to production batches',
    ],
  },
  {
    icon: BarChart3,
    title: 'Dashboard',
    tagline: 'One screen. Everything that matters.',
    features: [
      'Revenue, cost, and gross profit at a glance',
      'Low-stock alerts front and centre',
      'Period-over-period trend bar chart',
      'Your business currency, not a default',
    ],
  },
]

export const productFeatures: { icon: LandingIcon; title: string; description: string }[] = [
  {
    icon: Clock,
    title: 'Built for operators, not accountants',
    description: 'Large taps, plain language, and sensible defaults. No configuration maze.',
  },
  {
    icon: Shield,
    title: 'Multi-tenant, one workspace',
    description: 'Each business has its own isolated data. Invite team members when you are ready.',
  },
  {
    icon: Layers,
    title: 'Your brand, your currency',
    description:
      'Set a logo, brand colour, and currency during onboarding. The app reflects your business.',
  },
  {
    icon: CheckCircle2,
    title: 'Works on any device',
    description: 'Responsive web app. Log a batch on your phone, review profit on your laptop.',
  },
  {
    icon: TrendingUp,
    title: 'Profit-aware from day one',
    description: 'Stock costs flow into production, which flows into sales. Margin is never a guess.',
  },
  {
    icon: Zap,
    title: 'Fast by design',
    description: 'Common actions — add stock, log a batch, record a sale — take under 10 seconds.',
  },
]

// ─── Solutions page ───────────────────────────────────────────────────────

export const bakerySolutions: { title: string; description: string }[] = [
  {
    title: 'Ingredients and packaging together',
    description:
      'Flour, butter, boxes, stickers — one list with real quantities and the units you actually use.',
  },
  {
    title: 'Batch costing that works',
    description:
      'Log a bake, see the exact cost. Price your products knowing the margin, not hoping for it.',
  },
  {
    title: 'Sales without a spreadsheet',
    description:
      'Record what sold, at what price. Revenue vs cost appears instantly — no formulas needed.',
  },
  {
    title: 'Stock deducted on production',
    description:
      'Make 24 croissants, the butter and flour come off your stock automatically.',
  },
]

// ─── Pricing page ─────────────────────────────────────────────────────────

export const pricingPlans: {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  ctaHref: string
  highlighted: boolean
}[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For owners who want to get their operations in order without a commitment.',
    features: [
      'Stock, production, and sales modules',
      'Up to 50 stock items',
      'Full dashboard and profit view',
      'Single user',
      'Your currency and branding',
    ],
    cta: 'Start free',
    ctaHref: '/signup',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: 'per month',
    description: 'For businesses that need more items, team members, and no limits.',
    features: [
      'Everything in Free',
      'Unlimited stock items',
      'Up to 5 team members',
      'Advanced sales reports',
      'Priority support',
      'Early access to new verticals',
    ],
    cta: 'Start free trial',
    ctaHref: '/signup',
    highlighted: true,
  },
]

export const pricingFaq: { question: string; answer: string }[] = [
  {
    question: 'Do I need a credit card to sign up?',
    answer: 'No. Create an account and start using the free plan immediately — no card required.',
  },
  {
    question: 'What happens when I reach 50 stock items on the free plan?',
    answer:
      'You can upgrade to Pro at any time. Your data is never deleted if you stay on the free plan.',
  },
  {
    question: 'Can I change my currency after signing up?',
    answer:
      'Yes. Currency and branding settings are available in your account settings after onboarding.',
  },
  {
    question: 'Is there a contract or minimum term?',
    answer: 'No contract. Pro is billed monthly and you can cancel any time.',
  },
  {
    question: 'What verticals are coming after bakeries?',
    answer:
      'We are building towards food production, retail, and light manufacturing. Tell us what you need at hello@operbase.com.',
  },
]
