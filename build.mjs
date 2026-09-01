// Generates docs/feed.xml for GitHub Pages. Run twice a day by
// .github/workflows/feed.yml; see README for the local invocation.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { fetchComics, mergeEntries, renderFeed } from "./handler.js";

const OUT_DIR = "docs";
const STATE = `${OUT_DIR}/entries.json`;
const FEED = `${OUT_DIR}/feed.xml`;

// Roughly three weeks at five strips a day.
const MAX_ENTRIES = 100;

function readState() {
  try {
    const raw = readFileSync(STATE, "utf8");
    return { raw, entries: JSON.parse(raw) };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { raw: "", entries: [] };
  }
}

const before = readState();
const { entries, added } = mergeEntries(before.entries, await fetchComics(), MAX_ENTRIES);
const state = JSON.stringify(entries, null, 2) + "\n";

// The rss library stamps lastBuildDate with the time of rendering, so re-rendering an
// unchanged feed still yields a different file. Write only when the strips themselves
// changed, or the workflow commits on every run forever - and lastBuildDate then means
// what a reader expects it to: when the feed last actually changed.
if (state === before.raw) {
  console.log(`no change, ${entries.length} in feed`);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(STATE, state);
writeFileSync(FEED, renderFeed(entries));

console.log(`${added} new, ${entries.length} in feed`);
