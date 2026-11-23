var BASE_URL = "https://jupiter.err.ee";
var SERVICES_URL = "https://services.err.ee";
var PLUGIN_ID = "8f4e2a1b-9c3d-4e5f-a1b2-c3d4e5f6a7b8";

var API_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://jupiter.err.ee/",
  "Origin": "https://jupiter.err.ee",
  "Accept": "application/json, text/plain, */*"
};

var JUPITER_URL_REGEX = /^https?:\/\/(www\.)?jupiter\.err\.ee\/(\d+)(\/[^/?#]+)?/i;

source.enable = function (conf, settings, savedState) {};

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

function extractErrPhoto(item) {
  var url = "";
  if (item.horizontalPhotos && item.horizontalPhotos.length > 0) {
    var pt = item.horizontalPhotos[0].photoTypes;
    if (pt) {
      url = (pt["26"] && pt["26"].url) || (pt["17"] && pt["17"].url) || (pt["34"] && pt["34"].url) || "";
    }
    if (!url) url = item.horizontalPhotos[0].photoUrlBase || "";
  }
  if (!url && item.photos && item.photos.length > 0) {
    url = item.photos[0].photoUrlBase || item.photos[0].photoUrlOriginal || "";
  }
  if (url.indexOf("//") === 0) url = "https:" + url;
  return url;
}

function stripHtmlTags(str) {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

