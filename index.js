const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
const PORT = 3001;

app.listen(PORT, () => console.log(`Running Express Server on PORT ${PORT}!`));

app.get('/animeList', async (request, response) => {
    try {
        const animeList = await fetchAnime();
        response.send(animeList);
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal Server Error');
    }
});

const fetchAnime = async () => {
    try {
        const response = await axios.get('https://www.gogoanime.fi/');
        const html = response.data;
        const $ = cheerio.load(html);
        const animeList = [];

        $('.last_episodes.loaddub li').each((index, el) => {
            const anime = $(el);
            const anime_title = anime.find('.name a').text().trim();
            const anime_url = anime.find('.name a').attr('href');
            const image_url = anime.find('img').attr('src');

            // Extract anime ID from anime_url
            const anime_id = anime_url.split('/').pop();

            animeList.push({ anime_title, anime_url, anime_id, image_url });
        });
        return animeList;
    } catch (err) {
        console.error(err);
        throw err; 
    }
};


app.get('/animeMovie', async (request, response) => {
    try {
        const animeMovie = await fetchMovies();
        response.send(animeMOVIE);
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal Server Error');
    }
});

const fetchMovies = async () => {
    try {
        const response = await axios.get('https://www.gogoanime.tw/anime-movies');
        const html = response.data;
        const $ = cheerio.load(html);
        const animeMovie = [];

        $('.last_episodes').each((index, element) => {
            const anime = $(element);
            const anime_title = anime.find('.name a').text().trim();
            const anime_url = anime.find('.name a').attr('href');
            const image_url = anime.find('img').attr('src');
            const released = anime.find('released').text;

            // Extract anime ID from anime_url
            const anime_id = anime_url.split('/').pop();

            animeMovie.push({ anime_title, anime_url, anime_id, image_url , released });
        });

        return animeMovie;
    } catch (err) {
        console.error(err);
        throw err;
    }
};



app.get('/animepopular', async (request, response) => {
    try {
        const animePOPULAR = await fetchpopular();
        response.send(animeMOVIE);
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal Server Error');
    }
});

const fetchpopular = async () => {
    try {
        const response = await axios.get('https://www.gogoanime.tw/anime-movies');
        const html = response.data;
        const $ = cheerio.load(html);
        const animePOPULAR = [];

        $('.last_episodes').each((index, element) => {
            const anime = $(element);
            const anime_title = anime.find('.name a').text().trim();
            const anime_url = anime.find('.name a').attr('href');
            const image_url = anime.find('img').attr('src');
            const anime_released = anime.find('released').text;

            // Extract anime ID from anime_url
            const anime_id = anime_url.split('/').pop();

            animePOPULAR.push({ anime_title, anime_url, anime_id, image_url , anime_released });
        });

        return animePOPULAR;
    } catch (err) {
        console.error(err);
        throw err;
    }
};



