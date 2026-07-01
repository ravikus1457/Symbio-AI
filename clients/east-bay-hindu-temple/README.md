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
├── index.html               ← home page (hero, welcome, deities, timings, sevas,
│                               festivals, weekly satsang, priest, daan, shop, visit)
├── puja-services.html       ← full pooja & seva price breakdown + astrology
├── events.html              ← upcoming events, weekly satsang, programs, WhatsApp
├── calendar.html            ← 2026 & 2027 festival calendar (live countdown)
├── preview.html             ← portable single-file build of the HOME page (CSS/JS
│                               inlined). Regenerate after editing index/css/js.
├── assets/
│   ├── css/temple.css        ← the design system (colours, type, layout)
│   ├── js/temple.js          ← live bits: open-now status, festival countdown,
│   │                            mobile menu, reveal-on-scroll, donation popup
│   ├── js/temple-assistant.js ← the Temple Assistant chatbot (self-contained)
│   └── img/
│       ├── logo-temple.svg   ← temple mark / favicon
│       ├── priest-panditji.jpg ← the head priest's photo
│       ├── pay/              ← Venmo / PayPal / Zelle payment QR codes
│       ├── flyers/           ← the temple's poster flyers (calendar, hours, …)
│       └── README.md         ← how to add deity & priest photos
├── wix-studio/              ← Wix Studio migration kit (palette, CSS, embeds)
│   ├── README.md             ← step-by-step build playbook
│   ├── wix-custom.css        ← paste into Wix Studio's global CSS panel
│   └── embeds/               ← full-site.html + one embed per section
└── README.md                 ← this file
```

> `preview.html` is a portable single-file build of the **home page** (CSS/JS
> inlined). The full site is now multi-page — see the four `.html` files above.
> Regenerate `preview.html` after editing `index.html`, `temple.css`, or
> `temple.js` (see "Regenerating preview.html" below).

## What's on the site (multi-page)

**Home (`index.html`)** — a smooth-scrolling page with:

1. **Hero** — temple name in English + Hindi, a Sanskrit shloka, a lit diya, the
   temple slogan ("Serving Devotees · Spreading Peace · Changing Lives"), and
   "Established 2004".
2. **Welcome** — who the temple is and who it serves.
3. **Our Deities** — ornate gold-arched niches for each murti (photo-ready).
4. **Timings** — weekly darshan hours (today's row highlights automatically; Tue
   until 8:30 PM), daily aarti, and the Tuesday 6:30 PM satsang.
5. **Poojas & Sevas** — the ceremonies the priest performs, linking to full prices.
6. **Festivals** — the year's major celebrations, with a live countdown, linking
   to the full calendar.
7. **Weekly Satsang** — the Tuesday Hanuman Chalisa & Ramayana Path, with a
   WhatsApp group join.
8. **Our Priest** — Pandit Rakesh Bhargav ji, including astrology/palmistry
   credentials and links (photo-ready).
9. **Support / Daan** — donation CTA, the five giving funds, monthly giving, and
   "sponsor an event".
10. **Temple Shop** — malas, small murtis, and puja supplies.
11. **Visit** — address, phone, live "open now" status, socials, and a map.

**Poojas & Prices (`puja-services.html`)** — every ceremony with its price, an
English description, and a clear Pandit Dakshina / Temple / Supplies breakdown,
plus astrology (kundli, palm reading) and a booking-availability note.

**Events (`events.html`)** — the weekly satsang, programs for all ages (music,
Hindi, youth, bhajan/kirtan, annadanam), festival info, WhatsApp join, and
volunteering.

**Festival Calendar (`calendar.html`)** — the full 2026 and 2027 festivals with a
live countdown to the next celebration.

## Live, no-maintenance touches

These update themselves — no one has to edit the page for them:

- **"Open now" status** in the top bar and Visit section, computed from the real
  opening hours.
- **Today's hours** are highlighted in the weekly table.
- **Festival countdown** automatically points to the next upcoming festival.

The opening hours and festival dates live at the top of
`assets/js/temple.js` (clearly commented) — edit them there and the whole page
follows.

### Temple Assistant (chatbot)

A small floating "Ask us" assistant appears on every page (`assets/js/temple-assistant.js`).
It answers common questions — hours & "open now", pooja prices, donations,
festivals (including the next one and specific dates), events, the priest, the
shop, and directions — entirely in the browser, with no server or API key. It's
a knowledge-based helper (not a live person), and every answer points to the
right page or the phone number. To update what it knows, edit the clearly
labelled facts at the top of that file (phone, hours, festivals, prices); they
mirror the rest of the site.

## Things to confirm / fill in before going live

These come straight from the Pandit's meeting notes. Search the `.html` files for
`TODO`/`NOTE` comments too.

**Still needed from the Pandit (he's sending these):**

- [x] **Pandit ji's photo** — added at `assets/img/priest-panditji.jpg` and shown
      in the priest section.
- [ ] **Photos of all the murtis** — each deity niche currently shows an original
      gold emblem; drop in the temple's own murti photos when ready (see
      `assets/img/README.md`). A temple/altar photo can go in the Welcome frame.
- [ ] **Event photos** — pull recent event photos from the temple's Facebook to
      feature on `events.html`.

**Payments — what's done and what's left:**

- [x] **Venmo is live** — `@EastBayHinduTemple`. "Open Venmo" button + scannable QR.
- [x] **Zelle is live** — registered to `(925) 812-0581` ("Pandit Rakesh Bhargav
      Religious Services"). "Copy" button + scannable QR.
- [x] **PayPal is live (scan-only)** — the temple's PayPal QR encodes an in-app
      code, not a web link, so PayPal shows a scannable QR with no tap button.
- [x] **WhatsApp group is live** — the "Join our WhatsApp Group" buttons use the
      real invite link (`chat.whatsapp.com/L7b2cV31LiNAMih8pO4E7F`).
- [x] **Instagram** — confirmed as `instagram.com/eastbayhindutemple`; linked
      site-wide. (`panditbhargavji.com` is also live in the priest section.)
- [ ] **Recurring "monthly seva" and event sponsorship** route through the popup /
      a phone call — add a real recurring link if/when one exists.

> The three payment QR images live in `assets/img/pay/` (`venmo-qr.png`,
> `paypal-qr.png`, `zelle-qr.png`). Replace them if the temple's payment accounts
> ever change, and update the matching handles in the `DONATION` block of
> `assets/js/temple.js`.

**Confirm the facts (taken from the flyers / public listings):**

- [ ] **Primary phone is now (925) 812-0581** everywhere (Pandit Rakesh Bhargav),
      matching all the temple's flyers. The old `(925) 252-0551` was removed — add
      it back if it's a separate, valid temple line. **(925) 695-4200 (Rama ji)**
      is listed for seva/volunteering.
- [ ] **Hours** — Tuesday now shows 10 AM–8:30 PM (per the hours poster); a note
      says festival hours differ.
- [ ] **Puja prices** — entered from the Pandit's notes; give them a final check.
- [ ] **Confirm aarti times** and festival dates (2026 & 2027 are per the temple
      calendar; dates follow the Hindu calendar, PST/PDT).

## Regenerating preview.html

`preview.html` inlines `temple.css` and `temple.js` into the home page. After
editing `index.html`, `assets/css/temple.css`, or `assets/js/temple.js`, rebuild
it from this folder:

```sh
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
let h = readFileSync("index.html","utf8");
h = h.replace(/<link rel="stylesheet" href="assets\/css\/temple.css" \/>/,
  "<style>\n"+readFileSync("assets/css/temple.css","utf8")+"\n</style>");
h = h.replace(/<script src="assets\/js\/temple.js" defer><\/script>/,
  "<script>\n"+readFileSync("assets/js/temple.js","utf8")+"\n</script>");
writeFileSync("preview.html", h);
'
```

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

**Chosen path: Wix Studio.** A complete migration kit lives in
[`wix-studio/`](wix-studio/README.md) — the colour palette and fonts for Site
Styles, a CSS file for Wix Studio's global CSS panel, three ready-to-paste
embed widgets (hero, live timings, festival countdown), and a step-by-step
build guide.

We're happy to do the deployment and the domain switch as part of the project.

---

Built with care by **Symbio AI**. 🪔
