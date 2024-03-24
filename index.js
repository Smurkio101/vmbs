const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

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
            // Handling case where no content is found
            response.status(404).send('Content not found');
        }
    } catch (error) {
        console.error(error);
        next(error); // Pass errors to the error-handling middleware
    }
});


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

            animeList.push({ anime_title, anime_url, anime_id, image_url });
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
    try {
        const response = await axios.get('https://anitaku.to/popular.html');
        const html = response.data;
        const $ = cheerio.load(html);
        const animePopular = [];

        
        $('.last_episodes').each((index, element) => {
            const anime = $(element);
            const anime_title = anime.find('.name a').text().trim();
            const anime_url = anime.find('.name a').attr('href');
            const image_url = anime.find('img').attr('src');
            const anime_released = anime.find('released').text;

            const anime_id = anime_url.split('/').pop();

            animePopular.push({ anime_title, anime_url, anime_id, image_url, anime_released });
        });

        return animePopular;
    } catch (err) {
        console.error(err);
        throw err;
    }
};



const fetchWatchAndEpisodes = async (slug) => {
    try {
        const url = `https://anitaku.to/${encodeURIComponent(slug)}`;
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

       
        const embedLink = $('.play-video iframe').attr('src');

       
        const episodes = [];
        $('#load_ep li').each((i, el) => {
            const episodeSlug = $(el).find('a').attr('href').trim();
            const episodeName = $(el).find('.name').text().trim();
            const category = $(el).find('.cate').text().trim(); // SUB or DUB

            episodes.push({
                episodeName,
                episodeSlug,
                category
            });
        });

        return {
            embedLink,
            episodes
        };
    } catch (error) {
        console.error('Error fetching watch and episode data:', error);
        return null;
    }
};



