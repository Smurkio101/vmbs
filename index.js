const axios = require('axios');
const cheerio = require('cheerio');

const fetchAnime = async () => {
    try {
        const response = await axios.get('https://aniwatch.info/');
        const html = response.data;
        const $ = cheerio.load(html);
        const animeList = []; 
        

        $('.flw-item').each((index, el) => {
            const anime = $(el);
            const anime_title = anime.find('h3.film-name a').text(); 
            const anime_url = anime.find('a').attr('href');
            const image_url = anime.find('img').attr('data-src');
         
            animeList.push({ anime_title, anime_url, image_url });
        });
        return animeList;
    } catch (err) {
        console.error(err);
    }
};

fetchAnime().then(anime => console.log(anime));



const fetchdetails = async () => {
    try {
        const response = await axios.get('https://aniwatch.info/');
        const html = response.data;
        const $ = cheerio.load(html);
        const animedetails = []; 
        

        $('.').each((index, el) => {
            const anime = $(el);
            const anime_title = anime.find('h3.film-name a').text(); 
            const anime_url = anime.find('a').attr('href');
            const image_url = anime.find('img').attr('data-src');
         
            animeList.push({ anime_title, anime_url, image_url });
        });
        return animeList;
    } catch (err) {
        console.error(err);
    }
};

fetchdetail().then(anime => console.log(anime));





