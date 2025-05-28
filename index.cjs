// index.cjs – FastDL proxy (CommonJS)
const express = require('express');
const { chromium } = require('playwright');

const app = express();

/* ------------ choose an INTERNAL port that’s NOT $PORT ------------ */
const PORT = 3000;                // will never be exposed by Render
/* ------------------------------------------------------------------ */

/* One persistent browser */
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
  page.setDefaultTimeout(60_000);
  return page;
}

/* GET /convert?url=... */
app.get('/convert', async (req, res) => {
  try {
    const igUrl = req.query.url;
    if (!igUrl) return res.status(400).json({ error: 'Missing ?url=' });

    const p = await getPage();

    await p.goto('https://fastdl.app/en', { waitUntil: 'domcontentloaded' });
    const input = await p.waitForSelector('input[type="text"]');
    await input.fill(igUrl);

    const [resp] = await Promise.all([
      p.waitForResponse(r =>
        r.url().includes('/api/convert') && r.request().method() === 'POST'),
      p.click('button:has-text("Download")')
    ]);

    res.json(await resp.json());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'proxy-failed', detail: err.message });
  }
});

/* graceful shutdown */
process.on('SIGINT', async () => { await context?.close(); process.exit(); });

app.listen(PORT, () => console.log(`🚀  FastDL proxy running on ${PORT}`));
