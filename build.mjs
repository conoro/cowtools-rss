// Generates docs/feed.xml for GitHub Pages. Run twice a day by
// .github/workflows/feed.yml; see README for the local invocation.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { fetchComics, mergeEntries, renderFeed } from "./handler.js";

const OUT_DIR = "docs";
const STATE = `${OUT_DIR}/entries.json`;
const FEED = `${OUT_DIR}/feed.xml`;

// Roughly three weeks at five strips a day.
const MAX_ENTRIES = 100;

function loadKnown() {
  try {
    return JSON.parse(readFileSync(STATE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return [];
  }
}

const { entries, added } = mergeEntries(loadKnown(), await fetchComics(), MAX_ENTRIES);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(STATE, JSON.stringify(entries, null, 2) + "\n");
writeFileSync(FEED, renderFeed(entries));

console.log(`${added} new, ${entries.length} in feed`);
