import fetch from 'node-fetch';

import * as cheerio from 'cheerio';

let response = await fetch("https://www.thefarside.com");
let body = await response.text();
let $ = cheerio.load(body);
$(".tfs-comic").each(function () {
    let entry = {};
    entry.link = $(this).find("img").attr("data-src");
    console.log(entry.link);
    entry.title = $(this).find("figcaption").text() || "No caption";
    entry.title = entry.title.replace(/\r?\n|\r/g, " ");
    if((entry.title === null) || (entry.title.match(/^ *$/) !== null)) entry.title = "No caption";
    console.log(entry.title);
});