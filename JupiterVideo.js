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

source.isContentDetailsUrl = function (url) {
  return url.indexOf("/live/") !== -1 || JUPITER_URL_REGEX.test(url);
};


source.getContentDetails = function (url) {
  var match = url.match(JUPITER_URL_REGEX);
  if (!match) throw new ScriptException("Vigane Jupiteri video URL");

  var contentId = match[2];
  var apiUrl = SERVICES_URL + "/api/v2/vodContent/getContentPageData?contentId=" + contentId + "&rootId=3905&page=web";
  var resp = http.GET(apiUrl, API_HEADERS, false);
  if (!resp.isOk) throw new ScriptException("Video laadimine ebaõnnestus: " + resp.code);

  var data = JSON.parse(resp.body).data || {};
  var main = data.mainContent;
  if (!main || !main.medias || main.medias.length === 0) {
    throw new ScriptException("Sellel sisul puudub mängitav videovoog (võib olla aegunud).");
  }

  var media = main.medias[0];
  var src = media.src || {};
  var hlsUrl = src.hls || src.hls2 || src.hlsNew || "";
  var dashUrl = src.dash || src.mpd || "";

  var root = data.rootContent || main;
  var seriesId = String(root.id || main.id);
  var seriesTitle = root.heading || main.heading || "ERR Jupiter";
  var thumbUrl = extractErrPhoto(main) || extractErrPhoto(root);
  var duration = (media.mediaInfo && media.mediaInfo.duration) ? parseInt(media.mediaInfo.duration, 10) : 0;
  var videoTitle = data.statsHeading || main.heading || "ERR Jupiter video";
  var descText = stripHtmlTags(main.lead || "");

  // Kontrolli DRM-kaitset
  var hasDrm = Boolean(media.drm) || (src.drm && Object.keys(src.drm).length > 0) || (!hlsUrl && dashUrl.indexOf("drm") !== -1);
  if (hasDrm || (!hlsUrl && dashUrl)) {
    return new PlatformVideoDetails({
      id: new PlatformID("Jupiter", String(main.id), PLUGIN_ID),
      name: "[DRM KAITSEGA] " + videoTitle,
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
      description: "⚠️ See film/sari on DRM-kaitsega (Widevine) ega ole Grayjays mängitav.\n\n" + descText,
      video: new VideoSourceDescriptor([])
    });
  }

  if (!hlsUrl) {
    throw new ScriptException("Mängitavat videovoogu ei leitud.");
  }

  if (hlsUrl.indexOf("//") === 0) hlsUrl = "https:" + hlsUrl;

  var root = data.rootContent || main;
  var seriesId = String(root.id || main.id);
  var seriesTitle = root.heading || main.heading || "ERR Jupiter";
  var thumbUrl = extractErrPhoto(main) || extractErrPhoto(root);
  var duration = (media.mediaInfo && media.mediaInfo.duration) ? parseInt(media.mediaInfo.duration, 10) : 0;
  var videoTitle = data.statsHeading || main.heading || "ERR Jupiter video";
  var descText = stripHtmlTags(main.lead || "");

  // Kontrolli, kas .m3u8 fail on ERR-i serveris päriselt kättesaadav
  var hlsCheck = http.GET(hlsUrl, API_HEADERS, false);
  if (!hlsCheck.isOk) {
    return new PlatformVideoDetails({
      id: new PlatformID("Jupiter", String(main.id), PLUGIN_ID),
      name: "[AEGUNUD / EI MÄNGI] " + videoTitle,
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
      description: "⚠️ Videofail pole ERR-i serveris enam saadaval (litsents on aegunud või geoblokeeritud). HTTP staatus: " + hlsCheck.code + "\n\n" + descText,
      video: new VideoSourceDescriptor([])
    });
  }

  return new PlatformVideoDetails({
    id: new PlatformID("Jupiter", String(main.id), PLUGIN_ID),
    name: videoTitle,
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
    description: descText,
    video: new VideoSourceDescriptor([
      new HLSSource({
        name: "HLS Auto",
        url: hlsUrl,
        duration: duration
      })
    ])
  });
};
