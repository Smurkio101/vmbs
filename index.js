const axios = require('axios');
const cheerio = require('cheerio');

const fetchAnime = async () => {
    try {
        const response = await axios.get('https://www.gogoanime.tw/');
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
    }
};

fetchAnime().then(anime => console.log(anime));


