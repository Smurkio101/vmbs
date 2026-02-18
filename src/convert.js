import { Router } from 'express';
import { chromium } from 'playwright';

export const router = Router();

// Use a more common desktop user agent to blend in
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Keep browser context alive between requests for efficiency,
// but create a fresh page each time to avoid session reuse patterns
let context;
let browser;

async function getBrowserContext() {
  if (context && !context.isClosed()) return context;

  // Launch persistent context with realistic viewport and settings
  context = await chromium.launchPersistentContext('./.browser-data', {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    userAgent: DESKTOP_UA,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    // Add extra headers to appear more like a real browser
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  return context;
}

router.get('/', async (req, res) => {
  const igUrl = req.query.url;
  if (!igUrl) {
    return res.status(400).json({ error: 'Missing ?url=' });
  }

  let page = null;
  try {
    const browserContext = await getBrowserContext();
    page = await browserContext.newPage();

    // Set a reasonable timeout for all operations
    page.setDefaultTimeout(60_000);

    // 1. Navigate to the target site (using /en2 as requested)
    await page.goto('https://fastdl.app/en2', {
      waitUntil: 'domcontentloaded',
    });

    // 2. Add a small random delay to mimic human typing/pasting
    await page.waitForTimeout(Math.random() * 1000 + 500);

    // 3. Find and fill the input field (more specific selector for safety)
    const input = await page.waitForSelector('input[type="text"][placeholder*="instagram"]');
    await input.fill(igUrl);

    // 4. Wait for and click the download button (using multiple possible texts)
    const downloadButton = await page.waitForSelector(
      'button:has-text("Download"), button:has-text("download")'
    );

    // 5. Trigger the API request and wait for response simultaneously
    const [response] = await Promise.all([
      page.waitForResponse(r =>
        r.url().includes('/api/convert') && r.request().method() === 'POST'
      ),
      downloadButton.click(),
    ]);

    // 6. Parse and return the JSON response
    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Bot error:', err);
    res.status(500).json({
      error: 'proxy-failed',
      detail: err.message,
      hint: 'The target site might have changed its structure. Please check manually.'
    });
  } finally {
    // Always close the page to free resources and avoid session patterns
    if (page && !page.isClosed()) {
      await page.close();
    }
  }
});

// Clean shutdown
process.on('SIGINT', async () => {
  if (context) {
    await context.close();
  }
  process.exit();
});