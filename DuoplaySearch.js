var TIGU_SEARCH_URL = "https://kanal2.ee";

// --- AVALEHT (KOOS LEHEKÜLGEDE KERIMISEGA) ---
source.getHome = function () {
  return createTiguPager("", 1);
};

// --- OTSING (KOOS LEHEKÜLGEDE KERIMISEGA) ---
source.search = function (query, type, order, filters) {
  return createTiguPager(query, 1);
};

function createTiguPager(query, page) {
  var data = fetchTiguPage(query, page);
  var hasMore = data.currentPage < data.lastPage;

  return new VideoPager(
    data.results,
    hasMore,
    { query: query, page: page + 1 },
    function (ctx) {
      var nextQuery = (ctx && ctx.query !== undefined) ? ctx.query : query;
      var nextPage = (ctx && ctx.page) ? ctx.page : (page + 1);
      return createTiguPager(nextQuery, nextPage);
    }
  );
}

function fetchTiguPage(query, page) {
  var empty = { results: [], currentPage: page, lastPage: page };
  try {
    var q = query ? encodeURIComponent(query.trim()) : "";
    var url = TIGU_SEARCH_URL + "?page=" + (page || 1);
    if (q) {
      url += "&q=" + q;
    }

    var resp = http.GET(url, API_HEADERS, false);
    if (!resp.isOk) return empty;

    var json = JSON.parse(resp.body);
    var items = json.data || [];
    var results = [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item || !item.title || !item.id || !item.slug) continue;

      var showUrl = BASE_URL + "/" + item.id + "/" + item.slug;
      var thumbUrl = "";
      if (item.images) {
        thumbUrl = item.images["400x225"] || item.images["270x180"] || "";
      }
      if (!thumbUrl && item.image) {
        thumbUrl = item.image;
      }
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

    return {
      results: results,
      currentPage: json.current_page || page,
      lastPage: json.last_page || page
    };
  } catch (e) {
    return empty;
  }
}


