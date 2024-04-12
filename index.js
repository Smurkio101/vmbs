const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const puppeteer = require('puppeteer');
const stream = require('stream');

const app = express();
const PORT = 3001;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`Received request: ${req.method} ${req.originalUrl}`);
    next();
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(PORT, () => console.log(`Running Express Server on PORT ${PORT}!`));



app.get('/animeList', async (request, response) => {
    try {
        const animeList = await fetchAnimeList();
        response.send(animeList);
    } catch (error) {
        console.log(html);
        console.error(error);
        response.status(500).send('Internal Server Error');
    }
});
app.get('/animedub', async (request, response) => {
    try {
        const animedub = await fetchDubbedAnimeList();
        response.send(animedub);
    } catch (error) {
        console.error(error); // Corrected to remove the undefined reference
        response.status(500).send('Internal Server Error');
    }
});


app.get('/animeMovie', async (request, response) => {
    try {
        const animeMovie = await fetchAnimeMovies();
        response.send(animeMovie);
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal Server Error');
    }
});

app.get('/animePopular', async (request, response) => {
    try {
        const animePopular = await fetchPopularAnime();
        response.send(animePopular);
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal Server Error');
    }
});

app.get('/watch/:slug', async (request, response, next) => {
    try {
        const { slug } = request.params;
        const watchDetails = await fetchWatchAndEpisodes(slug);
        if (watchDetails) {
            response.send(watchDetails);
        } else {
           
            response.status(404).send('Content not found');
        }
    } catch (error) {
        console.error(error);
        next(error); 
    }
})

const fetchAnimeList = async () => {
    try {
        const response = await axios.get('https://anitaku.to/home.html');
        const html = response.data;
        const $ = cheerio.load(html);
        const animeList = [];

        $('.last_episodes.loaddub li').each((index, el) => {
            const anime = $(el);
            const anime_title = anime.find('.name a').text().trim();
            const anime_url = anime.find('.name a').attr('href');
            const image_url = anime.find('img').attr('src');
            const anime_id = anime_url.split('/').pop();

            animeList.push({ anime_title, anime_id, image_url });
        });

        
        return animeList;
    } catch (err) {
        console.error(err);
        throw err; 
    }
};




const fetchAnimeMovies = async () => {
    try {
        const response = await axios.get('https://anitaku.to/anime-movies.html');
        const html = response.data;
        const $ = cheerio.load(html);
        const animeMovie = [];

       
        $('.last_episodes').each((index, element) => {
            const anime = $(element);
            const anime_title = anime.find('.name a').text().trim();
            const anime_url = anime.find('.name a').attr('href');
            const image_url = anime.find('img').attr('src');
            const released = anime.find('released').text;

            const anime_id = anime_url.split('/').pop();

            animeMovie.push({ anime_title, anime_url, anime_id, image_url, released });
        });

        return animeMovie;
    } catch (err) {
        console.error(err);
        throw err;
    }
};



const fetchPopularAnime = async () => {
    const baseUrl = 'https://anitaku.so/popular.html';
    let currentPage = 0;
    const totalPages = 5; // Assuming there are 5 pages, adjust this as needed
    const animePopular = [];

    try {
        while (currentPage <= totalPages) {
            const response = await axios.get(`${baseUrl}?page=${currentPage}`);
            const html = response.data;
            const $ = cheerio.load(html);
            
            $('.last_episodes.loaddub li').each((index, element) => {
                const anime = $(element);
                const anime_title = anime.find('.name a').text().trim();
                const anime_url = anime.find('.name a').attr('href');
                const image_url = anime.find('img').attr('src');
                // Ensure that .text() is called as a function to get the text
                const anime_released = anime.find('.released').text();

                const anime_id = anime_url.split('/').pop();

                animePopular.push({ anime_title, anime_id, image_url, anime_released });
            });

            currentPage++;
        }

        return animePopular;
    } catch (err) {
        console.error(err);
        throw err;
    }
};

// Example usage
fetchPopularAnime().then(animePopular => {
    console.log(animePopular);
}).catch(error => {
    console.error("Failed to fetch popular anime:", error);
});





const fetchWatchAndEpisodes = async (baseSlug) => {
    try {
        // Initial setup to determine if we are working with a sub or dub
        let isDub = baseSlug.includes('-dub-');
        let slugBaseWithoutNumber = baseSlug.split('-').slice(0, -1).join('-');
        const initialUrl = `https://anitaku.to/${encodeURIComponent(baseSlug)}`;

        // Fetch the initial page to determine total episodes and check for dub availability
        let response = await axios.get(initialUrl);
        let html = response.data;
        let $ = cheerio.load(html);
        let epRange = $('#episode_page a.active').attr('ep_end');
        let totalEpisodes = parseInt(epRange, 10) + 1; // Assuming ep_end is inclusive

        // If not initially checking for a dub, check if a dub version is available
        if (!isDub) {
            const dubCheckSlug = slugBaseWithoutNumber + '-dub-episode-1';
            const dubCheckUrl = `https://anitaku.to/${encodeURIComponent(dubCheckSlug)}`;
            try {
                response = await axios.get(dubCheckUrl);
                if (response.status === 200) {
                    // Dub exists, adjust the baseSlug and slugBaseWithoutNumber for dub episodes
                    isDub = true;
                    baseSlug = dubCheckSlug;
                    slugBaseWithoutNumber += '-dub';
                }
            } catch (error) {
                // If the dub check fails (e.g., 404 error), continue with the original baseSlug
            }
        }

        // Fetch episodes (either dub or sub based on the check)
        const episodes = [];
        for (let i = 1; i <= totalEpisodes; i++) {
            const episodeSlug = `${slugBaseWithoutNumber}-episode-${i}`;
            const name = `${isDub ? 'Dub' : 'Sub'} Ep ${i}`;

            episodes.push({
                episodeSlug,
                name, // Includes whether it's a Dub or Sub
            });
        }

        // Assuming embedLink extraction remains the same
        const embedLink = $('.play-video iframe').attr('src');
        const video_id = embedLink.split('/').pop();
        

        return {
            embedLink,
            episodes,
            video_id
            
        };
    } catch (error) {
        console.error('Error fetching watch and episode data:', error);
        return null;
    }
};











const fetchDubbedAnimeList = async () => {
    const browser = await puppeteer.launch({ headless: true }); // Set to false for debugging
    const page = await browser.newPage();

    await page.goto('https://anitaku.to/home.html');

    // Click the "DUB" tab
    await page.click('a.dub[rel="2"]');

    // Wait for the dubbed anime list to load
    await page.waitForSelector('.last_episodes.loaddub li .type.ic-DUB', { timeout: 10000 });

    // Scrape the dubbed anime list
    const animeList = await page.evaluate(() => {
        // Only select list items that have the .ic-DUB type indicator
        const items = Array.from(document.querySelectorAll('.last_episodes.loaddub li .type.ic-DUB')).map(typeDiv => typeDiv.closest('li'));
        return items.map(item => {
           
            const titleElement = item.querySelector('p.name a');
            const anime_title = titleElement ? titleElement.title.trim() : '';
            const episodeElement = item.querySelector('p.episode');
            const ep = episodeElement ? episodeElement.textContent.trim() : '';
            const urlElement = item.querySelector('p.name a');
            const anime_url = urlElement ? new URL(urlElement.href, window.location.origin).href : '';
            const imageElement = item.querySelector('.img img');
            const image_Url = imageElement ? new URL(imageElement.src, window.location.origin).href : '';
            const anime_id = anime_url.split('/').pop();

            return { anime_title, ep, image_Url , anime_id};
        });
    });

    await browser.close();
    return animeList;
};

fetchDubbedAnimeList()
    .then(animeList => console.log(animeList))
    .catch(error => console.error(error));








