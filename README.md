# Cowtools RSS
This Serverless function provides an RSS feed for the new The Far Side website.

## Installing and using
* Configure your AWS account
* Install Node.js 20+

```bash
git clone git@github.com:conoro/cowtools-rss.git
cd cowtools-rss
npm install -g serverless
npm install
npm test
serverless deploy
```
Then you access the RSS feed like so:

* https://url.of.serverless.function/dev/rss

Each entry is identified by the strip's permalink on thefarside.com (e.g.
`https://www.thefarside.com/2026/08/31/2`) and dated by the day it was published, so
regenerating the feed does not resurface strips your reader has already shown you.

## Tests

`npm test` runs the fixture-based tests plus one live check against thefarside.com,
which is the thing that will break first if the site's markup changes again.

LICENSE Apache-2.0

Copyright Conor O'Neill 2020, conor@conoroneill.com
