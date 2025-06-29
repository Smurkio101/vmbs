import { Router } from 'express';
import axios from 'axios';
import cheerio from 'cheerio';

import moment from 'moment-timezone';

export const router = Router();

// Function to fetch anime details
async function fetchAnimeDetails(animeId) {
    try {
        const url = `https://www.livechart.me/anime/${animeId}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
            studio: "",
            description: ""
        };

        // Extract format, source, episodes, and runtime
        $('.grid.grid-flow-col.auto-cols-fr > div').each((index, element) => {
            const $el = $(element);
            const label = $el.find('.text-xs').text().trim();
            
            // Format extraction
            if (label === 'Format') {
                animeInfo.details.format = $el.contents().filter((i, el) => 
                    el.nodeType === 3 && !$(el).hasClass('text-xs')
                ).text().trim();
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
                animeInfo.details.runtime = $el.contents().filter((i, el) => 
                    el.nodeType === 3 && !$(el).hasClass('text-xs')
                ).text().trim();
            }
        });

        // Extract description
        animeInfo.description = $('.lc-expander-content.lc-markdown-html').html() || "";

        // Extract studio
        animeInfo.studio = $('div:contains("Studio") + div .lc-chip-button').text().trim() || "";

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
            throw new Error(`Failed to fetch details: ${error.response.status} ${error.response.statusText}`);
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
        console.error(`Error fetching ${category} videos for ${animeId}:`, error.message);
        return []; // Return empty array instead of failing entire request
    }
}

// Function to fetch streaming information
async function fetchAnimeStreams(animeId) {
    try {
        const url = `https://www.livechart.me/anime/${animeId}/streams`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
            error: "Error fetching anime info",
            message: error.message
        });
    }
});

async function fetchAnimeSchedule() {
    try {
        const url = "https://www.livechart.me/schedule";
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const days = [];

        $(".lc-timetable-day").each((index, element) => {
            const dayInfo = {
                day: $(element).find(".lc-timetable-day__heading h2").text().trim(),
                date: $(element).find(".lc-timetable-day__heading .text-xl.opacity-75").text().trim(),
                timeslots: []
            };
        
            $(element).find(".lc-timetable-timeslot").each((idx, elem) => {
                const imageUrl = $(elem).find("[data-schedule-anime-target='poster']").attr("src");
                const timestamp = parseInt($(elem).attr('data-timestamp')) * 1000; // Convert to milliseconds
                const time = moment.tz(timestamp, 'America/Jamaica').format('h:mm A');

                const titleEl = $(elem).find("a");
                const href = titleEl.attr('href') || null; // <-- Safely check for null
                
                // Check if href is available before splitting
                const anime_id = href ? href.split('/').pop() : null; // <-- Fix: only split if href is defined

                const timeslot = {
                    time: time,
                    animeTitle: $(elem).find("[data-schedule-anime-target='preferredTitle']").text().trim(),
                    episodeInfo: $(elem).find(".lc-tt-release-label").text().trim(),
                    imageUrl: imageUrl ? imageUrl : "No image available",
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
        console.error("Error fetching anime schedule:", error);
        throw error;
    }
}



router.get('/anime-schedule', async (req, res) => {
    try {
        const schedule = await fetchAnimeSchedule();
        res.json(schedule);
    } catch (error) {
        res.status(500).send("Error fetching anime schedule: " + error.message);
    }
});



