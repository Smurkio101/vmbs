// -----------------------------------------
//  server.js – Fast, cache‑friendly API layer
// -----------------------------------------
//  * Gzip/Brotli compression
//  * Redis or in‑memory caching (5‑minute TTL)
//  * Scraper functions unchanged, but wrapped
//    so repeated requests are instant.
// -----------------------------------------

import express from 'express';
import compression from 'compression';
import axios from 'axios';
import cheerio from 'cheerio';
import Redis from 'ioredis';
import { createProxyMiddleware } from 'http-proxy-middleware';


// Fallback: if REDIS_URL not set, use Map in memory
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
const memoryCache = new Map();

const app = express();
const PORT = 3000;
app.listen(PORT, () => console.log('🚀 FastDL proxy running on ' + PORT));


app.use('/convert', createProxyMiddleware({ target: 'http://localhost:3000', changeOrigin: true }));
// ────────────────────────────────────────────
//  Global Middleware
// ────────────────────────────────────────────

app.use(compression());       // gzip / brotli
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.originalUrl}`);
  next();
});

// Basic error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Health check
app.get('/', (_req, res) => res.send('🟢 API alive'));

// ────────────────────────────────────────────
//  Scraper helpers (unchanged)
// ────────────────────────────────────────────
async function fetchAnni(slug) {
  const url = `https://www.cbr.com/${slug}`;
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const content = $('#article-body .content-block-regular p')
    .map((_, el) => $(el).text().trim())
    .get()
    .join(' ');

  return {
    anime_title: $('.article-header-title').text().trim(),
    tag: $('.tag-label.no-bg span').text().trim(),
    img: $('.heading_image img').attr('src'),
    description: $('meta[name="description"]').attr('content').trim(),
    content,
  };
}

const fetchLatestNewsFromPage = async (url) => {
  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);
  const news = [];

  $('.display-card.article.small.active-content').each((_, el) => {
    const node = $(el);
    const anime_title = node.find('.display-card-title').text().trim();
    const anime_image = node.find('picture source').last().attr('srcset');
    const anime_url = node.find('a.dc-img-link').attr('href');
    const anime_id = anime_url.replace(/^\/|\/$/g, '');
    news.push({ anime_title, anime_image, anime_id });
  });
  return news;
};

const scrapeAllNewsPages = async () => {
  const base = 'https://www.cbr.com/category/anime/';
  const pages = 3;
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const url = p === 1 ? base : `${base}${p}/`;
    const list = await fetchLatestNewsFromPage(url);
    if (!list.length) break;
    out.push(...list);
  }
  return out;
};

// ────────────────────────────────────────────
//  Utility – TTL cache wrapper
// ────────────────────────────────────────────
async function withCache(key, ttlSeconds, fn) {
  // Redis branch
  if (redis) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
    const fresh = await fn();
    await redis.setex(key, ttlSeconds, JSON.stringify(fresh));
    return fresh;
  }
  // Memory branch
  const now = Date.now();
  const item = memoryCache.get(key);
  if (item && now - item.ts < ttlSeconds * 1000) return item.data;
  const fresh = await fn();
  memoryCache.set(key, { ts: now, data: fresh });
  return fresh;
}

// ────────────────────────────────────────────
//  Routes
// ────────────────────────────────────────────
app.get('/news/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const data = await withCache(`news:${slug}`, 3600, () => fetchAnni(slug));
    if (!data) return res.status(404).send('Not found');
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
       .json(data);
  } catch (e) { next(e); }
});

app.get('/uie', async (_req, res, next) => {
  try {
    const feed = await withCache('feed:list', 300, scrapeAllNewsPages);
    res.set('Cache-Control', 'public, max-age=60')
       .json(feed);
  } catch (e) { next(e); }
});


let requestCount = 0;

// Configure headers to mimic a real browser
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function makeRequest() {
  const startTime = new Date();
  requestCount++;
  
  try {
    const response = await axios.get('https://vmbs-1-ipmu.onrender.com/uie', { headers });
    
    console.log(`[${startTime.toISOString()}] Request #${requestCount} - SUCCESS (Status: ${response.status})`);
  } catch (error) {
    const status = error.response ? error.response.status : 'NO_RESPONSE';
    console.error(`[${startTime.toISOString()}] Request #${requestCount} - ERROR (Code: ${status})`);
  }
}

// Initial call
makeRequest();

// Run every 15 seconds indefinitely
const interval = setInterval(() => {
  makeRequest();
}, 15000);

// Keep process alive forever
process.stdin.resume();

// Handle termination signals gracefully
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    clearInterval(interval);
    console.log(`\n[${new Date().toISOString()}] Stopped after ${requestCount} requests`);
    process.exit(0);
  });
});

console.log('Starting continuous 15-second requests...\nPress Ctrl+C to stop\n');
// ────────────────────────────────────────────
//  Start server
// ────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀  API ready at http://localhost:${PORT}`));
app.listen(PORT, () => console.log('🚀 FastDL proxy running on ' + PORT));