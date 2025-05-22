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


app.get('/', (req, res) => {
    res.status(200).json('suck yo mada {OTF, OGT, VIP}  ');
});







async function fetchAnni(slug) {
    try {
        const url = `https://www.cbr.com/${slug}`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const content = $('#article-body .content-block-regular p')
            .map((i, el) => $(el).text().trim())
            .get()
            .join(' '); // Joining all the paragraphs into a single string

        const mangaDetails = {
            anime_title: $('.article-header-title').text().trim(),
            tag: $('.tag-label.no-bg span').text().trim(),
            img: $('.heading_image img').attr('src'),
            description: $('meta[name="description"]').attr('content').trim(),
            content: content
        };

        return mangaDetails;
    } catch (error) {
        console.error('Error fetching the page:', error);
        throw error;
    }
}
// Express route handler
app.get('/news/:slug', async (request, response, next) => {
    try {
        const { slug } = request.params;
        const anniDetails = await fetchAnni(slug);

        if (anniDetails) {
            response.json(anniDetails);
        } else {
            response.status(404).send('Content not found');
        }
    } catch (error) {
        console.error(error);
        next(error);
    }
});


app.get('/uie', async (req, res) => {
    const newsList = await scrapeAllNewsPages();
    res.json(newsList);
});


const fetchLatestNewsFromPage = async (url) => {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        const newsList = [];

        $('.display-card.article.small.active-content').each((index, el) => {
            const newsElement = $(el);
            const anime_title = newsElement.find('.display-card-title').text().trim();
            const  anime_image = newsElement.find('picture source').last().attr('srcset');
            const anime_url = newsElement.find('a.dc-img-link').attr('href');
            const anime_id = anime_url.replace(/^\/|\/$/g, '');

            newsList.push({
                anime_title,
                anime_image,
                anime_id,
            });
        });

        return newsList;
    } catch (err) {
        console.error(err);
        return [];
    }
}



const scrapeAllNewsPages = async () => {
    const baseUrl = 'https://www.cbr.com/category/anime/';
    const maxPages = 3;  // Total number of pages you want to scrape
    const allNews = [];

    for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 ? baseUrl : `${baseUrl}${page}/`;
        const newsList = await fetchLatestNewsFromPage(url);
        if (newsList.length > 0) {
            allNews.push(...newsList);
        } else {
            break;  // Stop the loop if no news is found on a page
        }
    }

    return allNews;
}


