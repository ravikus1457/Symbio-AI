/* =========================================================================
   East Bay Hindu Temple — Temple Assistant
   A self-contained, dependency-free FAQ chatbot. It injects its own launcher
   and chat panel, so a page only needs:
       <script src="assets/js/temple-assistant.js" defer></script>

   It answers the questions devotees actually ask — hours, poojas & prices,
   donations, festivals (incl. the next one), events, the priest, the shop, and
   directions — entirely in the browser (no server, no API key). The knowledge
   below mirrors the site content; update it here if the site changes.
   ========================================================================= */
(function () {
  "use strict";

  /* ---- Temple facts (single source for the assistant) ------------------ */
  var PHONE = "(925) 812-0581";
  var TEL = "tel:+19258120581";
  var RAMA = "(925) 695-4200";
  var TEL_RAMA = "tel:+19256954200";
  var WHATSAPP = "https://chat.whatsapp.com/L7b2cV31LiNAMih8pO4E7F";
  var ADDRESS = "595 School Street, Pittsburg, CA 94565";
  var MAPS = "https://www.google.com/maps/dir/?api=1&destination=595+School+St,+Pittsburg,+CA+94565";

  /* Opening hours keyed by JS day (0=Sun). null = closed. Mirrors temple.js. */
  var HOURS = { 0: [10, 16], 1: [10, 16], 2: [10, 20.5], 3: null, 4: null, 5: [10, 16], 6: [10, 16] };
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* Festivals (name + [year, monthIndex, day]). Mirrors temple.js + calendar. */
  var FESTIVALS = [
    { name: "Maha Shivaratri", date: [2026, 1, 15] },
    { name: "Holi", date: [2026, 2, 3] },
    { name: "Ram Navami", date: [2026, 2, 26] },
    { name: "Hanuman Jayanti", date: [2026, 3, 2] },
    { name: "Krishna Janmashtami", date: [2026, 8, 4] },
    { name: "Ganesh Chaturthi", date: [2026, 8, 14] },
    { name: "Sharad Navratri", date: [2026, 9, 11] },
    { name: "Diwali & Lakshmi Pooja", date: [2026, 10, 8] },
    { name: "Makar Sankranti", date: [2027, 0, 14] },
    { name: "Maha Shivaratri", date: [2027, 1, 11] },
    { name: "Holi", date: [2027, 1, 27] },
    { name: "Ram Navami", date: [2027, 2, 28] },
    { name: "Chaitra Navratri", date: [2027, 3, 10] },
    { name: "Hanuman Jayanti", date: [2027, 3, 14] },
    { name: "Buddha Purnima", date: [2027, 4, 25] },
    { name: "Guru Purnima", date: [2027, 6, 5] },
    { name: "Raksha Bandhan", date: [2027, 7, 16] },
    { name: "Krishna Janmashtami", date: [2027, 8, 6] },
    { name: "Ganesh Chaturthi", date: [2027, 8, 11] },
    { name: "Sharad Navratri", date: [2027, 9, 8] },
    { name: "Dussehra", date: [2027, 9, 17] },
    { name: "Diwali & Lakshmi Pooja", date: [2027, 10, 4] },
  ];

  /* Pooja prices, keyed by matching words → a ready sentence. */
  var STD = "$251 dakshina + $101 temple + $75 supplies ($427 with supplies)";
  var PUJAS = [
    { kw: ["satyanarayan", "satya narayan"], label: "Satyanarayan Katha", price: STD },
    { kw: ["navagraha", "navgrah", "graha", "planet"], label: "Navagraha Shanti Puja", price: STD },
    { kw: ["griha", "grah pravesh", "house warming", "housewarming", "new home", "vastu"], label: "Griha Pravesh (House Warming)", price: STD },
    { kw: ["shanti havan", "havan", "homam", "hawan"], label: "Shanti Havan & Puja", price: STD },
    { kw: ["rot", "rot katta"], label: "Rot Katta Puja", price: STD },
    { kw: ["mundan", "first haircut", "tonsure"], label: "Mundan Sanskar", price: STD },
    { kw: ["vivah", "wedding", "marriage", "shaadi"], label: "Vivah (Wedding)", price: "$1,100 dakshina, +$150 for supplies ($1,250 with supplies). Wedding at the temple for up to 200 guests is $2,100 (incl. hall rent & dakshina)." },
    { kw: ["funeral", "antim", "sanskar", "cremation", "death"], label: "Antim Sanskar (Funeral Rites)", price: "$1,100 ($1,250 with supplies)" },
    { kw: ["manglik", "mangal dosh"], label: "Manglik Puja", price: "$501 flat (supplies included)" },
    { kw: ["kundli", "horoscope scrib", "birth chart", "janam"], label: "Horoscope Scribing (Kundli)", price: "$51" },
    { kw: ["palm", "palmist", "reading", "hast"], label: "Horoscope / Palm Reading", price: "$25" },
  ];

  /* ---- Small helpers --------------------------------------------------- */
  function onHome() {
    var last = (location.pathname.split("/").pop() || "").toLowerCase();
    return last === "" || last === "index.html";
  }
  function home(hash) {
    return (onHome() ? "" : "index.html") + hash;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function link(href, text, ext) {
    var t = ext ? ' target="_blank" rel="noopener"' : "";
    return '<a href="' + href + '"' + t + ">" + text + "</a>";
  }
  function fmtTime(h) {
    var whole = Math.floor(h);
    var mins = Math.round((h - whole) * 60);
    var p = whole >= 12 ? "PM" : "AM";
    var hr = whole % 12 || 12;
    return hr + (mins ? ":" + (mins < 10 ? "0" + mins : mins) : "") + " " + p;
  }
  function openStatus() {
    var now = new Date();
    var d = now.getDay();
    var hour = now.getHours() + now.getMinutes() / 60;
    var t = HOURS[d];
    if (t && hour >= t[0] && hour < t[1]) return "We're <b>open now</b> until " + fmtTime(t[1]) + ".";
    if (t && hour < t[0]) return "We <b>open today</b> at " + fmtTime(t[0]) + ".";
    for (var i = 1; i <= 7; i += 1) {
      var nd = (d + i) % 7;
      if (HOURS[nd]) return "We're <b>closed now</b> — next open " + DAY_SHORT[nd] + " at " + fmtTime(HOURS[nd][0]) + ".";
    }
    return "";
  }
  function nextFestival(match) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    for (var i = 0; i < FESTIVALS.length; i += 1) {
      var f = FESTIVALS[i];
      if (match && f.name.toLowerCase().indexOf(match) === -1) continue;
      var dt = new Date(f.date[0], f.date[1], f.date[2]);
      if (dt >= today) {
        var days = Math.round((dt - today) / 86400000);
        var when = dt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
        var inx = days === 0 ? "today" : "in " + days + (days === 1 ? " day" : " days");
        return { name: f.name, when: when, inx: inx };
      }
    }
    return null;
  }

  /* ---- Intent handlers (return HTML strings) --------------------------- */
  function rHours() {
    var rows = [1, 2, 3, 4, 5, 6, 0]
      .map(function (d) {
        var t = HOURS[d];
        return "· " + DAY_NAMES[d] + ": " + (t ? fmtTime(t[0]) + " – " + fmtTime(t[1]) : "Closed");
      })
      .join("<br>");
    return (
      "<b>Darshan hours</b><br>" +
      rows +
      "<br><br>" +
      openStatus() +
      " Aarti is held morning, midday, and evening; please note <b>festival hours differ</b>. " +
      link(home("#timings"), "See full timings") +
      "."
    );
  }
  function rLocation() {
    return (
      "We're at <b>" +
      ADDRESS +
      "</b>. Parking is available and all are welcome. " +
      link(MAPS, "Get directions", true) +
      " · " +
      link(home("#visit"), "Plan your visit") +
      "."
    );
  }
  function rContact() {
    return (
      "You can reach the temple / Pandit ji at " +
      link(TEL, PHONE) +
      ". For seva & volunteering, call Rama ji at " +
      link(TEL_RAMA, RAMA) +
      ". You can also " +
      link(WHATSAPP, "join our WhatsApp group", true) +
      "."
    );
  }
  function rPuja(text) {
    for (var i = 0; i < PUJAS.length; i += 1) {
      for (var j = 0; j < PUJAS[i].kw.length; j += 1) {
        if (text.indexOf(PUJAS[i].kw[j]) !== -1) {
          return (
            "<b>" +
            PUJAS[i].label +
            "</b> — " +
            PUJAS[i].price +
            ".<br>Bookings depend on Pandit ji's availability, so please call " +
            link(TEL, PHONE) +
            " to confirm a date. " +
            link("puja-services.html", "Full pooja list & prices") +
            "."
          );
        }
      }
    }
    return (
      "Pandit ji performs poojas, havans, weddings, sanskaars, and astrology — at the temple or your home. A few common ones:<br>" +
      "· Satyanarayan / Navagraha / Griha Pravesh — " + STD + "<br>" +
      "· Wedding (Vivah) — $1,100 (+$150 supplies) · at the temple $2,100<br>" +
      "· Manglik Puja — $501 · Kundli — $51 · Palm reading — $25<br><br>" +
      link("puja-services.html", "See all poojas & prices") +
      ". Bookings depend on availability — call " +
      link(TEL, PHONE) +
      " to confirm."
    );
  }
  function rDonate() {
    return (
      "Thank you for your seva! 🙏 You can give by <b>Venmo</b> (@EastBayHinduTemple), <b>Zelle</b> (" +
      PHONE +
      "), <b>PayPal</b>, or by mailing a check. " +
      '<a href="' +
      home("#daan") +
      '" data-tassist-donate>Open the donation options</a>' +
      " to scan a code or tap to pay. Every contribution, large or small, is a blessing."
    );
  }
  function rFestivals(text) {
    // Was a specific festival named?
    var names = ["diwali", "holi", "navratri", "shivaratri", "janmashtami", "ganesh", "ram navami", "hanuman", "raksha", "rakhi", "makar", "sankranti", "dussehra", "guru purnima", "buddha"];
    var found = null;
    for (var i = 0; i < names.length; i += 1) {
      if (text.indexOf(names[i]) !== -1) {
        found = names[i] === "rakhi" ? "raksha" : names[i];
        break;
      }
    }
    if (found) {
      var nf = nextFestival(found);
      if (nf) {
        return (
          "<b>" + nf.name + "</b> is on <b>" + nf.when + "</b> (" + nf.inx + "). Join us for aarti, bhajan, and prasad. " +
          link("calendar.html", "Full festival calendar") +
          "."
        );
      }
    }
    var n = nextFestival(null);
    var lead = n
      ? "The next festival is <b>" + n.name + "</b> on <b>" + n.when + "</b> (" + n.inx + ")."
      : "We celebrate every major Hindu festival.";
    return (
      lead +
      " We celebrate all the major festivals with the whole community. " +
      link("calendar.html", "See the full 2026 & 2027 calendar") +
      "."
    );
  }
  function rEvents() {
    return (
      "Every <b>Tuesday at 6:30 PM</b> we hold <b>Hanuman Chalisa & Ramayana Path</b> — bhajan, kirtan, aarti, and prasad for all. We also offer music & Hindi classes, youth & cultural programs, and annadanam (food seva). " +
      link("events.html", "See events & programs") +
      " · " +
      link(WHATSAPP, "join our WhatsApp group", true) +
      "."
    );
  }
  function rPriest() {
    return (
      "Our head priest is <b>Pandit Rakesh Bhargav ji</b> — a Vedic priest, astrologer, palmist, and spiritual healer serving in California since 2001, from a family of seven generations. Astrology: Kundli $51, palm/horoscope reading $25. " +
      link("https://www.panditbhargavji.com", "panditbhargavji.com", true) +
      " · call " +
      link(TEL, PHONE) +
      "."
    );
  }
  function rShop() {
    return (
      "Our temple shop has <b>malas, small murtis, and puja supplies</b> for your home mandir, available at the temple. Call " +
      link(TEL, PHONE) +
      " to reserve an item. " +
      link(home("#shop"), "See the shop") +
      "."
    );
  }
  function rWhatsapp() {
    return "Join our community WhatsApp group for events, darshan, and announcements: " + link(WHATSAPP, "Join the group", true) + ".";
  }
  function rGreeting() {
    return (
      "🙏 Namaste, and welcome to <b>East Bay Hindu Temple</b>! I can help with darshan timings, poojas & prices, donations, festivals, events, and directions. What would you like to know?"
    );
  }
  function rThanks() {
    return "🙏 You're most welcome. Jai Shri Ram!";
  }
  function rFallback() {
    return (
      "I'm not sure about that one yet — but I can help with <b>hours</b>, <b>poojas & prices</b>, <b>donations</b>, <b>festivals</b>, <b>events</b>, and <b>directions</b>. You can also call the temple at " +
      link(TEL, PHONE) +
      " or " +
      link(WHATSAPP, "message us on WhatsApp", true) +
      "."
    );
  }

  /* ---- Intents (scored by keyword hits) -------------------------------- */
  var INTENTS = [
    { id: "greeting", kw: ["hello", "hi ", "hey", "namaste", "namaskar", "jai", "good morning", "good evening"], fn: rGreeting },
    { id: "thanks", kw: ["thank", "thanks", "dhanyavad", "appreciate"], fn: rThanks },
    { id: "hours", kw: ["hour", "open", "close", "timing", "time", "darshan time", "when can", "what time", "today"], fn: rHours },
    { id: "location", kw: ["where", "address", "location", "direction", "map", "parking", "how do i get", "find you"], fn: rLocation },
    { id: "contact", kw: ["phone", "call", "contact", "number", "reach", "talk to", "speak"], fn: rContact },
    { id: "donate", kw: ["donat", "daan", "contribut", "give money", "seva", "venmo", "zelle", "paypal", "support", "sponsor", "fund"], fn: rDonate },
    { id: "festivals", kw: ["festival", "diwali", "holi", "navratri", "shivaratri", "janmashtami", "ganesh", "ram navami", "hanuman jayanti", "dussehra", "raksha", "rakhi", "makar", "sankranti", "calendar", "when is", "buddha", "guru purnima", "celebrat"], fn: rFestivals },
    { id: "events", kw: ["event", "tuesday", "satsang", "chalisa", "ramayan", "bhajan", "kirtan", "class", "program", "aarti", "activit"], fn: rEvents },
    { id: "priest", kw: ["priest", "pandit", "panditji", "astrolog", "kundli", "palm", "horoscope", "jyotish", "vastu", "healing", "mantra"], fn: rPriest },
    { id: "shop", kw: ["shop", "buy", "mala", "murti", "store", "purchase", "gift", "sell"], fn: rShop },
    { id: "whatsapp", kw: ["whatsapp", "group", "join", "updates"], fn: rWhatsapp },
    { id: "puja", kw: ["pooja", "puja", "seva", "price", "cost", "how much", "book", "ceremony", "havan", "wedding", "vivah", "marriage", "funeral", "antim", "mundan", "manglik", "satyanarayan", "navagraha", "griha", "house warming", "vastu", "sanskar", "rate", "charge", "fee"], fn: rPuja },
  ];

  function answer(text) {
    var t = " " + text.toLowerCase().replace(/[^\w\s@&]/g, " ").replace(/\s+/g, " ") + " ";
    var best = null;
    var bestScore = 0;
    for (var i = 0; i < INTENTS.length; i += 1) {
      var score = 0;
      for (var j = 0; j < INTENTS[i].kw.length; j += 1) {
        if (t.indexOf(INTENTS[i].kw[j]) !== -1) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = INTENTS[i];
      }
    }
    if (!best) return rFallback();
    return best.fn(t);
  }

  /* ---- UI -------------------------------------------------------------- */
  var CHIPS = [
    { label: "🕉️ Timings", q: "What are your hours?" },
    { label: "📿 Book a pooja", q: "How do I book a pooja and what does it cost?" },
    { label: "💛 Donate", q: "How can I donate?" },
    { label: "🎉 Next festival", q: "When is the next festival?" },
    { label: "🗓️ Tuesday satsang", q: "Tell me about the weekly events" },
    { label: "📍 Directions", q: "Where is the temple?" },
  ];

  function build() {
    if (document.querySelector(".tassist")) return;

    var root = document.createElement("div");
    root.className = "tassist";
    root.innerHTML =
      '<button class="tassist__launcher" type="button" aria-expanded="false" aria-controls="tassist-panel" aria-label="Open the temple assistant">' +
      '<span class="tassist__launcher-icon deva" aria-hidden="true">ॐ</span>' +
      '<span class="tassist__launcher-text">Ask us</span>' +
      "</button>" +
      '<section class="tassist__panel" id="tassist-panel" role="dialog" aria-label="Temple assistant" aria-modal="false" hidden>' +
      '<header class="tassist__head">' +
      '<span class="tassist__title"><span class="deva" aria-hidden="true">🪔</span> Temple Assistant</span>' +
      '<button class="tassist__close" type="button" aria-label="Close">✕</button>' +
      "</header>" +
      '<div class="tassist__log" data-log role="log" aria-live="polite"></div>' +
      '<div class="tassist__chips" data-chips></div>' +
      '<form class="tassist__form" data-form>' +
      '<input class="tassist__input" data-input type="text" autocomplete="off" placeholder="Ask about hours, poojas, donations…" aria-label="Type your question" />' +
      '<button class="tassist__send" type="submit" aria-label="Send">➤</button>' +
      "</form>" +
      '<p class="tassist__note">Automated helper · for anything else, call ' +
      PHONE +
      "</p>" +
      "</section>";
    document.body.appendChild(root);

    var launcher = root.querySelector(".tassist__launcher");
    var panel = root.querySelector(".tassist__panel");
    var log = root.querySelector("[data-log]");
    var chipsEl = root.querySelector("[data-chips]");
    var form = root.querySelector("[data-form]");
    var input = root.querySelector("[data-input]");
    var greeted = false;

    function scroll() {
      log.scrollTop = log.scrollHeight;
    }
    function addMsg(html, who) {
      var m = document.createElement("div");
      m.className = "tassist__msg tassist__msg--" + who;
      m.innerHTML = html;
      log.appendChild(m);
      scroll();
      return m;
    }
    function botReply(text) {
      var typing = addMsg('<span class="tassist__dots"><i></i><i></i><i></i></span>', "bot");
      var delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 420;
      window.setTimeout(function () {
        typing.innerHTML = answer(text);
        scroll();
      }, delay);
    }
    function renderChips() {
      chipsEl.textContent = "";
      CHIPS.forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "tassist__chip";
        b.textContent = c.label;
        b.addEventListener("click", function () {
          send(c.q);
        });
        chipsEl.appendChild(b);
      });
    }
    function send(text) {
      text = (text || "").trim();
      if (!text) return;
      addMsg(esc(text), "user");
      botReply(text);
    }

    function setOpen(open) {
      panel.hidden = !open;
      launcher.setAttribute("aria-expanded", String(open));
      root.classList.toggle("is-open", open);
      if (open) {
        if (!greeted) {
          greeted = true;
          addMsg(rGreeting(), "bot");
          renderChips();
        }
        window.setTimeout(function () {
          input.focus();
        }, 50);
      }
    }

    launcher.addEventListener("click", function () {
      setOpen(panel.hidden);
    });
    root.querySelector(".tassist__close").addEventListener("click", function () {
      setOpen(false);
      launcher.focus();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value;
      input.value = "";
      send(v);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) {
        setOpen(false);
        launcher.focus();
      }
    });
    // Let the "Open donation options" link trigger the on-page modal when present.
    log.addEventListener("click", function (e) {
      var a = e.target.closest("[data-tassist-donate]");
      if (!a) return;
      var opener = document.querySelector("[data-donate-open]");
      if (opener) {
        e.preventDefault();
        setOpen(false);
        opener.click();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
