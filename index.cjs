// index.js – FastDL proxy (CommonJS)
const express   = require('express');
const { chromium } = require('playwright');                // v1.44+
const app  = express();

/* Launch one persistent browser the first time we’re called */
let context, page;
async function getPage() {
  if (page && !page.isClosed()) return page;

  context = await chromium.launchPersistentContext('./.pw', {
    headless: true,
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) ' +
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 ' +
      'Mobile/15E148 Safari/604.1'
  });
  page = await context.newPage();
  page.setDefaultTimeout(60_000);                          // 60 s safety net 
  return page;
}

/* GET /convert?url=<INSTAGRAM_URL> ----------------------- */
app.get('/convert', async (req, res) => {
  try {
    const igUrl = req.query.url;
    if (!igUrl) return res.status(400).json({ error: 'Missing ?url=' });

    const p = await getPage();

    /* 1️⃣  Navigate */
    await p.goto('https://fastdl.app/en', { waitUntil: 'domcontentloaded' });

    /* 2️⃣  Paste the link */
    const input = await p.waitForSelector('input[type="text"]');          // only one input on the page
    await input.fill(igUrl);

    /* 3️⃣  Click the Download button and wait for the XHR ----------------*/
    const [resp] = await Promise.all([
      p.waitForResponse(r =>
        r.url().includes('/api/convert') && r.request().method() === 'POST' ),
      p.click('button:has-text("Download")')
    ]);

    const data = await resp.json();
    return res.json(data);                                               // Thunder Client sees this
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'proxy-failed', detail: err.message });
  }
});

/* Graceful shutdown */
process.on('SIGINT', async () => { await context?.close(); process.exit(); });
