source.isChannelUrl = function (url) {
  return JUPITER_URL_REGEX.test(url);
};

source.getChannel = function (url) {
  var match = url.match(JUPITER_URL_REGEX);
  if (!match) throw new ScriptException("Vigane Jupiteri URL");

  var contentId = match[2];
  var apiUrl = SERVICES_URL + "/api/v2/vodContent/getContentPageData?contentId=" + contentId + "&rootId=3905&page=web";
  var resp = http.GET(apiUrl, API_HEADERS, false);
  if (!resp.isOk) throw new ScriptException("Saate andmete laadimine ebaõnnestus");

  var data = JSON.parse(resp.body).data || {};
  var target = data.rootContent || data.mainContent || {};
  var thumbUrl = extractErrPhoto(target);

  return new PlatformChannel({
    id: new PlatformID("Jupiter", String(target.id || contentId), PLUGIN_ID),
    name: target.heading || "ERR Jupiter",
    thumbnail: thumbUrl || "https://err.ee",
    banner: thumbUrl || "https://err.ee",
    subscribers: 0,
    description: stripHtmlTags(target.lead || ""),
    url: url,
    links: {}
  });
};

source.getChannelContents = function (url, type, order, filters) {
  var match = url.match(JUPITER_URL_REGEX);
  if (!match) throw new ScriptException("Vigane Jupiteri URL");

  var contentId = match[2];
  var apiUrl = SERVICES_URL + "/api/v2/vodContent/getContentPageData?contentId=" + contentId + "&rootId=3905&page=web";
  var resp = http.GET(apiUrl, API_HEADERS, false);
  if (!resp.isOk) return new VideoPager([], false, {});

  var data = JSON.parse(resp.body).data || {};
  var root = data.rootContent || data.mainContent || {};
  var seriesId = String(root.id || contentId);
  var seriesTitle = root.heading || "ERR Jupiter";
  var defaultThumb = extractErrPhoto(root);
  var fancySlug = root.url || "saade";

  var seasons = (data.seasonList && data.seasonList.items) ? data.seasonList.items : [];
  if (seasons.length === 0) {
    return new VideoPager([], false, {});
  }

  // Alustame esimesest hooajast (indeks 0) ja liigume kerimisel vanemate hooaegadeni
  return buildSeasonPager(seasons, 0, data, seriesId, seriesTitle, defaultThumb, fancySlug);
};

function buildSeasonPager(seasons, seasonIndex, preloadedData, seriesId, seriesTitle, defaultThumb, fancySlug) {
  if (seasonIndex >= seasons.length) {
    return new VideoPager([], false, {});
  }

  var seasonObj = seasons[seasonIndex];
  var epList = [];

  // Kui episoodid on juba olemas (nt 1. hooaeg esimesel päringul), kasuta neid kohe
  if (seasonObj.contents && seasonObj.contents.length > 0) {
    epList = seasonObj.contents;
  } else if (seasonObj.firstContentId) {
    // Muidu päri vanema hooaja andmed selle hooaja esimese episoodi ID järgi
    var sUrl = SERVICES_URL + "/api/v2/vodContent/getContentPageData?contentId=" + seasonObj.firstContentId + "&rootId=3905&page=web";
    var sResp = http.GET(sUrl, API_HEADERS, false);
    if (sResp.isOk) {
      var sData = JSON.parse(sResp.body).data || {};
      var sItems = (sData.seasonList && sData.seasonList.items) ? sData.seasonList.items : [];
      for (var k = 0; k < sItems.length; k++) {
        if (sItems[k].id === seasonObj.id && sItems[k].contents) {
          epList = sItems[k].contents;
          break;
        }
      }
    }
  }

  var videos = [];
  for (var e = 0; e < epList.length; e++) {
    var ep = epList[e];
    var epThumb = extractErrPhoto(ep) || defaultThumb;
    var epTitle = ep.heading || seriesTitle;
    if (ep.season && ep.episode) {
      epTitle += " | " + ep.season + ". hooaeg, " + ep.episode + ". osa";
    } else if (seasonObj.name) {
      epTitle += " | " + seasonObj.name + ". hooaeg";
    }

    videos.push(new PlatformVideo({
      id: new PlatformID("Jupiter", String(ep.id), PLUGIN_ID),
      name: epTitle,
      thumbnails: new Thumbnails(epThumb ? [new Thumbnail(epThumb, 225)] : []),
      author: new PlatformAuthorLink(
        new PlatformID("Jupiter", seriesId, PLUGIN_ID),
        seriesTitle,
        BASE_URL + "/" + seriesId + "/" + fancySlug,
        defaultThumb || "https://err.ee"
      ),
      uploadDate: ep.publicStart || Math.floor(Date.now() / 1000),
      duration: 0,
      viewCount: 0,
      url: ep.url || (BASE_URL + "/" + ep.id + "/" + fancySlug),
      isLive: false
    }));
  }

  var nextIndex = seasonIndex + 1;
  var hasMore = nextIndex < seasons.length;

  return new VideoPager(
    videos,
    hasMore,
    { nextIndex: nextIndex },
    function (ctx) {
      var idx = (ctx && ctx.nextIndex !== undefined) ? ctx.nextIndex : nextIndex;
      return buildSeasonPager(seasons, idx, null, seriesId, seriesTitle, defaultThumb, fancySlug);
    }
  );
}

source.isChannelUrl = function (url) {
  return JUPITER_URL_REGEX.test(url);
};

source.getChannel = function (url) {
  if (!JUPITER_URL_REGEX.test(url)) throw new ScriptException("Vigane Jupiteri URL");

  var contentId = url.replace(JUPITER_URL_REGEX, "$2").split("/").shift().split("?").shift();
  var apiUrl = SERVICES_URL + "/api/v2/vodContent/getContentPageData?contentId=" + contentId + "&rootId=3905&page=web";
  var resp = http.GET(apiUrl, API_HEADERS, false);
  if (!resp.isOk) throw new ScriptException("Saate andmete laadimine ebaõnnestus");

  var data = JSON.parse(resp.body).data || {};
  var target = data.rootContent || data.mainContent || {};
  var thumbUrl = extractErrPhoto(target);

  return new PlatformChannel({
    id: new PlatformID("Jupiter", String(target.id || contentId), PLUGIN_ID),
    name: target.heading || "ERR Jupiter",
    thumbnail: thumbUrl || "https://err.ee",
    banner: thumbUrl || "https://err.ee",
    subscribers: 0,
    description: stripHtmlTags(target.lead || ""),
    url: url,
    links: {}
  });
};

source.getChannelContents = function (url, type, order, filters) {
  if (!JUPITER_URL_REGEX.test(url)) throw new ScriptException("Vigane Jupiteri URL");

  var contentId = url.replace(JUPITER_URL_REGEX, "$2").split("/").shift().split("?").shift();
  var apiUrl = SERVICES_URL + "/api/v2/vodContent/getContentPageData?contentId=" + contentId + "&rootId=3905&page=web";
  var resp = http.GET(apiUrl, API_HEADERS, false);
  if (!resp.isOk) return new VideoPager([], false, {});

  var data = JSON.parse(resp.body).data || {};
  var root = data.rootContent || data.mainContent || {};
  var seriesId = String(root.id || contentId);
  var seriesTitle = root.heading || "ERR Jupiter";
  var defaultThumb = extractErrPhoto(root);
  var fancySlug = root.url || "saade";

  var seasons = (data.seasonList && data.seasonList.items) ? data.seasonList.items : [];
  if (seasons.length === 0) {
    return new VideoPager([], false, {});
  }

  return buildSeasonPager(seasons, 0, data, seriesId, seriesTitle, defaultThumb, fancySlug);
};

function buildSeasonPager(seasons, seasonIndex, preloadedData, seriesId, seriesTitle, defaultThumb, fancySlug) {
  if (seasonIndex >= seasons.length) {
    return new VideoPager([], false, {});
  }

  var seasonObj = seasons[seasonIndex];
  var epList = [];

  if (seasonObj.contents && seasonObj.contents.length > 0) {
    epList = seasonObj.contents;
  } else if (seasonObj.firstContentId) {
    var sUrl = SERVICES_URL + "/api/v2/vodContent/getContentPageData?contentId=" + seasonObj.firstContentId + "&rootId=3905&page=web";
    var sResp = http.GET(sUrl, API_HEADERS, false);
    if (sResp.isOk) {
      var sData = JSON.parse(sResp.body).data || {};
      var sItems = (sData.seasonList && sData.seasonList.items) ? sData.seasonList.items : [];
      for (var k = 0; k < sItems.length; k++) {
        if (sItems[k].id === seasonObj.id && sItems[k].contents) {
          epList = sItems[k].contents;
          break;
        }
      }
    }
  }

  var videos = [];
  for (var e = 0; e < epList.length; e++) {
    var ep = epList[e];
    var epThumb = extractErrPhoto(ep) || defaultThumb;
    var epTitle = ep.heading || seriesTitle;
    if (ep.season && ep.episode) {
      epTitle += " | " + ep.season + ". hooaeg, " + ep.episode + ". osa";
    } else if (seasonObj.name) {
      epTitle += " | " + seasonObj.name + ". hooaeg";
    }

    videos.push(new PlatformVideo({
      id: new PlatformID("Jupiter", String(ep.id), PLUGIN_ID),
      name: epTitle,
      thumbnails: new Thumbnails(epThumb ? [new Thumbnail(epThumb, 225)] : []),
      author: new PlatformAuthorLink(
        new PlatformID("Jupiter", seriesId, PLUGIN_ID),
        seriesTitle,
        BASE_URL + "/" + seriesId + "/" + fancySlug,
        defaultThumb || "https://err.ee"
      ),
      uploadDate: ep.publicStart || Math.floor(Date.now() / 1000),
      duration: 0,
      viewCount: 0,
      url: ep.url || (BASE_URL + "/" + ep.id + "/" + fancySlug),
      isLive: false
    }));
  }

  var nextIndex = seasonIndex + 1;
  var hasMore = nextIndex < seasons.length;

  return new VideoPager(
    videos,
    hasMore,
    { nextIndex: nextIndex },
    function (ctx) {
      var idx = (ctx && ctx.nextIndex !== undefined) ? ctx.nextIndex : nextIndex;
      return buildSeasonPager(seasons, idx, null, seriesId, seriesTitle, defaultThumb, fancySlug);
    }
  );
}

function resolveErrLiveStreamUrl(liveId, fallbackUrl) {
  try {
    var otseBase = "https://otse.err.ee/k/";
    var pageMap = {
      "etv": otseBase + "etv",
      "etv2": otseBase + "etv2",
      "etvpluss": otseBase + "etvpluss"
    };
    var pageUrl = pageMap[String(liveId).toLowerCase()];
    if (!pageUrl) return fallbackUrl;

    var resp = http.GET(pageUrl, {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://jupiter.err.ee/"
    }, false);

    if (resp.isOk && resp.body) {
      var match = resp.body.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (match && match[0]) {
        return match[0].replace(/\\\//g, "/");
      }
    }
  } catch (e) {}
  return fallbackUrl;
}

function getLiveScheduleInfo(liveId) {
  try {
    var sectionMap = {
      "etv": "ETV",
      "etv2": "ETV2",
      "etvpluss": "ETV+"
    };
    var targetHeader = sectionMap[String(liveId).toLowerCase()] || "ETV";
    var scheduleUrl = "https://otse.err.ee/k/saatekava/tele";
    var resp = http.GET(scheduleUrl, {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }, false);
    if (!resp.isOk) {
      return {
        currentShow: "",
        currentLead: "",
        scheduleText: "Saatekava laadimine ebaõnnestus: HTTP " + resp.code
      };
    }

    var cleanText = resp.body
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n");

    var lines = cleanText.split("\n");
    var inSection = false;
    var entries = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/\s+/g, " ").trim();
      if (!line) continue;

      if (line === "ETV" || line === "ETV2" || line === "ETV+") {
        if (inSection && line !== targetHeader) break;
        if (line === targetHeader) {
          inSection = true;
          continue;
        }
      }

      if (inSection) {
        if (line === "Arhiiv" || line === "ERR") break;
        var m = line.match(/^(\d{2}):(\d{2})\s*(.+)$/);
        if (m) {
          var mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
          entries.push({
            time: m[1] + ":" + m[2],
            mins: mins,
            title: m[3].trim()
          });
        }
      }
    }

    if (entries.length === 0) {
      return {
        currentShow: "",
        currentLead: "",
        scheduleText: "Saatekava kirjeid ei leitud."
      };
    }

    var now = new Date();
    var nowMins = now.getHours() * 60 + now.getMinutes();
    var currentIndex = 0;

    for (var j = 0; j < entries.length; j++) {
      var eMins = entries[j].mins;
      if (j > 0 && eMins < 300) eMins += 1440;
      var cmpNow = (nowMins < 300 && entries[0].mins >= 300) ? nowMins + 1440 : nowMins;
      if (eMins <= cmpNow) {
        currentIndex = j;
      } else {
        break;
      }
    }

    var currentShow = entries[currentIndex] ? entries[currentIndex].title : "";
    var upcomingList = [];
    for (var k = currentIndex; k < entries.length && upcomingList.length < 12; k++) {
      var prefix = (k === currentIndex) ? "▶ " : "";
      upcomingList.push(prefix + entries[k].time + " - " + entries[k].title);
    }

    return {
      currentShow: currentShow,
      currentLead: "",
      scheduleText: upcomingList.join("\n")
    };
  } catch (e) {
    return {
      currentShow: "",
      currentLead: "",
      scheduleText: "Saatekava viga: " + e.message
    };
  }
}

source.isContentDetailsUrl = function (url) {
  return url.indexOf("/live/") !== -1 || JUPITER_URL_REGEX.test(url);
};

source.getContentDetails = function (url) {
  if (url.indexOf("/live/") !== -1) {
    var liveId = url.split("/live/").pop().split("?").shift();
    var liveInfo = null;
    for (var i = 0; i < ERR_LIVE_CHANNELS.length; i++) {
      if (ERR_LIVE_CHANNELS[i].id === liveId) {
        liveInfo = ERR_LIVE_CHANNELS[i];
        break;
      }
    }
    if (!liveInfo) throw new ScriptException("Tundmatu otsekanal: " + liveId);

    var realStreamUrl = resolveErrLiveStreamUrl(liveInfo.id, liveInfo.streamUrl);
    var sched = getLiveScheduleInfo(liveInfo.id);
    var videoTitle = (sched && sched.currentShow)
      ? liveInfo.name + " | Hetkel eetris: " + sched.currentShow
      : liveInfo.name;

    var descParts = [];
    if (sched && sched.currentShow) {
      descParts.push("HETKEL EETRIS: " + sched.currentShow);
    }
    if (sched && sched.scheduleText) {
      descParts.push("TÄNANE SAATEKAVA:\n" + sched.scheduleText);
    }
    var videoDesc = descParts.length > 0
      ? descParts.join("\n\n")
      : liveInfo.name + " otseülekanne ERR-i serverist.";

    return new PlatformVideoDetails({
      id: new PlatformID("Jupiter", "live_" + liveInfo.id, PLUGIN_ID),
      name: videoTitle,
      thumbnails: new Thumbnails([new Thumbnail(liveInfo.thumb, 720)]),
      author: new PlatformAuthorLink(
        new PlatformID("Jupiter", "err_live", PLUGIN_ID),
        "ERR Otse",
        "https://jupiter.err.ee",
        "https://jupiter.err.ee"
      ),
      uploadDate: Math.floor(Date.now() / 1000),
      duration: 0,
      viewCount: 0,
      url: url,
      isLive: true,
      description: videoDesc,
      video: new VideoSourceDescriptor([
        new HLSSource({
          name: "OTSE HLS",
          url: realStreamUrl,
          duration: 0,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": "https://jupiter.err.ee/",
            "Origin": "https://jupiter.err.ee"
          }
        })
      ])
    });
  }

  if (!JUPITER_URL_REGEX.test(url)) throw new ScriptException("Vigane Jupiteri video URL");

  var contentId = url.replace(JUPITER_URL_REGEX, "$2").split("/").shift().split("?").shift();
  var apiUrl = SERVICES_URL + "/api/v2/vodContent/getContentPageData?contentId=" + contentId + "&rootId=3905&page=web";
  var resp = http.GET(apiUrl, API_HEADERS, false);
  if (!resp.isOk) throw new ScriptException("Video laadimine ebaõnnestus: " + resp.code);

  var data = JSON.parse(resp.body).data || {};
  var main = data.mainContent;
  if (!main || !main.medias || main.medias.length === 0) {
    throw new ScriptException("Sellel sisul puudub mängitav videovoog.");
  }

  var media = main.medias.shift();
  var src = media.src || {};
  var hlsUrl = src.hls || src.hls2 || src.hlsNew || "";
  if (!hlsUrl) {
    throw new ScriptException("Mängitavat videovoogu ei leitud.");
  }

  if (hlsUrl.indexOf("//") === 0) hlsUrl = "https:" + hlsUrl;

  var root = data.rootContent || main;
  var seriesId = String(root.id || main.id);
  var seriesTitle = root.heading || main.heading || "ERR Jupiter";
  var thumbUrl = extractErrPhoto(main) || extractErrPhoto(root);
  var duration = (media.mediaInfo && media.mediaInfo.duration) ? parseInt(media.mediaInfo.duration, 10) : 0;

  return new PlatformVideoDetails({
    id: new PlatformID("Jupiter", String(main.id), PLUGIN_ID),
    name: data.statsHeading || main.heading || "ERR Jupiter video",
    thumbnails: new Thumbnails(thumbUrl ? [new Thumbnail(thumbUrl, 720)] : []),
    author: new PlatformAuthorLink(
      new PlatformID("Jupiter", seriesId, PLUGIN_ID),
      seriesTitle,
      BASE_URL + "/" + seriesId + "/" + (root.url || "saade"),
      thumbUrl || "https://err.ee"
    ),
    uploadDate: main.publicStart || Math.floor(Date.now() / 1000),
    duration: duration,
    viewCount: 0,
    url: url,
    isLive: false,
    description: stripHtmlTags(main.lead || ""),
    video: new VideoSourceDescriptor([
      new HLSSource({
        name: "HLS Auto",
        url: hlsUrl,
        duration: duration,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": "https://err.ee"
        }
      })
    ])
  });
};

