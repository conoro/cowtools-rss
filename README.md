# Cowtools RSS
An unofficial RSS feed for [The Far Side](https://www.thefarside.com).

**Feed URL:** https://conoro.github.io/cowtools-rss/feed.xml

A GitHub Actions workflow scrapes thefarside.com twice a day, merges anything new into
`docs/entries.json`, regenerates `docs/feed.xml` and commits the result. GitHub Pages
serves it. There is nothing to deploy and nothing to pay for.

## How it works

thefarside.com only ever shows the current day's strips, so the feed's history is
whatever we have accumulated — `docs/entries.json` is the store, capped at 100 entries
(about three weeks). Each strip is identified by its permalink on thefarside.com, e.g.
`https://www.thefarside.com/2026/08/31/2`, and dated by the day it was published, so a
strip your reader has already shown never resurfaces. First capture wins: a strip we
already hold is never rewritten.

Images are hotlinked from `featureassets.amuniversal.com`. Those URLs are
content-addressed and carry no signature or expiry, so they stay good indefinitely.

## Running it locally

```bash
npm install
npm test      # fixture tests plus a live check against thefarside.com
npm run build # writes docs/entries.json and docs/feed.xml
```

## Setup

Once, in the repository settings: **Pages → Build and deployment → Deploy from a
branch**, and pick `master` / `/docs`.

The workflow needs no secrets. It runs at 09:00 and 21:00 UTC and can be triggered by
hand from the Actions tab.

> Scheduled workflows are disabled after 60 days without a commit to the repository.
> This one commits whenever the feed changes, which is most days, so it should keep
> itself alive — but if the feed goes stale, check the workflow is still enabled.

LICENSE Apache-2.0

Copyright Conor O'Neill 2020, conor@conoroneill.com
