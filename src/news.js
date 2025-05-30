import { Router } from 'express';
import axios from 'axios';
import cheerio from 'cheerio';
import Redis from 'ioredis';

export const router = Router();

/* ───────── cache helpers ───────── */
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
const memory = new Map();
async function withCache(key, ttlSec, fn) {
  if (redis) {                       // Redis branch
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit);
    const fresh = await fn();
    await redis.setex(key, ttlSec, JSON.stringify(fresh));
    return fresh;
  }
  const now  = Date.now();           // Memory branch
  const item = memory.get(key);
  if (item && now - item.ts < ttlSec * 1_000) return item.data;
  const fresh = await fn();
  memory.set(key, { ts: now, data: fresh });
  return fresh;
}

/* ───────── article & feed scrapers ───────── */
async function fetchArticle(slug) {
  const { data: html } = await axios.get(`https://www.cbr.com/${slug}`);
  const $ = cheerio.load(html);

  const content = $('#article-body .content-block-regular p')
    .map((_, el) => $(el).text().trim()).get().join(' ');

  return {
    anime_title : $('.article-header-title').text().trim(),
    tag         : $('.tag-label.no-bg span').text().trim(),
    img         : $('.heading_image img').attr('src'),
    description : $('meta[name="description"]').attr('content').trim(),
    content
  };
}
function pickImage(node) {
  const img = node
    .find('picture img')
    .first()                 // prefer the first <img> inside <picture>
    .addBack('img')
    .first();                // but fall back to any <img> if needed

  let url =
    img.attr('src') ||
    img.attr('data-src') ||
    img.attr('data-lazy-src') ||
    img.attr('data-srcset')?.split(' ')[0] ||
    '';

  if (url.startsWith('//')) url = 'https:' + url;   // protocol-relative → https
  return url.trim();
}

/* ───────── core scraper ───────── */

async function fetchCards(pageUrl) {
  const { data: html } = await axios.get(pageUrl, {
    headers: {
      // avoid stripped AMP versions
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    },
  });

  const $ = cheerio.load(html);
  const list = [];

  // grab both “small” and “large” cards just in case
  $('.display-card.article.active-content').each((_, el) => {
    const node = $(el);
    const link = node.find('a.dc-img-link').attr('href') || '';

    list.push({
      anime_title: node.find('.display-card-title').text().trim(),
      anime_image: pickImage(node),
      anime_id: link.replace(/^\/|\/$/g, ''), // “/slug/” → “slug”
    });
  });

  return list;
}

async function scrapeFeed() {
  const base = 'https://www.cbr.com/category/anime/';
  const pages = 3;                // scrape first 3 paginated pages
  const out = [];

  for (let p = 1; p <= pages; ++p) {
    const url  = p === 1 ? base : `${base}${p}/`;
    const page = await fetchCards(url);
    if (!page.length) break;      // end of listing
    out.push(...page);
  }
  return out;
}

/* ───────── routes ───────── */

router.get('/', (_req, res) => res.send('🟢 API alive'));

router.get('/uie', async (_req, res, next) => {
  try {
    const feed = await withCache('feed:list', 300, scrapeFeed); // 5-min TTL
    res
      .set('Cache-Control', 'public, max-age=60') // browsers: 60 s
      .json(feed);
  } catch (e) {
    next(e);
  }
});
router.get('/news/:slug', async (req, res, next) => {
  try {
    const art = await withCache(`news:${req.params.slug}`, 3600,
                                () => fetchArticle(req.params.slug));
    if (!art) return res.status(404).send('Not found');
    res.set('Cache-Control', 'public, max-age=300').json(art);
  } catch (e) { next(e); }
});
