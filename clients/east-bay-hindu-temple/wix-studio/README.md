# Bringing the redesign into Wix Studio

You chose to keep the temple in the Wix family but move from classic Wix to
**Wix Studio** — the right call. Wix Studio is Wix's professional editor and,
unlike classic Wix, it gives you the three things this design needs:

1. **Site Styles** — set the whole site's colour palette and fonts in one place.
2. **A global CSS panel** (Code → CSS) — paste real CSS that styles native Wix
   elements, so the modern look lives in normal, responsive, SEO-friendly
   sections instead of being trapped in iframes.
3. **HTML embeds + Velo** — drop in the few custom/interactive pieces.

This folder gives you everything to rebuild the design in Wix Studio without
guessing at a single colour, font, or measurement.

```
wix-studio/
├── README.md                       ← this playbook
├── wix-custom.css                  ← paste into Wix Studio's global CSS panel
└── embeds/
    ├── full-site.html              ← the WHOLE site as one paste-in embed
    ├── hero.html                   ← per-section embeds (paste individually) ↓
    ├── welcome.html
    ├── deities.html
    ├── timings.html                ← live "open now" + today-highlight + aarti
    ├── sevas.html
    ├── festivals.html              ← full grid with live "next celebration" badge
    ├── festival-countdown.html     ← slim auto countdown banner (optional)
    ├── priest.html
    ├── donation.html
    ├── visit.html                  ← includes the live Google Map
    └── footer.html
```

> The full, finished reference site is one folder up (`../index.html`), and a
> portable single-file build is at `../preview.html` — open it in any browser to
> see exactly what you're building toward (every section, colour, and word).

## Two ways to paste it in

You picked **both** packagings, so you have a choice per the situation:

- **Fastest — one paste:** drop `embeds/full-site.html` into a single Wix Studio
  "Embed HTML" element and the entire page appears at once. Great for a quick
  launch or a one-page site. Trade-off: the whole page lives in one iframe, which
  is weaker for SEO and responsive fine-tuning.
- **Best quality — per section:** use the individual section embeds (and/or build
  the simple sections natively per Steps 1–4 below). Each section is its own Wix
  element you can place, resize, and reorder, and search engines see real page
  content. **Recommended for the public launch.**

Either way, the steps below get the palette, fonts, and custom CSS right first.

---

## Step 1 — Set the palette in Site Styles

In the editor: **Site Styles (paint-roller icon) → Colors**. Set your brand
colours to these (the two leads are temple red and gold, exactly as the priest
asked):

| Role | Use it for | Hex |
| --- | --- | --- |
| **Temple red** (primary) | Headings, primary sections, accents | `#8A1220` |
| **Deep red** | Dark backgrounds, footer, hero base | `#5E0A13` |
| **Gold** (secondary) | Frames, borders, highlights | `#C89B3C` |
| **Bright gold** | On-dark text, glints | `#F1CF7A` |
| **Saffron / marigold** | Buttons, calls to action | `#E8861E` |
| **Cream** | Page background | `#FDF6E8` |
| **Warm ink** | Body text | `#33160F` |

Tip: also set **Site Styles → Colors → background** to the cream `#FDF6E8` so the
whole site reads warm rather than stark white.

## Step 2 — Set the fonts in Site Styles → Text

Use these three (all are in Wix's font picker — search by name; if a Devanagari
face isn't listed, upload it under **Text settings → Upload Fonts**):

- **Headings / display:** *Cormorant Garamond* (elegant serif — the traditional feel)
- **Body / UI:** *Mukta* (clean, very readable, and supports Hindi)
- **Hindi / Sanskrit accents:** *Tiro Devanagari Hindi* (for देवनागरी text)

Map them to Wix's text themes: Headings → Cormorant Garamond 600–700; Paragraphs
→ Mukta 400–500.

## Step 3 — Paste the custom CSS

Open **Code (`</>`) → CSS** (the global CSS page) and paste the whole of
`wix-custom.css`. Then, on any element you want styled, select it → **Inspector →
CSS → Custom class** and add the class name. The file documents each class, but
the key ones:

- `ebht-frame` → wrap the priest photo and temple photo in the gold frame.
- `ebht-niche` + `ebht-niche-arch` → the enshrined deity cards.
- `ebht-card` → the seva/pooja cards.
- `ebht-festival` → each festival row.
- `ebht-section-red` / `ebht-section-cream` → section backgrounds.
- `ebht-deva` → Hindi/Sanskrit text.

## Step 4 — Build the sections natively

Recreate these sections with normal Wix Studio elements (text, image, button,
grid/stack), using the reference site for copy and order:

1. **Welcome** — heading + two paragraphs + a 3-up stat row + one framed photo
   (`ebht-frame`). Add a real temple photo.
2. **Our Deities** — a 3-column grid of `ebht-niche` cards. Put each murti photo
   in the `ebht-niche-arch` area. Use the temple's **own** murti photos (see
   `../assets/img/README.md` for why).
3. **Poojas & Sevas** — a grid of `ebht-card` items with an icon, title, text.
4. **Our Priest** — framed photo + name + bio + the quote + two buttons.
   **Confirm the priest's name/spelling before publishing.**
5. **Support / Daan** — a red band (`ebht-section-red`) with a donation button.
   Point it at the temple's Zelle/PayPal/giving link.
6. **Visit** — contact details + a Wix **Google Maps** element set to
   `595 School Street, Pittsburg, CA 94565`.

## Step 5 — Drop in the embeds

Every section is available as a self-contained embed, so you can build the whole
page by pasting (no hand-rebuild needed). Use **Add (+) → Embed Code → Embed
HTML** and paste the matching file. For one-paste, use `full-site.html` instead.

| Embed | File | Suggested height (desktop) |
| --- | --- | --- |
| **Whole site (one paste)** | `embeds/full-site.html` | fit content |
| Hero | `embeds/hero.html` | ~640px (~720 mobile) |
| Welcome | `embeds/welcome.html` | ~760px |
| Our Deities | `embeds/deities.html` | ~1180px |
| Timings (live) | `embeds/timings.html` | ~620px (~1040 mobile) |
| Poojas & Sevas | `embeds/sevas.html` | ~1180px |
| Festivals (grid) | `embeds/festivals.html` | ~1080px |
| Festival countdown (banner) | `embeds/festival-countdown.html` | ~150px |
| Our Priest | `embeds/priest.html` | ~760px |
| Support / Daan (working donation popup) | `embeds/donation.html` | ~700px |
| Visit + Map | `embeds/visit.html` | ~780px |
| Footer | `embeds/footer.html` | ~520px |

Notes:
- Set each embed to **full width**, turn **scrollbars off**, and set the height
  per breakpoint (heights above are starting points — nudge to fit).
- The embeds are self-contained (only Google Fonts, and the Google Map in
  `visit.html`, load externally) and use **HTTPS**, which Wix requires.
- **Edit the links/data** inside each embed: the hero/visit buttons, the hours
  in `timings.html`, and the festival lists in `festivals.html` /
  `festival-countdown.html` — each has a clearly commented data block.
- **Donation:** the "Make a Donation" button opens a working popup with Zelle,
  PayPal, Venmo and mail-a-check options plus suggested amounts. Fill in the
  temple's real handles in the `DONATION` block near the top of `temple.js`
  (inside the embed), then set `setupNotice:false`. Zelle + check work out of the
  box; PayPal/Venmo activate once you add their handles. As a standalone embed,
  give it generous height (popup is confined to the iframe) — or use
  `full-site.html`, where the popup fills the screen.
- Prefer native over iframe where it's easy: if you'd rather build the timetable
  as a native Wix table, you can — the embed just saves you the live "open now"
  logic. (That logic can also be done with **Velo**: add the table natively, then
  a few lines in the page's code panel to highlight today and show open/closed.)

## Step 6 — Connect the domain & publish

Move `eastbayhindutemple.com` to the Wix Studio site under
**Settings → Domains** (you'll need a Premium plan to use a custom domain and
custom code). Publish, then check it on a phone — Wix Studio is responsive, but
always eyeball the breakpoints.

---

### What I (Symbio AI) can do from here

- Sit with you in a screen-share and drive the Wix Studio build with you — I
  can't log into your Wix account for you, but I can guide every click and hand
  you the exact classes/colours/copy as we go.
- Tune or extend any embed (add a bhajan schedule, a donation modal, an events
  feed) and hand you updated paste-in code.
- Help with the domain move and a final responsive QA pass before launch.

> Heads-up on classic Wix vs Wix Studio: custom code and custom domains need a
> **Premium** plan. If the temple is currently on a free/older Wix plan, factor
> that into the move.
