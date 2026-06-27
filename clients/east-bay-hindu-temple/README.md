# East Bay Hindu Temple — Website Redesign

A modern, mobile-first redesign of the East Bay Hindu Temple website
(Pittsburg, CA), built by **Symbio AI**. The brief from the head priest:
**modernize the site but keep a traditional, devotional feel**, lead with the
traditional Hindu colours **red and gold**, and feature imagery of the deities
prominently — but tastefully, not overdone.

This folder is a **self-contained static website**. There is no build step and
no framework — it's plain HTML, CSS, and JavaScript. You can open
`index.html` directly in a browser to preview it.

```
east-bay-hindu-temple/
├── index.html               ← the whole site (one page, anchored sections)
├── assets/
│   ├── css/temple.css        ← the design system (colours, type, layout)
│   ├── js/temple.js          ← live bits: open-now status, festival countdown,
│   │                            mobile menu, reveal-on-scroll
│   └── img/
│       ├── logo-temple.svg   ← temple mark / favicon
│       └── README.md         ← how to add deity & priest photos
└── README.md                 ← this file
```

## What's on the page

A single, smooth-scrolling page with these sections:

1. **Hero** — temple name in English + Hindi, a Sanskrit shloka, a lit diya, and
   clear calls to action.
2. **Welcome** — who the temple is and who it serves.
3. **Our Deities** — ornate gold-arched niches for each murti (photo-ready).
4. **Timings** — weekly darshan hours (today's row highlights automatically) and
   daily aarti.
5. **Poojas & Sevas** — the ceremonies the priest performs, at temple and at home.
6. **Festivals** — the year's major celebrations, with a live countdown to the
   next one.
7. **Our Priest** — a feature on the head priest (photo-ready).
8. **Support / Daan** — a donation call to action.
9. **Visit** — address, phone, live "open now" status, and an embedded map.

## Live, no-maintenance touches

These update themselves — no one has to edit the page for them:

- **"Open now" status** in the top bar and Visit section, computed from the real
  opening hours.
- **Today's hours** are highlighted in the weekly table.
- **Festival countdown** automatically points to the next upcoming festival.

The opening hours and festival dates live at the top of
`assets/js/temple.js` (clearly commented) — edit them there and the whole page
follows.

## Things to confirm / fill in before going live

Search `index.html` for `TODO` and `NOTE` comments. The key ones:

- [ ] **Priest's name & spelling** — currently "Pandit Rakesh Bhargav ji" from
      public listings; please confirm.
- [ ] **Add the priest's photo** (`assets/img/priest-panditji.jpg`).
- [ ] **Add deity & temple photos** (see `assets/img/README.md`).
- [ ] **Confirm aarti times** and any festival dates.
- [ ] **Donation link** — point the "Make a Donation" button at the temple's
      preferred method (Zelle / PayPal / giving page).

The address `595 School Street, Pittsburg, CA 94565`, phone numbers, hours, and
the Facebook link are taken from the temple's public listings — please give them
a final check.

## Hosting — important note about Wix

The current site is on **Wix**. A few honest options for going live with this
design:

1. **Host this site directly (recommended for the "modern" goal).** This is a
   complete website — it can be published on Netlify, Cloudflare Pages, GitHub
   Pages, or **Wix Studio** in minutes, and the existing domain
   (`eastbayhindutemple.com`) pointed at it. This gives full control over the
   modern look.
2. **Rebuild it inside the classic Wix Editor.** Wix is a closed visual builder,
   so a person has to recreate the layout there by hand. This file then serves
   as the exact spec — colours, fonts, copy, and section order are all here to
   copy from. Classic Wix limits how modern the result can get.
3. **Embed pieces into Wix.** Individual interactive widgets (e.g. the aarti
   timings, festival countdown) can be dropped into Wix "Embed HTML" blocks.

We're happy to do the deployment and the domain switch as part of the project.

---

Built with care by **Symbio AI**. 🪔
