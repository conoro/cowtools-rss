// Cowtools RSS - Copyright Conor O'Neill 2022, conor@conoroneill.com
// LICENSE Apache-2.0
// Invoke like https://url.of.serverless.function/dev/rss


import fetch from 'node-fetch';

import { Buffer } from 'node:buffer';

// import entire SDK
import AWS from 'aws-sdk';

import * as cheerio from 'cheerio';

import { createRequire } from "module";
const require = createRequire(import.meta.url);
var RSS = require("rss");
var slugify = require('slugify');

var s3 = new AWS.S3();

import url from 'node:url';

export function check(event, context, callback) {

  async function getCowTools() {
    var URL = "https://www.thefarside.com";

    var feed = new RSS({
      title: "Cowtools RSS",
      description: "Return latest comic strips from The Far Side",
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


    let feedEntries = [];

    let response = await fetch(URL);
    let body = await response.text();
    if (response.ok) {

      let imagecounter = 0;
      let $ = cheerio.load(body);
      $(".tfs-comic").each(function () {
        let entry = {};
        entry.link = $(this).find("img").attr("data-src");
        entry.imgURL = url.parse(entry.link);
        entry.guid = entry.imgURL.href.replace(entry.imgURL.search, '');
        let filetimestamp = new Date().toISOString().split('T')[0];
        entry.title = $(this).find("figcaption").text() || "No caption " + filetimestamp + "-" + imagecounter;
        // Farside empty caption is a mix of spaces and carriage returns. Remove carriage returns first
        entry.title = entry.title.replace(/\r?\n|\r/g, " ");
        // Then if all spaces, set caption to some text
        if((entry.title === null) || (entry.title.match(/^ *$/) !== null)) entry.title = "No caption " + filetimestamp + "-" + imagecounter;;
        entry.currentDate = new Date();
        feedEntries.push(entry);
        imagecounter++;
      });
    }

    for (let i = 0; i < feedEntries.length; i++) {
      let options = {
        hostname: feedEntries[i].imgURL.hostname,
        path: feedEntries[i].imgURL.path,
        method: "GET",
        headers: {
          "authority": "thefarsideassets.thefarside.com",
          "cookie": "_ga=GA1.2.1418424814.1660376004; _gid=GA1.2.1032644222.1660376004; ccpaUUID=d795b898-1890-4f12-ba55-ede4eb435d37; dnsDisplayed=false; ccpaApplies=false; signedLspa=false; __qca=P0-531169800-1660376004770; _sp_krux=false",
          "referer": "https://www.thefarside.com/",
          "sec-fetch-dest": "image",
          "sec-fetch-mode": "no-cors",
          "sec-fetch-site": "same-site",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
        },
      };

      let response2 = await fetch(feedEntries[i].imgURL.href, options);
      let resBlob = await response2.blob();
      let resBuffer = await resBlob.arrayBuffer();
      resBuffer = Buffer.from(resBuffer);


      // https://rss-image-cache.s3.amazonaws.com/hang-on-betty-someones-bound-to-see-us-eventually.jpg
      let filename = slugify(feedEntries[i].title, { remove: /[*+~.,?…()'!“”—’"!:@]/g }).toLowerCase() + ".jpg";

      // Only upload image if it doesn't exist
      try {
        await s3.headObject({
          Bucket: process.env.BUCKET,
          Key: filename
        }).promise();
      } catch (error) {
        if (error.name === 'NotFound') {
          const stored = await s3.upload({
            Bucket: process.env.BUCKET,
            Key: filename,
            ACL: 'public-read',
            Body: resBuffer
          }).promise();
          console.log(stored);
        } else {
          console.log(error);
        }
      }

      let cleaned_title = feedEntries[i].title.replace(/[’]/g, '\''); 
      cleaned_title = cleaned_title.replace(/[“”]/g, '"'); 
      cleaned_title = cleaned_title.replace(/[*+~…—@]/g, ' '); 
      feed.item({
        title: cleaned_title,
        description: '<img src="' + "https://" + process.env.BUCKET + ".s3.amazonaws.com/" + filename + '" alt="' + cleaned_title + '" /><br><br>'+cleaned_title,
        url: feedEntries[i].link,
        guid: feedEntries[i].guid,
        author: "Gary Larson",
        date: feedEntries[i].currentDate
      });

    }
    var xml = feed.xml();
    context.succeed(xml);
  }
 
  getCowTools();

}
