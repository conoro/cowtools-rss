// Cowtools RSS - Copyright Conor O'Neill 2022, conor@conoroneill.com
// LICENSE Apache-2.0
// Scrapes thefarside.com and renders an RSS feed. build.mjs is the entry point.

import * as cheerio from 'cheerio';
import RSS from 'rss';

export const SITE = "https://www.thefarside.com";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

// The Far Side serves this placeholder whenever a day's strips fail to load, and it
// serves the *same* one for every card on the page. Treated as a comic it produces a
// pile of identical entries, so drop those cards instead.
const ERROR_IMAGE = "content-error-missing-image";

// Captions routinely contain quotes and ampersands. They get interpolated into an
// alt="" attribute and into the description markup, so they have to be escaped or the
// tag terminates early and the reader renders mangled HTML.
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Characters that display badly in Feedly.
function cleanTitle(title) {
  return title
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[*+~…—@]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Every strip on the page carries the site's own permalink, e.g.
// https://www.thefarside.com/2026/08/31/2 - stable, unique, and unlike the CDN image
// URL it survives the asset host moves that keep happening.
function parsePermalink(permalink) {
  const match = /\/(\d{4})\/(\d{2})\/(\d{2})\/(\d+)\/?$/.exec(permalink || "");
  if (!match) return null;
  const [, year, month, day, index] = match;
  return {
    date: `${year}-${month}-${day}`,
    // Noon UTC keeps the date reading correctly either side of the Atlantic, and the
    // index spaces the strips a minute apart so readers keep the site's ordering.
    published: new Date(Date.UTC(+year, +month - 1, +day, 12, +index)),
    index: +index
  };
}

export function scrapeComics(html) {
  const $ = cheerio.load(html);
  const entries = [];
  const seen = new Set();

  $(".tfs-comic").each(function (position) {
    const card = $(this);
    const image = card.find(".tfs-comic__image img").attr("data-src");
    if (!image || image.includes(ERROR_IMAGE)) return;

    const permalink =
      card.find("[data-likable-permalink]").attr("data-likable-permalink") ||
      card.find("[data-shareable-permalink]").attr("data-shareable-permalink");
    const posted = parsePermalink(permalink);

    // The permalink is the identity we publish. If the markup ever stops carrying one,
    // fall back to the image URL rather than dropping the strip entirely.
    const guid = posted ? permalink : image;
    if (seen.has(guid)) return;
    seen.add(guid);

    const caption = card.find("figcaption").text().replace(/\s+/g, " ").trim();
    // The fallback used to carry the date the feed was generated, so an uncaptioned
    // strip was retitled every time the clock rolled past midnight UTC while the same
    // strip was still on the page.
    const named =
      caption ||
      `No caption ${posted ? posted.date : new Date().toISOString().split("T")[0]}-${
        posted ? posted.index : position
      }`;

    entries.push({
      guid,
      image,
      link: posted ? permalink : image,
      // Dating a strip by the day it was scraped rewrites the entry every time the feed
      // is generated. Date it by the day The Far Side published it instead.
      published: posted ? posted.published : new Date(),
      title: cleanTitle(named)
    });
  });

  return entries;
}

// thefarside.com only shows the current day, so a feed with any history has to
// accumulate it. First capture wins: re-reading a strip we have already published would
// rewrite its title or date under readers that have shown it.
export function mergeEntries(known, fresh, max) {
  const byGuid = new Map(known.map((entry) => [entry.guid, entry]));
  let added = 0;

  for (const entry of fresh) {
    if (byGuid.has(entry.guid)) continue;
    byGuid.set(entry.guid, entry);
    added++;
  }

  const entries = [...byGuid.values()]
    .sort((a, b) => new Date(b.published) - new Date(a.published))
    .slice(0, max);

  return { entries, added };
}

export function renderFeed(entries) {
  const feed = new RSS({
    title: "Cowtools RSS",
    description: "Return latest comic strips from The Far Side",
    feed_url: "https://conoro.github.io/cowtools-rss/feed.xml",
    site_url: SITE,
    image_url:
      "https://assets.thefarside.com/assets/packs/media/images/brand/meta_icons/android-chrome-192x192-17a2da94f812f9f4a41ed8ed1be4d889.png",
    managingEditor: "conor@conoroneill.com",
    webMaster: "conor@conoroneill.com",
    copyright: "2020 Conor ONeill",
    language: "en",
    ttl: "60"
  });

  for (const entry of entries) {
    const title = escapeHtml(entry.title);

    // align= as well as style=, because plenty of readers strip inline styles out of
    // feed HTML and the caption then drifts to the left of the strip.
    feed.item({
      title: entry.title,
      description:
        `<div align="center" style="text-align:center">` +
        `<img src="${escapeHtml(entry.image)}" alt="${title}" /><br /><br />` +
        `<p align="center" style="text-align:center">${title}</p>` +
        `</div>`,
      url: entry.link,
      guid: entry.guid,
      author: "Gary Larson",
      date: new Date(entry.published)
    });
  }

  return feed.xml();
}

export async function fetchComics() {
  const response = await fetch(SITE, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${SITE} returned ${response.status}`);
  return scrapeComics(await response.text());
}

export async function buildFeed() {
  return renderFeed(await fetchComics());
}
