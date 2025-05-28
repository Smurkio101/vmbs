// fastdl-reel-probe.js
// node fastdl-reel-probe.js "https://www.instagram.com/reel/DIhxnWFsJHQ/"

import axios            from 'axios';
import crypto           from 'crypto';
import process          from 'node:process';

/* ────────────────────────────────────────────────────────────
   1. Small helpers
   ──────────────────────────────────────────────────────────── */
const prettyJSON = obj => JSON.stringify(obj, null, 2);

/** FastDl always sets these two cookies – copy them once from DevTools
 *  and reuse them until they expire. If they disappear you’ll get 403. */
const COOKIE   = 'uid=b76bcd5fc44fa5c0; googleAds=99';   // <- put yours here
const REFERER  = 'https://fastdl.app/en';
const UA       = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

/* ────────────────────────────────────────────────────────────
   2. Signature generator
   ────────────────────────────────────────────────────────────
   FastDl’s frontend (bundled Vue) builds _s like this:

       _s = sha256( url + '|' + ts + '|' + _ts + '|' + _tsc + '|fastdl' )

   – “fastdl” is a hard-coded salt that ships in the minified JS.
   – The pipe delimiters *must* be there.
   – Keys are plain decimal strings (no quotes, no spaces).
*/
const SALT = 'fastdl';
function makeSignature({ url, ts, _ts, _tsc }) {
  const raw = `${url}|${ts}|${_ts}|${_tsc}|${SALT}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/* ────────────────────────────────────────────────────────────
   3. Get the FastDl server clock – returns an *epoch* in seconds.
   ──────────────────────────────────────────────────────────── */
async function fetchServerMsec() {
  const { data } = await axios.get('https://fastdl.app/msec', {
    headers: { Cookie: COOKIE, Referer: REFERER, 'User-Agent': UA }
  });
  return Math.floor(data.msec * 1000);          // → milliseconds
}

/* ────────────────────────────────────────────────────────────
   4. Build the payload exactly like the site does
   ──────────────────────────────────────────────────────────── */
async function buildPayload(igUrl) {
  const serverNow = await fetchServerMsec();
  const clientNow = Date.now();

  /*  FastDl deliberately drifts _ts backwards so you can’t
      replay old payloads. In practice a 15--60 min offset works.
      Their own code does:  serverMsec - 1 000 000  (≈-16 m 40 s)
  */
  const OFFSET_MS = 1_000_000;
  const payload = {
    url : igUrl,
    ts  : clientNow,
    _ts : serverNow - OFFSET_MS,
    _tsc: 0
  };
  payload._s = makeSignature(payload);
  return payload;
}

/* ────────────────────────────────────────────────────────────
   5. Call /api/convert and pretty-print the JSON
   ──────────────────────────────────────────────────────────── */
async function probe(igUrl) {
  if (!/^https?:\/\/(www\.)?instagram\.com\/.+$/.test(igUrl))
    throw new Error('Expecting a valid Instagram URL');

  const payload = await buildPayload(igUrl);
  console.log('🔑  Payload sent to /api/convert:\n', prettyJSON(payload), '\n');

  const { data } = await axios.post('https://fastdl.app/api/convert', payload, {
    headers: {
      Cookie: COOKIE,
      Referer: REFERER,
      'User-Agent': UA,
      'Content-Type': 'application/json'
    },
    timeout: 15_000
  });

  console.log('📦  FastDl response:\n', prettyJSON(data));
}

/* ──────────────────────────────────────────────────────────── */

const igUrl = process.argv[2];
probe(igUrl)
  .catch(err => {
    console.error('🚨  Request failed:', err.response?.data || err.message);
    process.exit(1);
  });
