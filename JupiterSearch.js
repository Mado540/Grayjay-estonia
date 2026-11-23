source.getHome = function () {
  return createJupiterSearchPager("", 1);
};

source.search = function (query, type, order, filters) {
  return createJupiterSearchPager(query, 1);
};

function createJupiterSearchPager(query, page) {
  var limit = 24;
  var offset = (page - 1) * limit;
  var opts = {
    page: page,
    limit: limit,
    offset: offset,
    category: 3905,
    phrase: query ? query.trim() : "",
    types: ["media"],
    searchTypes: ["video"],
    viewTypes: query ? ["series", "movie", "episode", "clip"] : ["series", "movie"],
    now: 0
  };

  var url = SERVICES_URL + "/api/search/getVodContents2/?type=&options=" + encodeURIComponent(JSON.stringify(opts));
  var resp = http.GET(url, API_HEADERS, false);
  if (!resp.isOk) {
    return new VideoPager([], false, {});
  }

  var json = JSON.parse(resp.body);
  var videoBlock = json.video || {};
  var items = videoBlock.contents || [];
  var totalFound = videoBlock.totalFound || 0;
  var results = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item || !item.id || !item.heading) continue;

    var itemUrl = item.url || (BASE_URL + "/" + item.id + "/" + (item.fancyUrl || "saade"));
    var thumbUrl = extractErrPhoto(item);
    var seriesId = String(item.rootContentId || item.id);
    var seriesTitle = item.heading.split("|")[0].trim();

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

