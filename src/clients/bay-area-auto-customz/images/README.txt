BAY AREA AUTO CUSTOMZ — REAL PHOTOS, SIGNS & LOGOS
===================================================

Sergio's approved shop photos + brand art. All are wired into the site and
optimized (photos ~1400-1600px JPEG; signs/logos WebP; each well under ~400KB).

BRAND SIGNS & LOGOS (from Sergio's real RGB signage)
  sign-wordmark.webp     rainbow neon script wordmark — banner atop #ambient
  sign-features.webp     ambient-lighting sign w/ Instagram QR — left of #ambient
                         (his stylized rainbow QR is decorative; on the site the
                         sign is a tap link to Instagram, so the link always works)
  logo-badge-rgb.webp    RGB neon car badge — emblem in the #ambient panel
  logo-badge-gold.webp   gold car badge — the site logo (header + footer)
  logo-badge-gold.jpg    same badge as JPEG (og:image is now the doors-open reveal
                         shot starlight-mercedes-wide.jpg); apple-touch-icon.png +
                         logo-badge-sm.jpg are derived from this badge

INSTAGRAM QR (regenerated — the stylized QR baked into the sign scans poorly)
  qr-instagram-card.png  branded "Scan to follow" card, gold frame + IG glyph —
                         hand this to Sergio for the physical sign / car / flyers
  qr-instagram.png       plain black-on-white QR (same link), for any other use
  Both are verified-scannable and encode https://www.instagram.com/bayareaautocustomz/.
  Neither is embedded in the page (the site uses tap links); they're print assets.

STARLIGHT (Our work — #work)
  starlight-roof-purple.jpg        purple starlight, Mercedes C-Class (featured)
  starlight-white-ice.jpg          ice-white starlight (featured)
  starlight-mercedes-wide.jpg      doors-open reveal, white Mercedes (featured)
  starlight-mercedes-cabin.jpg     rear-cabin star coverage
  starlight-console-white.jpg      console glow + starlight
  starlight-roof-console.jpg       from the driver's door
  starlight-roof-doors.jpg         roof-to-pillar coverage
  starlight-camaro-blue.jpg        ice-blue starlight, Camaro

AMBIENT INSTALLS (#ambient "Ambient installs" grid)
  ambient-bmw-green.jpg     green trim + blue footwells, BMW
  ambient-bmw-red.jpg       full rainbow sweep, red-interior BMW
  ambient-bmw-door.jpg      teal door-to-dash lines, white BMW
  ambient-door-speaker.jpg  Corvette door + speaker glow (featured in #work)

SHOP VIDEO REELS (#motion "See it in motion" — H.264 MP4, muted, ~1-3MB each)
  reel-headliner-white.mp4 / -poster.jpg  white starlight headliner, red seats
  reel-shooting-star.mp4 / -poster.jpg    shooting star across the roof
  reel-red-stars.mp4 / -poster.jpg        dense red star field
  reel-purple-door.mp4 / -poster.jpg      purple mode, door & speaker glow
  reel-purple-cabin.mp4 / -poster.jpg     purple mode, full cabin
  reel-red-cabin.mp4 / -poster.jpg        red mode, cabin sweep
  reel-blue-cabin.mp4 / -poster.jpg       ice blue, dash & doors
  reel-starlight-red.mp4 / -poster.jpg    starlight roof + red ambient
  reel-rgb-dash.mp4 / -poster.jpg         RGB ambient, dash & doors
  reel-ambient-night.mp4 / -poster.jpg    red ambient light strip at night
  reel-purple-build.mp4 / -poster.jpg     purple & white build walkaround
  The six -headliner/-shooting/-red-stars/-rgb-dash/-ambient-night/-purple-build
  clips came from Sergio's phone (portrait iPhone .mov, rotation baked in).
  To add a reel: transcode to H.264 MP4 (720px wide, yuv420p, faststart,
  no audio), export a poster JPEG, then copy a <figure class="reel"> block
  in index.html. Reels wrap into rows automatically, so add as many as you like.

LIVE SOCIAL FEED (#feed "Straight from the feed" — auto-updates on new posts)
  The feed grid shows curated fallback cards until a live feed is connected.
  To make it auto-update whenever Sergio posts (one-time, ~5 min):
    1. Go to https://behold.so, create a free feed, connect the
       @bayareaautocustomz Instagram account.
    2. Copy the feed's JSON URL (e.g. https://feeds.behold.so/XXXXXXXX).
    3. Paste it into data-feed-url="" on the <div class="feed"> in index.html.
  The newest posts then render on every page load and stay current on their own.
  app.js (normalizePosts) also accepts EmbedSocial / generic JSON feeds, so any
  service that returns permalink + thumbnail per post works — handy if Sergio
  wants a combined Instagram + TikTok feed. If the feed ever fails to load, the
  fallback cards stay in place so the section never looks broken.

ADDING MORE
  Export ~1200-1600px wide, keep under ~400KB, drop it here, then copy a
  <figure class="shot"> block in index.html and update src / alt / caption.
  New photos automatically join the lightbox (app.js wires .media-zoom).

  The two ORIGINAL sign PNGs also included a gold starry-background badge and
  a promo layout; the versions above are the ones used. To swap any sign,
  replace the file (keep the name) or point the <img> at a new one.

LIVE GOOGLE REVIEWS (#reviews — real reviews, auto-updating)
  Google blocks scraping (and their ToS forbids it), so real reviews load from
  a reviews feed. Until one is connected, three representative cards show and
  the 4.9/69 aggregate is displayed. To pull REAL Google reviews (one-time):
    1. Go to https://featurable.com, create a free Google-reviews widget, and
       connect the Bay Area Auto Customz Google Business Profile.
    2. Copy the widget's JSON feed URL.
    3. Paste it into data-reviews-url="" on <section id="reviews"> in index.html.
  Real review text + author + the live star average/count then render and stay
  current. app.js (normalizeReviews) also accepts a Google Places API response
  (new or legacy) or any JSON array with author / rating / text per review, so
  the Places API works too if a key is preferred.

BOOKING ALERTS (quote form → Sergio gets a text/email on every submission)
  The form is wired for Netlify Forms. Once the site is deployed on Netlify,
  each quote request is captured automatically and can notify Sergio — even if
  the visitor never taps a send button. To turn it on (one-time, in Netlify):
    Netlify dashboard → your site → Forms → the "quote" form → Add notification.
    - For EMAIL: enter Sergio's email address.
    - For a TEXT: enter his carrier's email-to-SMS address as the notification
      email — e.g. 9255365086@vtext.com (Verizon), @txt.att.net (AT&T),
      @tmomail.net (T-Mobile). The email arrives on his phone as a text. Free.
    - For real SMS: pipe Netlify's outgoing form webhook to Zapier/Make → Twilio
      (more reliable than carrier gateways; small per-text cost).
  The instant "Send as text / Call / DM / Copy" buttons the visitor sees still
  work everywhere, independent of this. (On non-Netlify hosts the auto-alert
  POST just fails silently.)

RESPONSIVE VARIANTS
  Every gallery/ambient photo has an ~800px "-800.jpg" sibling used via srcset,
  so phones don't download the full 1400-1600px originals. When adding a photo,
  also export an 800px copy (ffmpeg -i x.jpg -vf scale=800:-2 -q:v 5 x-800.jpg)
  and mirror the srcset/sizes attributes from an existing <img>.

NOTES
  The Google rating (4.9 / 69 reviews) matches the live Google listing; the
  three review quotes are real Google reviews (Corey, Nikki, Omar), shown
  undated so they can't drift stale — the live feed adds fresh dates when
  connected. DIY-kit prices read "Ask for pricing" until Sergio confirms them.
