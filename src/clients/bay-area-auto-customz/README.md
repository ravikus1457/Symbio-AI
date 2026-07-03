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
| `images/`        | Sergio's approved shop photos, signs & logos (see `images/README.txt`).|

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
  **all gallery + ambient photos** (Sergio's shop shots — Mercedes starlight
  builds, BMW + Corvette ambient interiors, in `images/`), and **his real
  brand art** (the rainbow neon wordmark, the ambient-lighting QR sign, and
  the gold + RGB car badges).
- **Placeholder — replace before launch:**
  - Review **quotes** in the Reviews section → paste real, customer-approved
    Google snippets (the 4.9/66 number itself is real).
  - DIY-kit **prices** (`from $149 / $129 / $89`) → confirm with Sergio.

## Ambient lighting kits section (`#ambient`)

Built around Sergio's **real RGB signage**: the rainbow neon script wordmark
as a banner, his ambient-lighting sign (with a scannable Instagram QR) framed
on the left, and the RGB car badge as the emblem in a rainbow-bordered panel
alongside the readable selling points — 16M colors, 200+ modes, music sync,
wireless controlled customization — plus `@bayareaautocustomz`. Below is an
"Ambient installs" grid of real photos (BMW + Corvette + Mercedes). "Add to my
quote" prefills the booking form with the RGB ambient kit.

## Brand logo

The gold car badge (`logo-badge-gold.webp`) is the site logo — header, footer,
and the `og:image` for link previews (`logo-badge-gold.jpg`).

## Gallery (`#work`)

Four featured tiles + a six-shot grid, all real photos with a keyboard-
accessible lightbox (prev/next, Esc, focus trap, focus restore) built in
`app.js` — the same lightbox powers the ambient photos.

## Key feature — the starlight designer (`#studio`)

- **Kit preview:** tap 200 / 300 / 400 / 500 / 600 / 800 to see exactly how each
  fiber count looks on a blank black headliner, in three layout patterns
  (night sky / galaxy swirl / halo edge).
- **Design your own:** place stars one by one, paint trails, erase, and build a
  custom pattern. Choose purple / ice-white / blue / RGB-mix (purple — Sergio's
  signature look — is the default), star size, twinkle speed, and shooting stars.
- **Save preview PNG** and **Use this design for my quote** (prefills booking).

## See it in motion (`#motion`)

Five real shop clips (H.264 MP4, muted, looped) as a strip of vertical 9:16
reel cards that play in place on tap — starting one pauses the others. One
row on desktop, a swipeable snap strip on smaller screens. Replaces the old
CSS-art before/after slider.

## Booking & chatbot

Both work with **no backend**. Booking composes a prefilled text/email/call so
the customer reaches Sergio in one tap. The assistant answers starlight,
lighting, doors, kit, pricing, location, hours, and booking questions — and it's
context-aware: it tolerates plurals/word forms ("starlights"), extracts the
customer's vehicle ("2012 E92 M3"), remembers it across the conversation, and
offers a one-tap **"Fill the quote form"** action that prefills vehicle +
service in the booking form. To make booking deliver to a CRM/inbox, wire the
form submit in `app.js` to an endpoint.
