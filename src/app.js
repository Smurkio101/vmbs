import express from 'express';
import compression from 'compression';
import { router as newsRouter }    from './news.js';
import { router as convertRouter } from './convert.js';
import { router as anime } from './anime.js';
import axios from 'axios';

const app  = express();
const PORT = process.env.PORT || 3000;

/* ───────── global middleware ───────── */
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => {
  console.log(new Date().toISOString(), req.method, req.originalUrl);
  next();
});

/* ───────── route groups ────────────── */
app.use('/',          newsRouter);     // /uie, /news/:slug, /
app.use('/convert',   convertRouter);  // /convert?url=…
app.use('/',          anime);

/* ───────── 404 fallback ────────────── */
app.use((req, res) => res.status(404).send('Not found'));

/* ───────── keep-alive ping every 30 s ─*/
let count = 0;
setInterval(async () => {
  count += 1;
  try {
    const { status } = await axios.get('https://vmbs-24ux.onrender.com/uie');
    console.log(`[PING ${count}] ✅ ${status}`);
  } catch (e) {
    console.error(`[PING ${count}] ❌`, e.response?.status || e.message);
  }
}, 30_000);

/* ───────── start server ────────────── */
app.listen(PORT, () =>
  console.log(`🚀  API ready at http://localhost:${PORT}`)
);
