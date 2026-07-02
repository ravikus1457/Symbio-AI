# Bay Area Auto Customz — client site (draft)

A self-contained static site for Bay Area Auto Customz (starlight headliners &
custom auto lighting), built by Symbio AI. It ships verbatim through the
Eleventy build to `dist/clients/bay-area-auto-customz/`.

> Status: **draft for review** — not yet linked from the Symbio portfolio.

## Files

| File             | Purpose                                                        |
| ---------------- | ------------------------------------------------------------- |
| `index.html`     | Page markup (self-contained, no framework).                  |
| `styles.css`     | Black-and-gold theme; RGB lives in the ambient + DIY-kit sections.|
| `app.js`         | Starlight designer, before/after, gallery lightbox, booking, kits, chatbot.|
| `images/`        | Sergio's approved shop photos (see `images/README.txt`).     |

## View it locally

```bash
npm run build
npx serve dist          # then open /clients/bay-area-auto-customz/index.html
# or: cd dist && python3 -m http.server 8080
```

`npm run dev` also serves it with live reload.

## What's real vs. placeholder

- **Real:** the 4.9★ / 66 Google reviews aggregate, phone `(925) 536-5086`,
  Instagram/TikTok links, the full service list (starlight, shooting stars,
  interior + exterior lighting, custom/Alcantara headliners, butterfly doors),
  and **all 10 gallery photos** (Sergio's shop shots — Mercedes starlight
  builds + Corvette ambient doors, in `images/`).
- **Placeholder — replace before launch:**
  - Review **quotes** in the Reviews section → paste real, customer-approved
    Google snippets (the 4.9/66 number itself is real).
  - DIY-kit **prices** (`from $149 / $129 / $89`) → confirm with Sergio.

## Ambient lighting kits section (`#ambient`)

Sergio's RGB sign artwork is rebuilt as **live neon** (HTML/CSS): the cursive
multicolor wordmark and a rainbow-bordered promo panel with the sign's real
selling points — 16M colors, 200+ modes, music sync, wireless controlled
customization — plus `@bayareaautocustomz` and the Corvette ambient photos.
"Add to my quote" prefills the booking form with the RGB ambient kit. If he
prefers the original sign PNGs, drop them in `images/` and swap them in.

## Gallery (`#work`)

Four featured tiles + a six-shot grid, all real photos with a keyboard-
accessible lightbox (prev/next, Esc, focus restore) built in `app.js`.

## Key feature — the starlight designer (`#studio`)

- **Kit preview:** tap 200 / 300 / 400 / 500 / 600 / 800 to see exactly how each
  fiber count looks on a blank black headliner.
- **Design your own:** place stars one by one, paint trails, erase, and build a
  custom pattern. Choose gold / ice-white / blue / RGB-mix, star size, twinkle
  speed, and shooting stars.
- **Save preview PNG** and **Use this design for my quote** (prefills booking).

## Booking & chatbot

Both work with **no backend**. Booking composes a prefilled text/email/call so
the customer reaches Sergio in one tap. The assistant answers starlight,
lighting, doors, kit, pricing, location, hours, and booking questions and points
to the designer and the quote form. To make booking deliver to a CRM/inbox,
wire the form submit in `app.js` to an endpoint.
