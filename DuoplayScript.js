var BASE_URL = "https://duoplay.ee";
var API_URL = "https://kanal2.ee";
var PLUGIN_ID = "2c8b9e1a-4f3d-4a2b-9c1e-8d7f6a5b4c3d";

var HTML_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://duoplay.ee",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

var API_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://duoplay.ee",
  "Origin": "https://duoplay.ee",
  "Accept": "application/json, text/plain, */*"
};

var SHOW_URL_REGEX = /^https?:\/\/(www\.)?duoplay\.ee\/(\d+)\/([^/?#]+)(\?ep=(\d+))?/i;

source.enable = function (conf, settings, savedState) {};

// --- AVALEHT ---
source.getHome = function () {
  var apiShows = fetchAllFromApi("");
  if (apiShows.length > 0) {
    return new VideoPager(apiShows, false, {}, function () {
      return new VideoPager([], false, {});
    });
  }
  return scrapeShowsFromHtml(BASE_URL, "");
};

// --- TÄIELIK OTSING ÜLE KOGU ARHIIVI ---
source.search = function (query, type, order, filters) {
  var apiShows = fetchAllFromApi(query);
  if (apiShows.length > 0) {
    return new VideoPager(apiShows, false, {}, function () {
      return new VideoPager([], false, {});
    });
  }
  return scrapeShowsFromHtml(BASE_URL, query);
};

source.searchSuggestions = function (query) {
  return [];
};

source.getSearchCapabilities = function () {
  return {
    types: [Type.Feed.Mixed],
    sorts: [Type.Order.Chronological],
    filters: []
  };
};

// --- KANAL (SAATE LEHT KOOS KÕIGI OSADEGA) ---
source.isChannelUrl = function (url) {
  return SHOW_URL_REGEX.test(url);
};

source.getChannel = function (url) {
  var cleanUrl = url.split("?")[0];
  var match = cleanUrl.match(SHOW_URL_REGEX);
  if (!match) {
    throw new ScriptException("Vigane saate URL");
  }

  var showId = String(match[2]);
  var resp = http.GET(cleanUrl, HTML_HEADERS, false);
  if (!resp.isOk) {
    throw new ScriptException("Saate lehe laadimine ebaõnnestus: " + resp.code);
  }

  var doc = domParser.parseFromString(resp.body, "text/html");
  var ogTitle = doc.querySelector('meta[property="og:title"]');
  var showTitle = ogTitle ? ogTitle.getAttribute("content").replace(/\s*-\s*Duoplay$/i, "").trim() : "Duoplay saade";

  var ogDesc = doc.querySelector('meta[property="og:description"]');
  var description = ogDesc ? ogDesc.getAttribute("content") : "";

  var player = doc.querySelector("video-player");
  var posterUrl = player ? (player.getAttribute("poster-url") || "https://duoplay.ee") : "https://duoplay.ee";

  return new PlatformChannel({
    id: new PlatformID("Duoplay", showId, PLUGIN_ID),
    name: showTitle,
    thumbnail: posterUrl,
    banner: posterUrl,
    subscribers: 0,
    description: description,
    url: cleanUrl,
    links: {}
  });
};

source.getChannelContents = function (url, type, order, filters) {
  var cleanUrl = url.split("?")[0];
  var match = cleanUrl.match(SHOW_URL_REGEX);
  if (!match) {
    throw new ScriptException("Vigane saate URL");
  }

  var showId = String(match[2]);
  var resp = http.GET(cleanUrl, HTML_HEADERS, false);
  if (!resp.isOk) {
    throw new ScriptException("Episoodide laadimine ebaõnnestus: " + resp.code);
  }

  var html = resp.body;
  var doc = domParser.parseFromString(html, "text/html");
  var ogTitle = doc.querySelector('meta[property="og:title"]');
  var showTitle = ogTitle ? ogTitle.getAttribute("content").replace(/\s*-\s*Duoplay$/i, "").trim() : "Duoplay saade";

  var player = doc.querySelector("video-player");
  var defaultPoster = player ? (player.getAttribute("poster-url") || "") : "";

  var videos = [];
  var seenEps = {};

  // 1. Proovi lugeda HTML-ist kõik ?ep= viited ja pealkirjad
  var episodeEls = doc.querySelectorAll("a.show-seasons__episode");
  for (var i = 0; i < episodeEls.length; i++) {
    var el = episodeEls[i];
    var href = el.getAttribute("href") || "";
    var epMatch = href.match(/ep=(\d+)/i);
    if (!epMatch) continue;

    var epNum = parseInt(epMatch[1], 10);
    if (seenEps[epNum]) continue;
    seenEps[epNum] = true;

    var seasonEl = el.querySelector(".show-seasons__headline-season");
    var seasonText = seasonEl ? seasonEl.textContent.replace(/\s+/g, " ").trim() : "";

    var descEl = el.querySelector(".show-seasons__description");
    var epName = descEl ? descEl.textContent.replace(/\s+/g, " ").trim() : "";

    var fullEpTitle = showTitle + " – Osa " + epNum;
    if (seasonText && epName) {
      fullEpTitle = seasonText + " – " + epName;
    } else if (seasonText) {
      fullEpTitle = showTitle + " (" + seasonText + ")";
    }

    var imgEl = el.querySelector("img");
    var thumbUrl = imgEl ? (imgEl.getAttribute("data-src") || imgEl.getAttribute("src") || defaultPoster) : defaultPoster;
    if (thumbUrl.indexOf("//") === 0) thumbUrl = "https:" + thumbUrl;

    videos.push(buildEpisodeVideo(showId, showTitle, cleanUrl, epNum, fullEpTitle, thumbUrl, i));
  }

  // 2. Kui Vue hoiab episoode dünaamiliselt, leia suurim osa number ja genereeri nimekiri
  if (videos.length === 0) {
    var epRegex = /\?ep=(\d+)/g;
    var m;
    var maxEp = 0;
    while ((m = epRegex.exec(html)) !== null) {
      var num = parseInt(m[1], 10);
      if (num > maxEp && num < 5000) maxEp = num;
    }

    if (maxEp > 0) {
      for (var ep = maxEp; ep >= 1; ep--) {
        videos.push(buildEpisodeVideo(
          showId,
          showTitle,
          cleanUrl,
          ep,
          showTitle + " – Osa " + ep,
          defaultPoster,
          maxEp - ep
        ));
      }
    } else {
      videos.push(buildEpisodeVideo(showId, showTitle, cleanUrl, 1, showTitle + " (Viimane osa)", defaultPoster, 0));
    }
  }

  return new VideoPager(videos, false, {}, function () {
    return new VideoPager([], false, {});
  });
};

function buildEpisodeVideo(showId, showTitle, cleanUrl, epNum, title, thumbUrl, indexOffset) {
  return new PlatformVideo({
    id: new PlatformID("Duoplay", showId + "_ep_" + epNum, PLUGIN_ID),
    name: title,
    thumbnails: new Thumbnails(thumbUrl ? [new Thumbnail(thumbUrl, 225)] : []),
    author: new PlatformAuthorLink(
      new PlatformID("Duoplay", showId, PLUGIN_ID),
      showTitle,
      cleanUrl,
      thumbUrl || "https://duoplay.ee"
    ),
    uploadDate: Math.floor(Date.now() / 1000) - indexOffset * 60,
    duration: 0,
    viewCount: 0,
    url: cleanUrl + "?ep=" + epNum,
    isLive: false
  });
}

// --- ÜKSIK VIDEO / EPISOOD ---
source.isContentDetailsUrl = function (url) {
  return SHOW_URL_REGEX.test(url);
};

source.getContentDetails = function (url) {
  var resp = http.GET(url, HTML_HEADERS, false);
  if (!resp.isOk) {
    throw new ScriptException("Lehe laadimine ebaõnnestus: " + resp.code);
  }

  var doc = domParser.parseFromString(resp.body, "text/html");
  var ogTitle = doc.querySelector('meta[property="og:title"]');
  var showTitle = ogTitle ? ogTitle.getAttribute("content").replace(/\s*-\s*Duoplay$/i, "").trim() : "Duoplay video";

  var episodeSubtitle = "";
  var h2Els = doc.querySelectorAll("h1, h2, .view-show__headline");
  for (var i = 0; i < h2Els.length; i++) {
    var txt = h2Els[i].textContent.replace(/\s+/g, " ").trim();
    if (txt && txt !== showTitle && txt.length > 2 && txt.length < 150) {
      episodeSubtitle = txt;
      break;
    }
  }

  var fullTitle = episodeSubtitle
    ? showTitle + " – " + episodeSubtitle
    : showTitle;

  var ogDesc = doc.querySelector('meta[property="og:description"]');
  var description = ogDesc ? ogDesc.getAttribute("content") : "";

  var player = doc.querySelector("video-player");
  if (!player) {
    throw new ScriptException("Seda osa ei leitud või pole see enam järelvaadatav.");
  }

  var manifestUrl = player.getAttribute("manifest-url");
  var posterUrl = player.getAttribute("poster-url") || "";

  if (!manifestUrl) {
    throw new ScriptException("Video voogu ei leitud.");
  }

  var cleanUrl = url.split("?")[0];
  var match = url.match(SHOW_URL_REGEX);
  var showId = match ? String(match[2]) : String(cleanUrl);
  var epId = match && match[5] ? String(match[5]) : "latest";

  return new PlatformVideoDetails({
    id: new PlatformID("Duoplay", showId + "_" + epId, PLUGIN_ID),
    name: fullTitle,
    thumbnails: new Thumbnails(posterUrl ? [new Thumbnail(posterUrl, 720)] : []),
    author: new PlatformAuthorLink(
      new PlatformID("Duoplay", showId, PLUGIN_ID),
      showTitle,
      cleanUrl,
      posterUrl || "https://duoplay.ee"
    ),
    uploadDate: Math.floor(Date.now() / 1000),
    duration: 0,
    viewCount: 0,
    url: url,
    isLive: false,
    description: description,
    video: new VideoSourceDescriptor([
      new HLSSource({
        name: "HLS Auto",
        url: manifestUrl,
        duration: 0
      })
    ])
  });
};

// --- ABIFUNKTSIOONID: API JA HTML OTSING ---
function fetchAllFromApi(query) {
  try {
    var apiUrl = API_URL + "/telecasts?limit=1000";
    var resp = http.GET(apiUrl, API_HEADERS, false);
    if (!resp.isOk) return [];

    var json = JSON.parse(resp.body);
    var items = json.data || [];
    var results = [];
    var q = query ? query.trim().toLowerCase() : "";

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item || !item.title || !item.id || !item.slug) continue;

      if (q && item.title.toLowerCase().indexOf(q) === -1) {
        continue;
      }

      var showUrl = BASE_URL + "/" + item.id + "/" + item.slug;
      var thumbUrl = (item.images && (item.images["400x225"] || item.images["270x180"])) || item.image || "";
      if (thumbUrl.indexOf("//") === 0) {
        thumbUrl = "https:" + thumbUrl;
      }

      results.push(new PlatformVideo({
        id: new PlatformID("Duoplay", String(item.id), PLUGIN_ID),

        name: item.title,
        thumbnails: new Thumbnails(thumbUrl ? [new Thumbnail(thumbUrl, 225)] : []),
        author: new PlatformAuthorLink(
          new PlatformID("Duoplay", String(item.id), PLUGIN_ID),
          item.title,
          showUrl,
          item.channel_logo || thumbUrl || "https://duoplay.ee"
        ),
        uploadDate: Math.floor(Date.now() / 1000),
        duration: 0,
        viewCount: 0,
        url: showUrl,
        isLive: false
      }));
    }

    return results;
  } catch (e) {
    return [];
  }
}

function scrapeShowsFromHtml(pageUrl, query) {
  var resp = http.GET(pageUrl, HTML_HEADERS, false);
  if (!resp.isOk) {
    throw new ScriptException("Duoplay lehe laadimine ebaõnnestus: " + resp.code);
  }

  var doc = domParser.parseFromString(resp.body, "text/html");
  var links = doc.querySelectorAll("a[href]");
  var results = [];
  var seenIds = {};
  var q = query ? query.trim().toLowerCase() : "";

  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var href = a.getAttribute("href");
    if (!href) continue;

    var fullUrl = href.indexOf("http") === 0 ? href.replace(/^http:\/\//i, "https://") : BASE_URL + (href.indexOf("/") === 0 ? href : "/" + href);
    var cleanUrl = fullUrl.split("?")[0];
    var match = cleanUrl.match(SHOW_URL_REGEX);
    if (!match) continue;

    var showId = String(match[2]);
    if (seenIds[showId]) continue;

    var img = a.querySelector("img");
    var title = "";
    if (img && img.getAttribute("alt")) {
      title = img.getAttribute("alt").trim();
    }
    if (!title) {
      title = a.textContent.replace(/\s+/g, " ").trim();
    }
    if (!title || title.length < 2) continue;

    if (q && title.toLowerCase().indexOf(q) === -1) {
      continue;
    }

    seenIds[showId] = true;

    var thumbUrl = a.getAttribute("data-lazy-src") || "";
    if (!thumbUrl && img) {
      thumbUrl = img.getAttribute("data-src") || img.getAttribute("src") || "";
    }
    if (thumbUrl.indexOf("//") === 0) {
      thumbUrl = "https:" + thumbUrl;
    } else if (thumbUrl.indexOf("/") === 0) {
      thumbUrl = BASE_URL + thumbUrl;
    }

    results.push(new PlatformVideo({
      id: new PlatformID("Duoplay", showId, PLUGIN_ID),
      name: title,
      thumbnails: new Thumbnails(thumbUrl ? [new Thumbnail(thumbUrl, 225)] : []),
      author: new PlatformAuthorLink(
        new PlatformID("Duoplay", showId, PLUGIN_ID),
        title,
        cleanUrl,
        thumbUrl || "https://duoplay.ee"
      ),
      uploadDate: Math.floor(Date.now() / 1000),
      duration: 0,
      viewCount: 0,
      url: cleanUrl,
      isLive: false
    }));
  }

  return new VideoPager(results, false, {}, function () {
    return new VideoPager([], false, {});
  });
}

