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
    { key: "omroepzeeland", name: "Omroep Zeeland", region: "zeeland", url: "https://www.omroepzeeland.nl/rss/index.xml" },
    { key: "pzc", name: "PZC", region: "zeeland", url: "https://news.google.com/rss/search?q=site:pzc.nl+zeeland&hl=nl&gl=NL&ceid=NL:nl" },
    { key: "bndestem", name: "BN DeStem", region: "zeeland", url: "https://news.google.com/rss/search?q=site:bndestem.nl+zeeland&hl=nl&gl=NL&ceid=NL:nl" },
    { key: "hvzeeland", name: "HVZeeland", region: "zeeland", url: "https://www.hvzeeland.nl/RSS/Nieuws" },
    { key: "zvl", name: "Omroep ZVL", region: "zeeland", url: "https://www.omroepzvl.nl/files/202509/sitemaps/1/sitemap_0.xml" },
    { key: "avs", name: "AVS (Oost-Vlaanderen)", region: "vlaanderen", url: "https://avs.be/sitemaps-1-section-news-1-sitemap.xml" }
  ];
  var REGIONS = [
    { key: "zeeland", name: "Zeeland" },
    { key: "vlaanderen", name: "Vlaanderen (Oost-Vlaanderen)" }
  ];
  var CATEGORIES = [
    { key: "sport", name: "Sport" },
    { key: "breaking", name: "Nieuwsflitsen" },
    { key: "politiek", name: "Politiek" },
    { key: "economie", name: "Economie" },
    { key: "milieu", name: "Milieu & Natuur" },
    { key: "recreatie", name: "Recreatie & Uitgaan" },
    { key: "cultuur", name: "Cultuur & Media" },
    { key: "onderwijs", name: "Onderwijs & Jeugd" },
    { key: "gezondheid", name: "Gezondheid & Zorg" },
    { key: "verkeer", name: "Verkeer & Vervoer" },
    { key: "landbouw", name: "Landbouw & Visserij" }
  ];
  // Keyword-based classification (title + description). Categories are
  // checked in priority order; the first with a match wins. Sport and
  // breaking news come first so outdoor/event items don't get pulled
  // into Milieu & Natuur by broad words like "natuur" or "kust".
  var CATEGORY_KEYWORDS = {
    sport: ["voetbal", "wedstrijd", "uitslagen", "eindstand", "kustmarathon", "marathon", "wielrennen", "wieler", "koers", "scheldeprijs", "hardlopen", "atletiek", "atlete", "tennis", "hockey", "volleybal", "handbal", "basketbal", "zwemwedstrijd", "schaats", "judoka", "bokser", "kickboks", "mma", "frisbee", "gevechtssport", "kampioen", "titelgevecht", "titelkandidaat", "beker", "competitie", "divisievoetbal", "amateurvoetbal", "ongeslagen", "wint", "zege", "verliest", "verlies van", "revelatie", "degradatie", "promotie", "trainer", "coach", "speler", "speelster", "selectie", "opstelling", "doelpunt", "assists", "defensive", "kloetinge", "de treffers", "rijnsburgse", "hoek geeft", "hsv hoek", "jong sparta", "volendam", "dunkerbeck", "windsurf", "dam-x", "triatlon", "triatlonweekend", "ladiesrun", "trailrun", "kustrun", "ironman", "rive", "ronde van", "tour", "ek wielrennen", "olympische", "olympische spellen", "golfer", "paardensport", "springruiter", "dressuur", "zeilwedstrijd", "breskens sailing", "roeien", "roeivereniging", "kano", "kajak"],
    breaking: ["politie", "brandweer", "ambulance", "ongeval", "aanrijding", "botsing", "brand", "klapt", "dood", "dode", "overleden", "vermoord", "moord", "doding", "slachtoffer", "gewond", "gewonden", "zwaargewond", "levensgevaar", "spoed", "112", "traumahelikopter", "reddings", "vermist", "vermissing", "aangehouden", "arrestatie", "opgepakt", "verdachte", "inbraak", "diefstal", "overval", "nepagenten", "vechtpartij", "steekpartij", "schietpartij", "explosie", "gaslek", "placeverbod", "bekeuringen", "rijbewijs ingenomen", "rijbewijs inleveren", "dronken bestuurder", "flitstaking", "rechtbank", "parket", "justitie", "recherche", "opsporingsbericht", "cyberaanval", "datalek", "hacker", "oplichting", "afpersing", "verkrachting", "aanranding", "mishandeling", "sloopkogel", "sloop", "ontruimd", "evacuatie"],
    politiek: ["gemeenteraad", "provincieraad", "provinciebestuur", "gedeputeerde", "gouverneur", "burgemeester", "wethouder", "schepen", "college van b&w", "college van burgemeester", "parlement", "tweede kamer", "eerste kamer", "minister", "raadsvergadering", "raadsbesluit", "raad stemt", "stemt in met", "motie", "amendement", "wetsvoorstel", "grondruil", "ontheffing", "subsidie", "begroting", "belasting", "heffing", "tarieven", "coalitie", "coalitieakkoord", "oppositie", "verkiezing", "partij", "cda", "vvd", "d66", "pvda", "groenlinks", "n-va", "open vld", "cd&v", "vooruit", "vlaams belang", "provinciale staten", "vlaamse regering", "besparing", "besparingen", "protest", "demonstratie", "betoging", "prinsjesdag", "beleid", "regelgeving", "regeling", "ambtenaren", "bestuur", "stikstofzones", "azc", "asielzoekers", "opvanglocatie", "opvangcentrum", "vluchtelingen"],
    economie: ["economie", "bedrijf", "bedrijven", "ondernemer", "ondernemers", "werkgelegenheid", "vacature", "vacatures", "sollicit", "investering", "investeringen", "miljoen", "miljoenen", "omzet", "winst", "faillissement", "haven", "north sea port", "industrie", "fabriek", "logistiek", "hotel", "hotels", "horeca", "winkel", "winkels", "winkelcentrum", "supermarkt", "vastgoed", "bedrijventerrein", "kerncentrale", "kernenergie", "smr", "datacenter", "start-up", "startup", "scale-up", "personeel", "jobs", "sollicitanten", "loon", "lonen", "cao", "vakbond", "staking", "arbeidsmarkt", "werkloosheid", "ontslag", "arbeiders", "arbeiders", "havenbedrijven", "talent-sharing", "werkgevers", "uitkeringen", "uwv", "leidt", "baan", "banen", "kansen op de arbeidsmarkt", "toekomst van het werk"],
    milieu: ["milieu", "klimaat", "stikstof", "biodiversiteit", "waterkwaliteit", "waterstand", "wateroverlast", "afval", "recyclage", "recycling", "pfas", "co2", "uitstoot", "emissie", "bodem", "drinkwater", "kraanwater", "grondwater", "waterstof", "warmtenet", "aardwarmte", "zonnepark", "windturbine", "windturbines", "windmolen", "windmolens", "zonnepaneel", "zonnepanelen", "dijk", "dijken", "dijkverzwaring", "kustverdediging", "zandsuppletie", "zeearend", "vogeldetectie", "natuurbeheer", "natuurgebied", "natuurpark", "staatsbosbeheer", "boswerkzaamheden", "duinen", "westerschelde", "oosterschelde", "zeehond", "zeehonden", "vinvis", "walvis", "dolfijn", "trekvogels", "tijgermug", "invasieve", "exoot", "exoten", "duurzaam", "duurzame", "verduurzaming", "circulair", "circulaire", "grondstof", "grondstoffen", "milieurapport", "vergunning", "luchtkwaliteit", "schone lucht", "energiebedrijf", "energie"],
    recreatie: ["recreatie", "uitgaan", "festival", "feest", "kermis", "braderie", "kunstweekend", "openluchtbioscoop", "bioscoop", "filmfestival", "film by the sea", "toneel", "theater", "scheldetheater", "muziek", "concert", "benefietconcert", "kroegentocht", "camping", "kamperen", "toerist", "toeristen", "toeristische", "dagje weg", "uitje", "uitstapje", "picknick", "wereldpicknick", "barbecue", "brunch", "lunch", "restaurant", "eetcafe", "paviljoen", "strand", "zwembad", "pretpark", "speeltuin", "kinderverrassing", "familiedag", "high tea", "wandelen", "wandeling", "wandelmarathon", "fietsen", "fietstocht", "rondje", "excursie", "workshop", "cursus", "lezing", "expositie", "tentoonstelling", "rondleiding", "open dag", "openmonumentendag", "monument", "monumenten", "monumentale", "kasteel", "molen", "molens", "museum", "musea", "trouw", "trouwbeurs", "bruiloft", "verjaardag", "jubileum", "jubileumeditie", "jubilee", "optreden", "podium", "dancefeest", "kermis", "textielrace", "spaghettifeest", "souplesse", "ontbijt", "muziek", "sfeerbeelden", "landelijke sferen", "boerenerf fair", "oldtimerrit", "trouw", "lunch", "dineren"],
    cultuur: ["cultuur", "cultuursector", "kunst", "kunstenaar", "kunstwerk", "schilderij", "muurschildering", "sculptuur", "beeldhouwer", "fotografie", "fototentoonstelling", "boek", "boeken", "literatuur", "schrijver", "dichter", "boekenweek", "kinderboekenweek", "gedicht", "roman", "nobelprijs literatuur", "muzikant", "zanger", "zangeres", "orkest", "koor", "piano", "123 piano", "dans", "ballet", "opera", "musical", "podiumkunsten", "film", "cinema", "regisseur", "documentaire", "televisie", "radio", "omroep", "uitzending", "podcast", "media", "journalist", "verslaggever", "redactie", "erfgoed", "cultureel", "historisch", "geschiedenis", "heemkunde", "heemkundige", "archief", "archeologie", "opgraving", "toren", "literair", "boekpresentatie", "vrijwilligersbeeld", "vrijwilligerswerk", "vrijwilligers", "koninklijk onderscheiden", "koninklijke onderscheiding", "lintje", "lid van verdienste"],
    onderwijs: ["onderwijs", "school", "scholen", "basisschool", "basisscholen", "middelbare school", "middelbaar", "college", "hogent", "hogeschool", "universiteit", "ugent", "student", "studenten", "scholier", "scholieren", "leerling", "leerlingen", "kleuter", "kleuters", "kinderopvang", "crèche", "voorschool", "klas", "leraar", "leraren", "leerkracht", "leerkrachten", "docent", "rector", "schoolbestuur", "schooljaar", "academiejaar", "examen", "diploma", "studeren", "stage", "les", "lessen", "telefoonverbod", "schoolhoeve", "vak", "jeugd", "jongeren", "jongere", "jeugdwerk", "jeugdvereniging", "jeugdhuis", "chiro", "scouts", "jeugdbeweging", "jeugdraad", "kinderraad", "jeugdrechtbank", "jeugdrechter", "kinderen", "kind", "speelplein", "zomerkamp", "jeugdkamp", "onderwijsbeleid", "leerplan", "gratie", "escaldascholen", "reynaertcollege", "lodewijk college", "zwin college", "sbo de brug", "basisonderwijs"],
    gezondheid: ["gezondheid", "zorg", "zorgcentrum", "zorgverleners", "ziekenhuis", "az sint-lucas", "az gent", "uz gent", "huisarts", "dokter", "arts", "artsen", "verpleegkundige", "verpleegkundigen", "patient", "patiënten", "kanker", "borstkanker", "chemotherapie", "operatie", "chirurg", "medisch", "medische", "geneeskunde", "vaccin", "vaccinatie", "besmetting", "uitbraak", "epidemie", "griep", "corona", "covid", "diabetes", "dementie", "alzheimer", "revalidatie", "fysiotherapie", "psycholoog", "psychisch", "mentaal", "mentale", "welzijn", "welzijns", "eenzaamheid", "depressie", "burn-out", "burnout", "verslaving", "drugs", "drugsproblematiek", "drugsmonitor", "alcohol", "voeding", "obesitas", "fitness", "jims", "zwangerschap", "bevalling", "kraam", "babyhuis", "ouder", "ouders", "gezin", "gezinnen", "opvoeding", "thuiszorg", "kraamzorg", "kind en gezin", "gezondheidscentrum", "eerste hulp", "reanimatie", "ehbo", "defibrillator", "donor", "bloeddonatie", "apotheek", "medicatie", "medicijn", "medicijnen", "anesthesisten", "ambulancepost", "opvang", "woonzorgcentrum", "verstandelijke beperking", "gehandicapte", "zzp", "sociale dienst", "schuld", "schulden", "maatje", "valpreventie", "fysiek", "vitaliteit", "vitaal"],
    verkeer: ["verkeer", "verkeersongeval", "verkeerssituatie", "verkeerscontrole", "verkeersles", "verkeersveilig", "mobiliteit", "mobiliteitsbudget", "mobiliteitshubs", "vervoer", "vervoersplan", "vervoersarmoede", "openbaar vervoer", "bus", "bussen", "trein", "treinen", "treinregeling", "spoor", "spoorwerken", "spooronderhoud", "station", "perron", "reizigers", "wegwerkzaamheden", "asfalt", "voegovergangen", "rijstrook", "afsluiting", "afgesloten", "dicht voor", "omleiding", "file", "files", "weggebruiker", "voetganger", "fiets", "fietsers", "fietspad", "fietstaxi", "fietstaxis", "fietsbrug", "pumptrack", "pumptrackbaan", "verkeersbord", "snelheidsbeperking", "flitspaal", "tol", "tolvignet", "tunnel", "westerscheldetunnel", "brug", "bruggen", "vossemeersebrug", "firtelbrug", "sluis", "sluizen", "kade", "kaai", "parkeer", "parkeren", "parkeerboetes", "parkeerzone", "parking", "verkeersmaatregel", "straatlicht", "straatverlichting", "slimme", "rotonde", "rondpunt", "knooppunt", "wegennet", "snelweg", "a58", "n57", "n61", "n290", "n60", "e34", "e40", "e17", "pont", "veerpont", "veerdienst", "voetveer", "weg", "rijdt", "auto", "automobilist", "automobiliste", "bestuurder", "bestuurster", "motorrijder", "scooter", "scooterbestuurder", "vrachtwagen", "bestelbus", "tram", "metro", "luchthaven", "hubs", "stroom", "filevrij", "doorstroming", "uitval", "parkeergelegenheid"],
    landbouw: ["landbouw", "akkerbouw", "tuinbouw", "boer", "boeren", "melkboer", "veeteelt", "pluimvee", "varkens", "rundvee", "koeien", "kaas", "boerderij", "hoeve", "mest", "gewas", "oogst", "oogsten", "aardappel", "aardappelen", "tarwe", "graan", "suikerbiet", "bieten", "appels", "fruitteelt", "boomgaard", "boomgaarden", "druiven", "wijnbouw", "aardbeien", "asperges", "champignons", "serres", "serre", "kassen", "landbouwmachines", "tractor", "tractors", "hooien", "grasland", "weide", "schapen", "kudde", "herder", "biologisch", "platteland", "agrarisch", "agrarische", "pachter", "akker", "akkers", "landgebruik", "visser", "vissers", "visserij", "kotter", "netten", "quota", "vissen", "aquacultuur", "oester", "oesters", "mosselen", "mossel", "mosselkweker", "kreeft", "garnalen", "vangst", "visafslag", "vlas", "coöperatie", "veiling", "tuinders", "tuinder", "kwekerij", "kwekerijen", "landbouwbeleid", "glastuinbouw"]
  };
  // Token-based matching: words are compared on word boundaries with Dutch
  // plural stripping (simple Snowball-style suffix rules), so "boerderij"
  // matches "boerderijen" but "weg" no longer matches "inweg". Keywords
  // containing spaces or hyphens are matched as phrases on word boundaries.
  function tokenize(text) {
    return text.toLowerCase()
      .split(/[^a-z0-9&\u00C0-\u017F]+/)
      .filter(function (w) { return w.length > 1; });
  }
  var PLURAL_SUFFIXES = ["eren", "en", "s", "'s", "es", "eren "];
  function isPluralOf(word, base) {
    if (word === base) return true;
    if (word.length <= base.length) return false;
    for (var i = 0; i < PLURAL_SUFFIXES.length; i++) {
      if (word === base + PLURAL_SUFFIXES[i]) return true;
    }
    return false;
  }
  function textHasKeyword(tokens, keyword) {
    var kw = keyword.toLowerCase();
    if (kw.indexOf(" ") !== -1 || kw.indexOf("-") !== -1) {
      var phrase = kw.replace(/-/g, " ");
      return (" " + tokens.join(" ") + " ").indexOf(" " + phrase + " ") !== -1;
    }
    for (var i = 0; i < tokens.length; i++) {
      if (isPluralOf(tokens[i], kw) || isPluralOf(kw, tokens[i])) return true;
    }
    return false;
  }
  function classifyItem(it) {
    var tokens = tokenize(it.title + " " + (it.description || ""));
    for (var i = 0; i < CATEGORIES.length; i++) {
      var cat = CATEGORIES[i];
      var kws = CATEGORY_KEYWORDS[cat.key] || [];
      for (var j = 0; j < kws.length; j++) {
        if (textHasKeyword(tokens, kws[j])) return cat.key;
      }
    }
    return null;
  }

  var DAYS_TO_SHOW = 3;         // keep items from the last N days in memory
  var CACHE_KEY = "zeeland-vandaag-cache";
  var SETTINGS_KEY = "zeeland-vandaag-settings";
  var CACHE_TTL_MS = 15 * 60 * 1000;

  // --- State ---------------------------------------------------------------
  var items = [];
  var selectedDay = todayKey();
  var activeSources = [];      // empty = all sources
  var activeCategories = [];    // empty = all categories
  var query = "";

  // --- DOM -------------------------------------------------------------------
  var el = function (id) { return document.getElementById(id); };
  var statusEl = el("status");
  var listEl = el("newsList");
  var summaryEl = el("summary");
  var dayLabelEl = el("dayLabel");
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
          if (!r.ok) {
            return r.text().catch(function () { return ""; }).then(function (t) {
              var detail = (t || "").split("\n")[0].slice(0, 120);
              throw new Error(feed.name + ": HTTP " + r.status + (detail ? " — " + detail : ""));
            });
          }
          return r.text().then(function (text) {
            if (!text || text.length < 40) throw new Error(feed.name + ": leeg antwoord van proxy");
            return text;
          });
        })
        .then(function (text) {
          var parsed = parseRssText(text);
          parsed.forEach(function (it) {
            it.sourceKey = feed.key;
            it.sourceName = feed.name;
            it.region = feed.region;
            it.category = classifyItem(it);
          });
          return parsed;
        })
        .catch(function (err) {
          console.warn("Feed mislukt:", feed.name, err);
          var reason = err && err.message ? err.message : "onbekende fout";
          var m = reason.match(/:\s*(.+)$/);
          return { failed: feed.name + " (" + (m ? m[1] : reason) + ")" };
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
    if (activeSources.length) dayItems = dayItems.filter(function (it) { return activeSources.indexOf(it.sourceKey) !== -1; });
    if (activeCategories.length) {
      dayItems = dayItems.filter(function (it) { return it.category && activeCategories.indexOf(it.category) !== -1; });
    }
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
    REGIONS.forEach(function (region) {
      var regionItems = dayItems.filter(function (it) { return it.region === region.key; });
      if (!regionItems.length) return;
      var heading = document.createElement("h2");
      heading.className = "region-header";
      heading.textContent = region.name + " (" + regionItems.length + ")";
      frag.appendChild(heading);
      regionItems.forEach(function (it) {
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
      if (it.category) {
        var catName = "";
        CATEGORIES.forEach(function (c) { if (c.key === it.category) catName = c.name; });
        if (catName) {
          var cat = document.createElement("span");
          cat.className = "cat-tag cat-" + it.category;
          cat.textContent = catName;
          meta.appendChild(cat);
        }
      }
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

  function makeChipGroup(containerId, entries, selected, onToggle) {
    var container = el(containerId);
    if (!container) return;
    container.innerHTML = "";
    entries.forEach(function (entry) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (selected.indexOf(entry.key) !== -1 ? " chip-on" : "");
      chip.textContent = entry.name;
      chip.setAttribute("aria-pressed", selected.indexOf(entry.key) !== -1 ? "true" : "false");
      chip.addEventListener("click", function () {
        var idx = selected.indexOf(entry.key);
        if (idx === -1) selected.push(entry.key);
        else selected.splice(idx, 1);
        chip.classList.toggle("chip-on");
        chip.setAttribute("aria-pressed", idx === -1 ? "true" : "false");
        onToggle();
      });
      container.appendChild(chip);
    });
  }

  function renderCategoryFilter() {
    makeChipGroup("categoryFilters", CATEGORIES, activeCategories, function () {
      saveSettings();
      render();
    });
  }

  function renderSourceFilter() {
    makeChipGroup("sourceFilters", FEEDS, activeSources, function () {
      saveSettings();
      render();
    });
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
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        sources: activeSources,
        categories: activeCategories,
        query: query
      }));
    } catch (e) { /* negeren */ }
  }
  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (Array.isArray(s.sources)) {
        activeSources = s.sources.filter(function (k) {
          return FEEDS.some(function (f) { return f.key === k; });
        });
      } else if (s.source) {
        activeSources = [s.source];
      }
      if (Array.isArray(s.categories)) {
        activeCategories = s.categories.filter(function (k) {
          return CATEGORIES.some(function (c) { return c.key === k; });
        });
      } else if (s.category) {
        activeCategories = [s.category];
      }
      if (s.query) query = s.query;
    } catch (e) { /* negeren */ }
  }
  searchEl.addEventListener("input", function () { query = searchEl.value.trim(); saveSettings(); render(); });
  refreshBtn.addEventListener("click", function () { localStorage.removeItem(CACHE_KEY); fetchAll(); });

  // --- Init ---------------------------------------------------------------------
  loadSettings();
  renderFooter();
  renderSourceFilter();
  renderCategoryFilter();
  searchEl.value = query;
  var cached = loadCache();
  if (cached) {
    items = cached;
    render();
  } else {
    fetchAll();
  }
})();
