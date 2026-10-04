"use strict";

(function () {
  // --- Configuration -------------------------------------------------------
  // Proxy modes:
  //  "self"  -> use the included rss-proxy.php on your own host (recommended)
  //  "public" -> use a public CORS proxy (no setup, less reliable)
  var PROXY_MODE = "self";
  var SELF_PROXY = "rss-proxy.php?url=";
  var PUBLIC_PROXIES = [
    function (u) { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); },
    function (u) { return "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u); }
  ];

  var FEEDS = [
    { key: "omroepzeeland", name: "Omroep Zeeland", url: "https://www.omroepzeeland.nl/rss.xml" },
    { key: "pzc", name: "PZC", url: "https://www.pzc.nl/rss.xml" },
    { key: "bndestem", name: "BN DeStem", url: "https://www.bndestem.nl/rss.xml" },
    { key: "hvzeeland", name: "HVZeeland", url: "https://www.hvzeeland.nl/RSS/Nieuws" },
    { key: "politie", name: "Politie Zeeland", url: "https://www.politie.nl/rss/zeeland.xml" },
    { key: "zvl", name: "Omroep ZVL", url: "https://www.omroepzvl.nl/nieuws" },
    { key: "oostvl", name: "Nieuwsblad Oost-Vlaanderen", url: "https://www.nieuwsblad.be/regio/oost-vlaanderen/rss" }
  ];

  var DAYS_TO_SHOW = 3;         // keep items from the last N days in memory
  var CACHE_KEY = "zeeland-vandaag-cache";
  var CACHE_TTL_MS = 15 * 60 * 1000;

  // --- State ---------------------------------------------------------------
  var items = [];
  var selectedDay = todayKey();
  var activeSource = "all";
  var query = "";

  // --- DOM -------------------------------------------------------------------
  var el = function (id) { return document.getElementById(id); };
  var statusEl = el("status");
  var listEl = el("newsList");
  var summaryEl = el("summary");
  var dayLabelEl = el("dayLabel");
  var sourceFilterEl = el("sourceFilter");
  var searchEl = el("search");
  var refreshBtn = el("refresh");

  // --- Date helpers (local time) --------------------------------------------
  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function keyToDate(key) {
    var p = key.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function shiftDay(key, delta) {
    var d = keyToDate(key);
    d.setDate(d.getDate() + delta);
    return todayKey(d);
  }
  function dayKeys() {
    var keys = [];
    var k = todayKey();
    for (var i = 0; i < DAYS_TO_SHOW; i++) {
      keys.push(k);
      k = shiftDay(k, -1);
    }
    return keys;
  }
  var DAY_NAMES = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  var MONTH_NAMES = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  function formatDayLabel(key) {
    var d = keyToDate(key);
    var label = DAY_NAMES[d.getDay()] + " " + d.getDate() + " " + MONTH_NAMES[d.getMonth()];
    if (key === todayKey()) label += " (vandaag)";
    return label;
  }
  function formatTime(date) {
    return pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  // --- Fetching ---------------------------------------------------------------
  function proxiedUrl(url) {
    if (PROXY_MODE === "self") return SELF_PROXY + encodeURIComponent(url);
    return PUBLIC_PROXIES[0](url);
  }

  function parseRssText(text) {
    var doc = new DOMParser().parseFromString(text, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML parsefout");
    var out = [];
    var nodes = doc.querySelectorAll("item, entry");
    nodes.forEach(function (node) {
      function tag(name) {
        var t = node.querySelector(name);
        return t ? t.textContent.trim() : "";
      }
      var link = tag("link");
      if (!link) {
        var a = node.querySelector("link[href]");
        link = a ? a.getAttribute("href") : "";
      }
      var dateStr = tag("pubDate") || tag("published") || tag("updated") || tag("dc\\:date");
      var date = dateStr ? new Date(dateStr) : null;
      if (!date || isNaN(date)) date = new Date();
      out.push({
        title: tag("title"),
        link: link,
        description: stripHtml(tag("description") || tag("summary")),
        date: date,
        sourceKey: null,
        sourceName: null
      });
    });
    return out;
  }

  function stripHtml(s) {
    var d = document.createElement("div");
    d.innerHTML = s;
    return (d.textContent || "").trim();
  }

  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (Date.now() - data.fetchedAt > CACHE_TTL_MS) return null;
      return data.items.map(function (it) {
        it.date = new Date(it.date);
        return it;
      });
    } catch (e) { return null; }
  }

  function saveCache(its) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), items: its }));
    } catch (e) { /* storage vol of geblokkeerd: negeren */ }
  }

  function fetchAll() {
    statusEl.textContent = "Nieuws laden…";
    statusEl.classList.remove("error");
    listEl.innerHTML = "";

    var promises = FEEDS.map(function (feed) {
      return fetch(proxiedUrl(feed.url))
        .then(function (r) {
          if (!r.ok) throw new Error(feed.name + ": HTTP " + r.status);
          return r.text();
        })
        .then(function (text) {
          var parsed = parseRssText(text);
          parsed.forEach(function (it) {
            it.sourceKey = feed.key;
            it.sourceName = feed.name;
          });
          return parsed;
        })
        .catch(function (err) {
          console.warn("Feed mislukt:", feed.name, err);
          return { failed: feed.name };
        });
    });

    return Promise.all(promises).then(function (results) {
      var all = [];
      var failed = [];
      results.forEach(function (r) {
        if (Array.isArray(r)) all = all.concat(r);
        else failed.push(r.failed);
      });
      all.sort(function (a, b) { return b.date - a.date; });
      items = all;
      if (all.length) saveCache(all);
      if (failed.length) {
        statusEl.textContent = "Let op: " + failed.join(", ") + " kon niet worden geladen.";
        statusEl.classList.add("error");
      } else {
        statusEl.textContent = "";
      }
      render();
    });
  }

  // --- Rendering --------------------------------------------------------------
  function itemsForDay(key) {
    var start = keyToDate(key);
    start.setHours(0, 0, 0, 0);
    var end = new Date(start);
    end.setDate(end.getDate() + 1);
    return items.filter(function (it) {
      return it.date >= start && it.date < end;
    });
  }

  function render() {
    dayLabelEl.textContent = formatDayLabel(selectedDay);
    var dayItems = itemsForDay(selectedDay);
    if (activeSource !== "all") dayItems = dayItems.filter(function (it) { return it.sourceKey === activeSource; });
    if (query) {
      var q = query.toLowerCase();
      dayItems = dayItems.filter(function (it) {
        return (it.title + " " + it.description).toLowerCase().indexOf(q) !== -1;
      });
    }

    renderSummary(dayItems);
    listEl.innerHTML = "";

    if (!dayItems.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Geen nieuws gevonden voor " + formatDayLabel(selectedDay) + ".";
      listEl.appendChild(empty);
      return;
    }

    var frag = document.createDocumentFragment();
    dayItems.forEach(function (it) {
      var card = document.createElement("article");
      card.className = "card";

      var meta = document.createElement("div");
      meta.className = "meta";
      var time = document.createElement("span");
      time.className = "time";
      time.textContent = formatTime(it.date);
      var src = document.createElement("span");
      src.textContent = it.sourceName || "";
      meta.appendChild(time);
      meta.appendChild(src);
      card.appendChild(meta);

      var a = document.createElement("a");
      a.className = "headline";
      a.href = it.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = it.title || "(geen titel)";
      card.appendChild(a);

      if (it.description) {
        var d = document.createElement("p");
        d.className = "desc";
        var short = it.description.length > 180 ? it.description.slice(0, 177) + "…" : it.description;
        d.textContent = short;
        card.appendChild(d);
      }
      frag.appendChild(card);
    });
    listEl.appendChild(frag);
  }

  function renderSummary(dayItems) {
    if (!dayItems.length) { summaryEl.hidden = true; return; }
    var bySource = {};
    dayItems.forEach(function (it) {
      bySource[it.sourceName] = (bySource[it.sourceName] || 0) + 1;
    });
    var parts = Object.keys(bySource).sort().map(function (name) {
      return bySource[name] + "× " + name;
    });
    summaryEl.hidden = false;
    summaryEl.textContent =
      "Vandaag " + dayItems.length + " bericht" + (dayItems.length === 1 ? "" : "en") +
      " van " + Object.keys(bySource).length + " bron(nen): " + parts.join(", ");
  }

  function renderSourceFilter() {
    sourceFilterEl.innerHTML = "";
    var optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Alle bronnen";
    sourceFilterEl.appendChild(optAll);
    FEEDS.forEach(function (f) {
      var o = document.createElement("option");
      o.value = f.key;
      o.textContent = f.name;
      sourceFilterEl.appendChild(o);
    });
    sourceFilterEl.value = activeSource;
  }

  function renderFooter() {
    var links = FEEDS.map(function (f) {
      return '<a href="' + f.url + '" target="_blank" rel="noopener noreferrer">' + f.name + "</a>";
    });
    el("sourceList").innerHTML = links.join(" · ");
  }

  // --- Events -----------------------------------------------------------------
  el("prevDay").addEventListener("click", function () { selectedDay = shiftDay(selectedDay, -1); render(); });
  el("nextDay").addEventListener("click", function () {
    if (selectedDay !== todayKey()) { selectedDay = shiftDay(selectedDay, 1); render(); }
  });
  el("todayBtn").addEventListener("click", function () { selectedDay = todayKey(); render(); });
  sourceFilterEl.addEventListener("change", function () { activeSource = sourceFilterEl.value; render(); });
  searchEl.addEventListener("input", function () { query = searchEl.value.trim(); render(); });
  refreshBtn.addEventListener("click", function () { localStorage.removeItem(CACHE_KEY); fetchAll(); });

  // --- Init ---------------------------------------------------------------------
  renderFooter();
  renderSourceFilter();
  var cached = loadCache();
  if (cached) {
    items = cached;
    render();
  } else {
    fetchAll();
  }
})();
