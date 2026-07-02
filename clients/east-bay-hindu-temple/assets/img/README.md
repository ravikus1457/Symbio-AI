# Images for East Bay Hindu Temple

This folder holds the photographs that bring the site to life. The site is
built to look complete **without** any photos (it shows tasteful gold-and-cream
placeholders), so you can add real images whenever they're ready — one at a
time, in any order.

## What to add and where

| File name | Where it shows | Notes |
| --- | --- | --- |
| `priest-panditji.jpg` | "Our Priest" section | The head priest's photo. Portrait orientation (roughly 4:5) looks best. |
| `temple-altar.jpg` | "Welcome" section | A warm photo of the temple interior or main altar. Landscape (4:3). |
| `deities/ram.jpg` | "Our Deities" grid | Shri Ram Darbar murti. Portrait (3:4). |
| `deities/shiv.jpg` | "Our Deities" grid | Shiv Parivar. |
| `deities/durga.jpg` | "Our Deities" grid | Durga Maa. |
| `deities/hanuman.jpg` | "Our Deities" grid | Shri Hanuman ji. |
| `deities/ganesh.jpg` | "Our Deities" grid | Shri Ganesh ji. |
| `deities/radhakrishna.jpg` | "Our Deities" grid | Radha Krishna. |

## How to switch a placeholder for a real photo

Open `index.html`, find the matching block (each one has a `TODO` comment next
to it), and replace the placeholder `<div>` with an `<img>` tag. For example,
for the priest:

```html
<!-- before -->
<div class="photo-slot">
  <span class="photo-slot__om deva">ॐ</span>
  <span class="photo-slot__label">Pandit ji's photo</span>
</div>

<!-- after -->
<img src="assets/img/priest-panditji.jpg" alt="Pandit ji, head priest of East Bay Hindu Temple" />
```

The gold frame around it is added automatically.

## Deity images — already included (public domain)

Each deity niche now shows a genuine **public-domain painting** by Raja Ravi
Varma / the Ravi Varma Press, hot-linked from Wikimedia Commons, layered over an
original gold emblem that appears automatically if an image ever fails to load.
So the deity section looks complete right now — nothing to add.

Two ways to make it permanent / faster:

1. **Self-host the paintings** — run `deities/download-deity-images.sh` to save
   them locally, then change each niche's `<img src="https://commons.wikimedia.org/…">`
   to the local file (e.g. `assets/img/deities/ram.jpg`). Recommended for speed
   and reliability. (For Wix Studio, upload them to Wix Media and use those URLs.)
2. **Use the temple's own murti photos** instead — just swap a niche's `<img src>`
   to your photo (e.g. `deities/ram.jpg`). Your own murti photos are the most
   personal and accurate, so do this whenever you have them.

## Tips

- **Keep files reasonably small** — aim for under ~400 KB each so pages load
  fast on phones. Any photo editor or a free tool like <https://squoosh.app>
  can resize/compress.
- **Use descriptive `alt` text** (already filled in for you) so the site stays
  accessible and ranks well in search.
