// Cowtools RSS - Copyright Conor O'Neill 2020, conor@conoroneill.com
// LICENSE Apache-2.0
// Invoke like https://url.of.serverless.function/dev/rss

module.exports.check = (event, context, callback) => {
  var request = require("request");
  var cheerio = require("cheerio");
  var RSS = require("rss");
  var URL = "https://www.thefarside.com";

  var feed = new RSS({
    title: "Cowtools RSS",
    description: "Return latest comic from The Far Side",
    feed_url: "http://example.com/rss.xml",
    site_url: URL,
    image_url:
      "https://assets.thefarside.com/assets/packs/media/images/brand/meta_icons/android-chrome-192x192-17a2da94f812f9f4a41ed8ed1be4d889.png",
    docs: "http://example.com/rss/docs.html",
    managingEditor: "conor@conoroneill.com",
    webMaster: "conor@conoroneill.com",
    copyright: "2020 Conor ONeill",
    language: "en",
    pubDate: "Jan 01, 2020 06:00:00 GMT",
    ttl: "60"
  });

  request(URL, function (error, response, html) {
    if (!error && response.statusCode == 200) {
      var $ = cheerio.load(html);
      $(".tfs-comic__body").each(function () {
        var link = $(this).find("img").attr("data-src");
        var title = $(this).find("figcaption").text();
        var currentDate = new Date();
        var description = '<img src="' + link + '" alt="' + title + '" />';
        feed.item({
          title: title,
          description: description,
          url: link,
          author: "Gary Larson",
          date: currentDate
        });
      });
      var xml = feed.xml();
      context.succeed(xml);
    }
  });
};
