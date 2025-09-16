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

/* ───────── utils ───────── */
const ORIGIN = 'https://www.cbr.com';

function resolveUrl(u = '') {
  if (!u) return '';
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('/')) return ORIGIN + u;
  return u;
}
function pickFromSrcset(val = '') {
  // choose the last candidate (usually highest quality)
  // "url1 448w, url2 896w" -> "url2"
  const parts = val.split(',').map(s => s.trim());
  const last  = parts[parts.length - 1] || '';
  return (last.split(/\s+/)[0] || '').trim();
}

/* ───────── article & feed scrapers ───────── */
async function fetchArticle(slug) {
  const { data: html } = await axios.get(`${ORIGIN}/${slug}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml'
    }
  });
  const $ = cheerio.load(html);

  const content = $('#article-body .content-block-regular p')
    .map((_, el) => $(el).text().trim()).get().join(' ');

  return {
    anime_title : $('.article-header-title').text().trim(),
    tag         : $('.tag-label.no-bg span').text().trim(),
    img         : resolveUrl($('.heading_image img').attr('src')),
    description : ($('meta[name="description"]').attr('content') || '').trim(),
    content
  };
}

/**
 * Robust image picker for CBR cards.
 * Priorities:
 *  1) <img data-img-url> (CBR's canonical)
 *  2) <img src|data-src|data-lazy-src>
 *  3) <source srcset|data-srcset> (pick highest quality)
 */
function pickImage(node) {
  // limit the search scope to the image container if present
  const scope = node.find('.dc-img').length ? node.find('.dc-img') : node;

  // 1) direct canonical
  let url =
    scope.find('picture img[data-img-url]').attr('data-img-url') ||
    scope.find('img[data-img-url]').attr('data-img-url');

  // 2) common lazy attrs on <img>
  if (!url) {
    const img = scope.find('picture img, img').first();
    url =
      img.attr('src') ||
      img.attr('data-src') ||
      img.attr('data-lazy-src') ||
      '';
    if (!url) {
      // 3) fall back to <source> srcset/data-srcset
      const srcset =
        scope.find('picture source').first().attr('data-srcset') ||
        scope.find('picture source').first().attr('srcset') ||
        '';
      if (srcset) url = pickFromSrcset(srcset);
    }
  }

  return resolveUrl((url || '').trim());
}

/* ───────── core scraper ───────── */
async function fetchCards(pageUrl) {
  const { data: html } = await axios.get(pageUrl, {
    headers: {
      // avoid AMP and get desktop markup
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml'
    },
  });

  const $ = cheerio.load(html);
  const list = [];

  // 🔧 FIX: CBR uses variants like "display-card full-cover-image", not always ".article.active-content"
  $('.display-card').each((_, el) => {
    const node = $(el);
    const link = node.find('a.dc-img-link').attr('href') || '';

    const title =
      node.find('.display-card-title').text().trim() ||
      node.find('h3.display-card-title a').text().trim();

    list.push({
      anime_title: title,
      anime_image: pickImage(node),
      anime_id   : link.replace(/^\/|\/$/g, ''), // “/slug/” → “slug”
    });
  });

  return list;
}

async function scrapeFeed() {
  const base = `${ORIGIN}/category/anime/`;
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
    const art = await withCache(
      `news:${req.params.slug}`,
      3600,
      () => fetchArticle(req.params.slug)
    );
    if (!art) return res.status(404).send('Not found');
    res.set('Cache-Control', 'public, max-age=300').json(art);
  } catch (e) { next(e); }
});
