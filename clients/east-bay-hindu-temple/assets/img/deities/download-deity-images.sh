#!/usr/bin/env bash
#
# Localize the public-domain deity paintings used in the "Our Deities" section.
#
# By default the site hot-links these images straight from Wikimedia Commons
# (so they appear with zero setup). For a faster, fully self-hosted site, run
# this script to download them next to this file, then switch each niche's
# <img src="https://commons.wikimedia.org/..."> to the local path shown below.
#
# All images are paintings/prints by Raja Ravi Varma (d. 1906) or the Ravi Varma
# Press — out of copyright (public domain). Credit is appreciated but not required.
#
# Usage:  bash download-deity-images.sh
# Needs:  curl  (and internet access)

set -euo pipefail
cd "$(dirname "$0")"

base="https://commons.wikimedia.org/wiki/Special:FilePath"

# local-name | Wikimedia file name
download() {
  local out="$1" file="$2"
  echo "→ $out.jpg"
  curl -fsSL "$base/$file?width=900" -o "$out.jpg"
}

download ram      "Bharata_welcoming_Rama%2C_Sita%2C_Lakshmana_and_Hanuman_to_Ayodhya_by_Raja_Ravi_Varma.jpg"
download shiv     "An_Oleograph_of_Shiva%2C_Parvati_and_Nandi_by_Raja_Ravi_Varma.jpg"
download durga    "Goddess_Durga_by_Raja_Ravi_Varma.jpg"
download hanuman  "Hanuman_fetches_the_herb-bearing_mountain%2C_in_a_print_from_the_Ravi_Varma_Press%2C_1910%27s.jpg"
download ganesh   "Ganapati1.jpg"
download krishna  "Raja_Ravi_Varma%2C_Radha_Waiting_for_Krishna.jpg"

cat <<'NOTE'

Done. Now point each niche at the local file in index.html, e.g.:

  <img class="niche__photo"
       src="assets/img/deities/ram.jpg"
       alt="Shri Ram Darbar — Raja Ravi Varma (public domain)"
       loading="lazy" onerror="this.style.display='none'" />

Files written: ram.jpg shiv.jpg durga.jpg hanuman.jpg ganesh.jpg krishna.jpg
(For Wix Studio, upload these to Wix Media instead and use the Wix image URLs.)
NOTE
