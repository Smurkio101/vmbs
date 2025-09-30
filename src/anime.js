import { Router } from 'express';
import axios from 'axios';
import cheerio from 'cheerio';
import cors from 'cors';

import moment from 'moment-timezone';

export const router = Router();

// Apply CORS on this router (do not use app.use here)
router.use(cors());

/* ------------------------------------ *
 * Helpers
 * ------------------------------------ */
function cleanDescriptionFrom($, selectorList) {
  const $el = $(selectorList).first();
  if (!$el.length) return '';

  // Pull plain text (Cheerio decodes entities), no HTML tags
  let text = $el.text();

  // Remove trailing "[Source: ...]" or similar bracketed attributions
  text = text.replace(/\s*(\[[^\]]+\]\s*)+$/i, '');

  // Collapse whitespace/newlines to single spaces
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

// Function to fetch anime details
async function fetchAnimeDetails(animeId) {
  try {
    const url = `https://www.livechart.me/anime/${animeId}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    // Extract main information
    const animeInfo = {
      id: animeId,
      title: {
        romaji: $('.text-xl.font-medium').text().trim(),
        english: $('.text-lg').first().text().trim() || null
      },
      imageUrl: $('.shrink-0 img').attr('src'),
      releaseDate: $('a[href^="/schedule?date="]').first().text().trim(),
      season: $('a[href*="/tv"]').text().trim(),
      rating: {
        score: $('.text-lg.font-medium').first().text().trim(),
        count: $('.text-sm.text-base-content\\/75').last().text().trim()
      },
      details: {},
      tags: [],
      studio: '',
      description: ''
    };

    // Extract format, source, episodes, and runtime
    $('.grid.grid-flow-col.auto-cols-fr > div').each((index, element) => {
      const $el = $(element);
      const label = $el.find('.text-xs').text().trim();

      // Format extraction
      if (label === 'Format') {
        animeInfo.details.format = $el
          .contents()
          .filter((i, el) => el.nodeType === 3 && !$(el).hasClass('text-xs'))
          .text()
          .trim();
      }
      // Source extraction
      else if (label === 'Source') {
        animeInfo.details.source = $el.find('a').text().trim();
      }
      // Episodes extraction
      else if (label === 'Episodes') {
        const episodeText = $el.text().trim();
        const match = episodeText.match(/\/\s*(\d+)/);
        if (match) {
          animeInfo.details.episodes = match[1];
        }
      }
      // Runtime extraction
      else if (label === 'Run time') {
        animeInfo.details.runtime = $el
          .contents()
          .filter((i, el) => el.nodeType === 3 && !$(el).hasClass('text-xs'))
          .text()
          .trim();
      }
    });

    // Extract description as clean plain text (strip <p>, collapse whitespace, drop [Source: ...])
    animeInfo.description = cleanDescriptionFrom(
      $,
      '.lc-markdown-html, .lc-expander-content .lc-markdown-html'
    );

    // Extract studio
    animeInfo.studio =
      $('div:contains("Studio") + div .lc-chip-button').text().trim() || '';

    // Extract tags
    $('.lc-chip-button:not(.lc-chip-button-outline)').each((index, element) => {
      if (!$(element).hasClass('hidden')) {
        animeInfo.tags.push($(element).text().trim());
      }
    });

    return animeInfo;
  } catch (error) {
    console.error(`Error fetching anime details for ${animeId}:`, error.message);
    if (error.response) {
      throw new Error(
        `Failed to fetch details: ${error.response.status} ${error.response.statusText}`
      );
    }
    throw new Error('Network error while fetching anime details');
  }
}

// Function to fetch videos by category
async function fetchAnimeVideos(animeId, category) {
  try {
    const url = `https://www.livechart.me/anime/${animeId}/videos?category=${category}&hide_unavailable=true`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const videos = [];

    $('.lc-video').each((index, element) => {
      const $el = $(element);
      videos.push({
        title: $el.find('.text-sm.line-clamp-2.font-bold').text().trim(),
        duration: $el.find('[data-video-target="durationBadge"]').text().trim(),
        thumbnail: $el.find('img').attr('src'),
        embedUrl: $el.attr('data-video-embed-url'),
        uploadedAt: $el.attr('data-video-uploaded-at'),
        youtubeUrl: $el.find('a').attr('href')
      });
    });

    return videos;
  } catch (error) {
    console.error(
      `Error fetching ${category} videos for ${animeId}:`,
      error.message
    );
    return []; // Return empty array instead of failing entire request
  }
}

// Function to fetch streaming information
async function fetchAnimeStreams(animeId) {
  try {
    const url = `https://www.livechart.me/anime/${animeId}/streams`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const streams = [];

    $('.flex-1.flex.items-center.gap-4.p-4').each((index, element) => {
      const $el = $(element);
      const notes = [];

      $el.find('.text-sm.text-base-content\\/75').each((i, el) => {
        const note = $(el).text().trim();
        if (note) notes.push(note);
      });

      streams.push({
        service: $el.find('.link-hover.font-medium').text().trim(),
        url: $el.find('.link-hover.font-medium').attr('href'),
        notes: notes
      });
    });

    return streams;
  } catch (error) {
    console.error(`Error fetching streams for ${animeId}:`, error.message);
    return []; // Return empty array instead of failing entire request
  }
}

// Function to get full anime information
async function getFullAnimeInfo(animeId) {
  try {
    const details = await fetchAnimeDetails(animeId);
    const videos = {
      promos: await fetchAnimeVideos(animeId, 'promos'),
      spots: await fetchAnimeVideos(animeId, 'spots'),
      music: await fetchAnimeVideos(animeId, 'music')
    };
    const streams = await fetchAnimeStreams(animeId);

    return {
      ...details,
      videos,
      streams
    };
  } catch (error) {
    console.error(`Error getting full info for ${animeId}:`, error.message);
    throw error;
  }
}

// Routes
router.get('/anime/:id', async (req, res) => {
  try {
    const animeInfo = await getFullAnimeInfo(req.params.id);
    res.json(animeInfo);
  } catch (error) {
    res.status(500).json({
      error: 'Error fetching anime info',
      message: error.message
    });
  }
});

async function fetchAnimeSchedule() {
  try {
    const url = 'https://www.livechart.me/schedule';
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const days = [];

    $('.lc-timetable-day').each((index, element) => {
      const dayInfo = {
        day: $(element).find('.lc-timetable-day__heading h2').text().trim(),
        date: $(element)
          .find('.lc-timetable-day__heading .text-xl.opacity-75')
          .text()
          .trim(),
        timeslots: []
      };

      $(element)
        .find('.lc-timetable-timeslot')
        .each((idx, elem) => {
          const imageUrl = $(elem)
            .find("[data-schedule-anime-target='poster']")
            .attr('src');
          const timestamp = parseInt($(elem).attr('data-timestamp')) * 1000; // ms
          const time = moment.tz(timestamp, 'America/Jamaica').format('h:mm A');

          const titleEl = $(elem).find('a');
          const href = titleEl.attr('href') || null;
          const anime_id = href ? href.split('/').pop() : null;

          const timeslot = {
            time: time,
            animeTitle: $(elem)
              .find("[data-schedule-anime-target='preferredTitle']")
              .text()
              .trim(),
            episodeInfo: $(elem).find('.lc-tt-release-label').text().trim(),
            imageUrl: imageUrl ? imageUrl : 'No image available',
            anime_id
          };

          if (timeslot.animeTitle) {
            dayInfo.timeslots.push(timeslot);
          }
        });

      if (dayInfo.timeslots.length > 0) {
        days.push(dayInfo);
      }
    });

    return days;
  } catch (error) {
    console.error('Error fetching anime schedule:', error);
    throw error;
  }
}

router.get('/anime-schedule', async (req, res) => {
  try {
    const schedule = await fetchAnimeSchedule();
    res.json(schedule);
  } catch (error) {
    res.status(500).send('Error fetching anime schedule: ' + error.message);
  }
});

/* ------------------------------------ *
 * LiveChart Search (English + Romaji)
 * - Returns two sections in one response
 * - English URL uses &titles=english
 * - Romaji URL uses &titles=romaji
 * - Adds type, date, rating
 * - Image object excludes "sources"
 * ------------------------------------ */

const LIVECHART_BASE_URL = 'https://www.livechart.me';

// With your app.js mounting this router at '/', the endpoints are:
// - GET /livechart/search?q=...
// - GET /livechart/search/:q
router.get('/livechart/search', handleLivechartSearchRequest);
router.get('/livechart/search/:q', handleLivechartSearchRequest);

async function handleLivechartSearchRequest(req, res) {
  try {
    const qRaw =
      typeof req.query.q === 'string' && req.query.q.trim()
        ? req.query.q
        : typeof req.params.q === 'string' && req.params.q.trim()
        ? req.params.q
        : '';

    if (!qRaw) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required search text: q',
        examples: [
          '/livechart/search?q=seishun buta yarou wa santa claus no yume wo minai',
          '/livechart/search/seishun%20buta%20yarou%20wa%20santa%20claus%20no%20yume%20wo%20minai'
        ]
      });
    }

    // Build URLs (force titles mode explicitly)
    const englishUrl = new URL('/search', LIVECHART_BASE_URL);
    englishUrl.searchParams.set('q', qRaw);
    englishUrl.searchParams.set('titles', 'english');

    const romajiUrl = new URL('/search', LIVECHART_BASE_URL);
    romajiUrl.searchParams.set('q', qRaw);
    romajiUrl.searchParams.set('titles', 'romaji');

    // Fetch both pages concurrently
    const [enHtml, roHtml] = await Promise.all([
      fetchHtmlLivechart(englishUrl.toString()),
      fetchHtmlLivechart(romajiUrl.toString())
    ]);

    // Scrape with mode-aware title preference
    const englishRaw = scrapeSearchResultsLivechart(enHtml, 'english');
    const romajiRaw = scrapeSearchResultsLivechart(roHtml, 'romaji');

    // Shape per section
    const english = englishRaw.map((i) => ({
      animeId: i.animeId,
      titleEnglish: i.title,
      href: i.href,
      type: i.type,
      date: i.date,
      rating: i.rating,
      image: i.image
    }));

    const romaji = romajiRaw.map((i) => ({
      animeId: i.animeId,
      titleRomaji: i.title,
      href: i.href,
      type: i.type,
      date: i.date,
      rating: i.rating,
      image: i.image
    }));

    return res.json({
      ok: true,
      english: englishUrl.toString(),
      romaji: romajiUrl.toString(),
      query: qRaw,
      count: english.length,
      results: {
        english,
        romaji
      }
    });
  } catch (err) {
    const status = err.response?.status || 500;
    return res.status(status).json({
      ok: false,
      message: 'Failed to scrape LiveChart search page',
      error:
        err.message ||
        err.toString() ||
        'Unknown error. The site may be blocking requests.'
    });
  }
}

async function fetchHtmlLivechart(url) {
  const { data } = await axios.get(url, {
    timeout: 15000,
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,' +
        'image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Referer: LIVECHART_BASE_URL + '/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  return data;
}

/**
 * Scrape one search page.
 * mode:
 *  - 'english': prefer anchor (English page), then data-title, then img alt
 *  - 'romaji' : prefer anchor (Romaji page), then img alt, then data-title
 */
function scrapeSearchResultsLivechart(html, mode = 'english') {
  const $ = cheerio.load(html);

  const items = $(
    'div.callout.grouped-list.anime-list li.grouped-list-item.anime-item'
  )
    .map((_, el) => {
      const $el = $(el);

      // Anchor + title candidates
      let $a = $el.find('a[data-anime-item-target="mainTitle"]').first();
      if (!$a.length) {
        $a = $el.find('.anime-item__body__title a').first();
      }

      const anchorTitle = ($a.text() || '').trim();
      const dataTitle = ($el.attr('data-title') || '').trim();
      const $img = $el.find('.anime-item__poster-wrap img').first();
      const altTitle = ($img.attr('alt') || '').trim();

      const title =
        mode === 'romaji'
          ? anchorTitle || altTitle || dataTitle
          : anchorTitle || dataTitle || altTitle;

      // Href
      const relativeHref = $a.attr('href') || '';
      const href = toAbsoluteUrlLivechart(relativeHref, LIVECHART_BASE_URL);

      // Type "(TV, 13 eps)"
      const type = (
        $el.find('.anime-item__body__title .title-extra').first().text() || ''
      ).trim();

      // Date and rating
      const date = (
        $el
          .find(
            '.info > span[data-action*="anime-item#showPremiereDateTime"]'
          )
          .first()
          .text() || ''
      ).trim();

      const $ratingSpan = $el.find('.info span.fake-link').first();
      const ratingText = ($ratingSpan.text() || '').trim();
      const ratingTitle = ($ratingSpan.attr('title') || '').trim();
      let rating = null;
      if (ratingText) {
        const num = parseFloat(ratingText.replace(/[^\d.]/g, ''));
        if (!Number.isNaN(num)) rating = num;
      }
      if (rating == null && ratingTitle) {
        const m = ratingTitle.match(/([\d.]+)\s+out of 10/i);
        if (m) rating = parseFloat(m[1]);
      }

      // Image (no "sources")
      const imgSrc = $img.attr('src') || '';
      const srcset = $img.attr('srcset') || '';
      const parsed = parseSrcsetLivechart(srcset);
      const image = {
        alt: altTitle,
        src: toAbsoluteUrlLivechart(parsed.small || imgSrc, LIVECHART_BASE_URL),
        small: parsed.small
          ? toAbsoluteUrlLivechart(parsed.small, LIVECHART_BASE_URL)
          : toAbsoluteUrlLivechart(imgSrc, LIVECHART_BASE_URL),
        large: parsed.large
          ? toAbsoluteUrlLivechart(parsed.large, LIVECHART_BASE_URL)
          : null
      };

      // Anime ID
      const animeIdAttr = $el.attr('data-anime-id') || null;
      const animeId =
        animeIdAttr || extractAnimeIdFromHrefLivechart(href) || null;

      return {
        animeId,
        title,
        href,
        type,
        date,
        rating,
        image
      };
  })
    .get();

  return items;
}

function extractAnimeIdFromHrefLivechart(href) {
  try {
    const m = new URL(href, LIVECHART_BASE_URL).pathname.match(
      /\/anime\/(\d+)/
    );
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function parseSrcsetLivechart(srcset) {
  const sources = (srcset || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(/\s+/).filter(Boolean);
      const url = parts[0] || '';
      const descriptor = parts[1] || '';
      return { url, descriptor };
    });

  const small =
    sources.find((s) => s.descriptor === '1x')?.url ||
    sources[0]?.url ||
    '';
  const large = sources.find((s) => s.descriptor === '2x')?.url || '';

  return { small, large };
}

function toAbsoluteUrlLivechart(url, base) {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}