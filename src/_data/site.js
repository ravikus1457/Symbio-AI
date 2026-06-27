/**
 * Global site data — the single source of truth for brand, navigation, and
 * contacts. Templates read this via the `site` global (e.g. {{ site.name }}).
 * Keeping it here means the nav, footer, and contact cards are defined once.
 */
export default {
  name: "Symbio AI",
  shortName: "Symbio",
  tagline: "We catch and convert leads in real time.",
  // Broader positioning — used as the hero subhead and where we describe the
  // full offer (websites + apps + systems), not just lead capture.
  positioning:
    "We build websites, apps, and smart business systems that turn attention into leads, bookings, and saved hours.",
  description:
    "Symbio AI builds websites, custom apps, AI agents, and booking & lead systems for local businesses, nonprofits, schools, and creators. Start with a free scan.",

  // Who we build for — shown as a small "who we help" strip.
  whoWeHelp: ["Local businesses", "Nonprofits", "Schools", "Creators", "Small teams"],

  // Primary navigation (the marketing pages). The free scan is a CTA, below.
  nav: [
    { key: "home", label: "Home", url: "index.html" },
    { key: "about", label: "About", url: "about.html" },
    { key: "services", label: "Services", url: "services.html" },
    { key: "pricing", label: "Pricing", url: "pricing.html" },
    { key: "packages", label: "Packages", url: "buy.html" },
    { key: "portfolio", label: "Portfolio", url: "portfolio.html" },
    { key: "reviews", label: "Reviews", url: "reviews.html" },
  ],

  // The single conversion call-to-action, reused in nav, hero, and footer.
  cta: { key: "scan", label: "Free scan", url: "scan.html" },

  // The two founders, shown directly with email links (and a phone where given).
  founders: [
    {
      name: "Mohammed H. Majeed",
      role: "Founder & lead builder",
      email: "hmajeed04@gmail.com",
      phone: "510-585-7136",
    },
    {
      name: "Ravi Kumar",
      role: "Founder & lead builder",
      email: "ravikus1457@gmail.com",
    },
  ],

  // Where the scan form delivers if the API is unreachable (handled in main.js).
  leadEmail: "hmajeed04@gmail.com",
  leadEmailCc: "ravikus1457@gmail.com",

  // External + internal destinations. Every card/link uses these — no dead "#".
  links: {
    portfolio: "https://mmajeed7864.github.io/",
    github: "https://mmajeed7864.github.io/",
    demo: "chatbot-demo.html",
  },

  // ── Productized packages (the "buy without a call" page: buy.html) ──────
  // Fixed-price offers people can purchase directly. Each `checkoutUrl` should
  // be a Stripe Payment Link (Dashboard → Payment Links → create one per
  // package, paste the https://buy.stripe.com/... URL here). While a link is
  // empty, the button gracefully falls back to the intake form below the cards
  // — so there is never a dead button, and you can launch the page before
  // Stripe is wired up. See tools/README.md → "Wiring up checkout".
  packages: [
    {
      key: "speed-fix",
      name: "Site speed & mobile fix",
      price: "$499",
      cadence: "one-time",
      blurb: "The easy first yes. We make your existing site fast and flawless on phones.",
      features: [
        "Mobile + speed audit, then the fixes",
        "Core Web Vitals & image cleanup",
        "Done in days, not weeks",
      ],
      checkoutUrl: "",
      featured: false,
    },
    {
      key: "website-7-days",
      name: "Website in 7 days",
      price: "$1,500",
      cadence: "flat",
      blurb: "A fast, modern site that earns trust and turns visitors into enquiries.",
      features: [
        "Up to 5 pages, conversion-first",
        "Lead capture + the AI assistant wired in",
        "Live in a week — flat price, no surprises",
      ],
      checkoutUrl: "",
      featured: true,
    },
    {
      key: "booking-system",
      name: "Booking + lead system",
      price: "$1,200",
      cadence: "one-time",
      blurb: "Turn enquiries into booked time, with reminders that cut no-shows.",
      features: [
        "Online booking wired to your calendar",
        "Lead capture flow — nothing dropped",
        "Automatic reminders & follow-ups",
      ],
      checkoutUrl: "",
      featured: false,
    },
    {
      key: "ai-assistant",
      name: "AI assistant install",
      price: "$900",
      cadence: "setup + monthly",
      blurb: "Our always-on assistant on your site — answers, captures leads, books.",
      features: [
        "One-time $900 setup & styling",
        "From $99/mo — hosting, AI & lead delivery",
        "Every lead reaches a real person on your team",
      ],
      checkoutUrl: "",
      featured: false,
    },
  ],

  footerCredit: "Built by Mohammed & Ravi.",
};
