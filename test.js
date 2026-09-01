// Run with: npm test
// Hits thefarside.com for a live smoke test; the rest runs against fixtures.

import test from "node:test";
import assert from "node:assert/strict";

import { scrapeComics, renderFeed, fetchComics, mergeEntries } from "./feed.js";

function card({ index, image, caption, date = "2026/08/31" }) {
  return `
<div class="card tfs-comic js-comic">
  <div class="card-body">
    <div class="tfs-comic__image">
      <img data-src="${image}" class="img-fluid js-lazy-load" src="data:image/svg+xml,placeholder" />
    </div>
    ${caption ? `<figure class="figure tfs-comic__caption"><figcaption class="figure-caption">\n  ${caption}\n</figcaption></figure>` : ""}
  </div>
  <div class="card-footer">
    <button data-likable-permalink="https://www.thefarside.com/${date}/${index}"></button>
    <button data-shareable-permalink="https://www.thefarside.com/${date}/${index}"></button>
  </div>
</div>`;
}

const ASSET = "https://featureassets.amuniversal.com/assets/";

const page = `<html><body>
${card({ index: 0, image: ASSET + "aaa", caption: "In God’s den" })}
${card({ index: 1, image: ASSET + "bbb" })}
${card({ index: 2, image: ASSET + "ccc", caption: "“This is Harold Schwartz! … Something horrible is happening out here!”" })}
</body></html>`;

const guids = (xml) => [...xml.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map((m) => m[1]);
const items = (xml) => [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].map((m) => m[0]);

test("identifies each strip by its Far Side permalink, not the CDN image URL", () => {
  const entries = scrapeComics(page);
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((e) => e.guid),
    [
      "https://www.thefarside.com/2026/08/31/0",
      "https://www.thefarside.com/2026/08/31/1",
      "https://www.thefarside.com/2026/08/31/2"
    ]
  );
});

test("regenerating the feed produces byte-identical items", () => {
  // The duplication bug: every entry was stamped with the generation time, so each
  // poll presented the same strips as newly published.
  const first = renderFeed(scrapeComics(page));
  const second = renderFeed(scrapeComics(page));
  assert.deepEqual(items(second), items(first));
  assert.match(items(first)[0], /<pubDate>Mon, 31 Aug 2026 12:00:00 GMT<\/pubDate>/);
});

test("an uncaptioned strip keeps its title across a UTC midnight", () => {
  // Previously "No caption <today>-<n>", so the title changed under the reader while
  // the strip was still on the page.
  assert.equal(scrapeComics(page)[1].title, "No caption 2026-08-31-1");
});

test("keeps history, newest first, without rewriting known strips", () => {
  const known = scrapeComics(page);
  const nextDay = scrapeComics(
    page.replace(/2026\/08\/31/g, "2026/09/01").replace(/aaa|bbb|ccc/g, (m) => m + "2")
  );

  const { entries, added } = mergeEntries(known, nextDay, 100);
  assert.equal(added, 3);
  assert.equal(entries.length, 6);
  assert.match(entries[0].guid, /2026\/09\/01\/2$/, "newest strip first");
  assert.match(entries[5].guid, /2026\/08\/31\/0$/, "oldest strip last");

  // Re-scraping a day we already hold must be a no-op, not a rewrite.
  const again = mergeEntries(entries, known, 100);
  assert.equal(again.added, 0);
  assert.deepEqual(again.entries, entries);
});

test("caps the feed at the requested length, dropping the oldest", () => {
  const { entries } = mergeEntries(scrapeComics(page), [], 2);
  assert.equal(entries.length, 2);
  assert.match(entries[0].guid, /\/2$/);
});

test("drops the site's missing-image placeholder instead of repeating it", () => {
  // 2026-08-15: every card on the page carried the same error image.
  const broken = `<html><body>
    ${card({ index: 0, image: "https://siteassets.thefarside.com/content-error-missing-image.jpeg" })}
    ${card({ index: 1, image: "https://siteassets.thefarside.com/content-error-missing-image.jpeg" })}
  </body></html>`;
  assert.deepEqual(scrapeComics(broken), []);
});

test("de-duplicates strips repeated on the page", () => {
  const repeated = `<html><body>
    ${card({ index: 0, image: ASSET + "aaa", caption: "Cow tools" })}
    ${card({ index: 0, image: ASSET + "aaa", caption: "Cow tools" })}
  </body></html>`;
  assert.equal(scrapeComics(repeated).length, 1);
});

test("puts the caption below the image, centered, and escapes it", () => {
  const xml = renderFeed(scrapeComics(page));
  const item = items(xml)[2];
  const description = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(item)[1];

  const img = description.indexOf("<img ");
  const caption = description.indexOf("This is Harold Schwartz", img);
  assert.ok(img > -1 && caption > img, "caption must follow the image");
  assert.match(description, /<p align="center" style="text-align:center">/);
  assert.match(description, /<div align="center" style="text-align:center">/);

  // The straight quotes cleanTitle() introduces used to terminate alt="" early and
  // mangle the rest of the markup.
  assert.match(description, /alt="&quot;This is Harold Schwartz!/);
  assert.doesNotMatch(description, /alt="[^"]*"[A-Za-z]/);

  // Caption is in the title too.
  assert.match(item, /<title><!\[CDATA\["This is Harold Schwartz!/);

  // Images are hotlinked from the CDN now; the URLs are content-addressed and permanent.
  assert.match(description, /<img src="https:\/\/featureassets\.amuniversal\.com\/assets\/ccc"/);
});

test("live: thefarside.com still yields unique, permalink-shaped entries", async () => {
  const xml = renderFeed(await fetchComics());
  const found = guids(xml);
  assert.ok(found.length > 0, "expected at least one strip");
  assert.equal(new Set(found).size, found.length, "guids must be unique");
  for (const guid of found) {
    assert.match(guid, /^https:\/\/www\.thefarside\.com\/\d{4}\/\d{2}\/\d{2}\/\d+$/);
  }
});
