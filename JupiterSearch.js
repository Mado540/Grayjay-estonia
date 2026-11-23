var ERR_LIVE_CHANNELS = [
  {
    id: "etv",
    name: "OTSE: ETV",
    url: "https://jupiter.err.ee/live/etv",
    streamUrl: "https://sb.err.ee/live/etv.m3u8",
    thumb: "https://jupiter.err.ee/favicon.ico"
  },
  {
    id: "etv2",
    name: "OTSE: ETV2",
    url: "https://jupiter.err.ee/live/etv2",
    streamUrl: "https://sb.err.ee/live/etv2.m3u8",
    thumb: "https://jupiter.err.ee/favicon.ico"
  },
  {
    id: "etvpluss",
    name: "OTSE: ETV+",
    url: "https://jupiter.err.ee/live/etvpluss",
    streamUrl: "https://sb.err.ee/live/etvpluss.m3u8",
    thumb: "https://jupiter.err.ee/favicon.ico"
  }
];

function getLiveChannelVideos() {
  var list = [];
  for (var i = 0; i < ERR_LIVE_CHANNELS.length; i++) {
    var ch = ERR_LIVE_CHANNELS[i];
    list.push(new PlatformVideo({
      id: new PlatformID("Jupiter", "live_" + ch.id, PLUGIN_ID),
      name: ch.name,
      thumbnails: new Thumbnails([new Thumbnail(ch.thumb, 225)]),
      author: new PlatformAuthorLink(
        new PlatformID("Jupiter", "err_live", PLUGIN_ID),
        "ERR Otse",
        "https://otse.err.ee",
        "https://err.ee"
      ),
      uploadDate: Math.floor(Date.now() / 1000),
      duration: 0,
      viewCount: 0,
      url: ch.url,
      isLive: true
    }));
  }
  return list;
}

source.getHome = function () {
  return createJupiterSearchPager("", 1);
};

source.search = function (query, type, order, filters) {
  return createJupiterSearchPager(query, 1);
};

function createJupiterSearchPager(query, page) {
  var limit = 24;
  var offset = (page - 1) * limit;
  var hasQuery = query && query.trim().length > 0;
  var opts = {
    page: page,
    limit: limit,
    offset: offset,
    category: 3905,
    phrase: hasQuery ? query.trim() : "",
    types: ["media"],
    searchTypes: ["video"],
    viewTypes: hasQuery ? ["series", "movie", "episode", "clip"] : ["series", "movie"],
    now: 0
  };

  var url = SERVICES_URL + "/api/search/getVodContents2/?type=&options=" + encodeURIComponent(JSON.stringify(opts));
  var resp = http.GET(url, API_HEADERS, false);
  if (!resp.isOk) {
    return new VideoPager((!hasQuery && page === 1) ? getLiveChannelVideos() : [], false, {});
  }

  var json = JSON.parse(resp.body);
  var videoBlock = json.video || {};
  var items = videoBlock.contents || [];
  var totalFound = videoBlock.totalFound || 0;
  var results = (!hasQuery && page === 1) ? getLiveChannelVideos() : [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item || !item.id || !item.heading) continue;

    var itemUrl = item.url || (BASE_URL + "/" + item.id + "/" + (item.fancyUrl || "saade"));
    var thumbUrl = extractErrPhoto(item);
    var seriesId = String(item.rootContentId || item.id);
    var seriesTitle = item.heading.split("|").shift().trim();

    results.push(new PlatformVideo({
      id: new PlatformID("Jupiter", String(item.id), PLUGIN_ID),
      name: item.heading,
      thumbnails: new Thumbnails(thumbUrl ? [new Thumbnail(thumbUrl, 225)] : []),
      author: new PlatformAuthorLink(
        new PlatformID("Jupiter", seriesId, PLUGIN_ID),
        seriesTitle,
        BASE_URL + "/" + seriesId + "/" + (item.fancyUrl || "saade"),
        thumbUrl || "https://err.ee"
      ),
      uploadDate: item.publicStart || Math.floor(Date.now() / 1000),
      duration: 0,
      viewCount: 0,
      url: itemUrl,
      isLive: false
    }));
  }

  var hasMore = (offset + items.length) < totalFound;
  return new VideoPager(
    results,
    hasMore,
    { query: query, page: page + 1 },
    function (ctx) {
      return createJupiterSearchPager(ctx.query, ctx.page);
    }
  );
}
