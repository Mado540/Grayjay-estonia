var files = [
  "https://raw.githubusercontent.com/Mado540/Grayjay-estonia/refs/heads/main/JupiterConfig.json",
  "https://raw.githubusercontent.com/Mado540/Grayjay-estonia/refs/heads/main/JupiterSearch.js",
  "https://raw.githubusercontent.com/Mado540/Grayjay-estonia/refs/heads/main/JupiterVideo.js"
];

for (var i = 0; i < files.length; i++) {
  var res = http.GET(files[i], {}, false);
  if (res.isOk) {
    eval(res.body);
  }
}
