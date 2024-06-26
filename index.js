const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.originalUrl}`);
  next();
});

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
      const anime_date = $(element).find('.date').text().trim();
      const anime_id = anime_url.split('/').pop();
      const anime_d = anime_date.split('-')[0];
      results.push({ anime_title, anime_img,anime_date, anime_id, anime_d});
    });

    res.json(results);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.listen(PORT, () => console.log(`Running Express Server on PORT ${PORT}!`));
