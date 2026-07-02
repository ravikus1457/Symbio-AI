# Payment QR codes

Drop the temple's real payment QR code images here so they appear in the
donation popup ("Support Your Temple" → Make a Donation) for one-tap scanning:

- `venmo-qr.png`  — Venmo (@EastBayHinduTemple)
- `paypal-qr.png` — PayPal
- `zelle-qr.png`  — Zelle

Square PNGs work best (they're shown at ~172px). The paths are already wired in
the `DONATION` block at the top of `../../js/temple.js` (`venmoQr`, `paypalQr`,
`zelleQr`). Any file that isn't present is hidden automatically, so it's safe to
leave a path set before the image exists.

To also enable the tappable "Open Venmo / Give with PayPal / Copy Zelle" buttons,
fill in the matching handle/link in that same `DONATION` block:

- `venmo`  — username without the @ (already set to "EastBayHinduTemple")
- `paypal` — a PayPal.me link or hosted donate URL
- `zelle`  — the temple's Zelle email or phone
