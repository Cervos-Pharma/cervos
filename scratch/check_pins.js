const https = require('https');

const pins = [
  'https://www.pinterest.com/pin/874261346431088020/',
  'https://www.pinterest.com/pin/333759022406823529/',
  'https://www.pinterest.com/pin/1098174690403810526/'
];

async function fetchPin(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const ogImg = data.match(/property="og:image" content="([^"]+)"/)?.[1];
        const title = data.match(/<title>([^<]+)<\/title>/)?.[1];
        const ogDesc = data.match(/property="og:description" content="([^"]+)"/)?.[1];
        const schemaMatch = data.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        let schema = null;
        if (schemaMatch) {
          try { schema = JSON.parse(schemaMatch[1]); } catch(e){}
        }
        resolve({ url, title, ogImg, ogDesc, schemaName: schema?.name, schemaDesc: schema?.headline || schema?.description });
      });
    }).on('error', () => resolve({ url, error: true }));
  });
}

async function main() {
  for (const pin of pins) {
    const res = await fetchPin(pin);
    console.log(JSON.stringify(res, null, 2));
  }
}

main();
