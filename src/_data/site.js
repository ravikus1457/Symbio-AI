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
      name: "Ravi",
      role: "Build partner",
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

  footerCredit: "Built by Mohammed & Ravi.",
};
