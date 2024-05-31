const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const puppeteer = require ('puppeteer');


const app = express();
const PORT = 3001;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`Received request: ${req.method} ${req.originalUrl}`);
    next();
});


app.listen(PORT, () => console.log(`Running Express Server on PORT ${PORT}!`));


// GET endpoint to scrape the search results
app.get('/search', async (req, res) => {
    const keyword = req.query.keyword;
    if (!keyword) {
      return res.status(400).json({ error: 'Missing keyword parameter' });
    }
  
    try {
      const url = `https://embtaku.pro/search.html?keyword=${encodeURIComponent(keyword)}`;
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
  
      const results = [];
      $('ul.listing.items li.video-block').each((index, element) => {
        const anime_title = $(element).find('div.name').text().trim();
        const anime_img = $(element).find('div.picture img').attr('src');
        const anime_url = $(element).find('a').attr('href');
        const anime_id = anime_url.split('/').pop();
        results.push({ anime_title, anime_img ,anime_id});

      });
  
      res.json(results);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });