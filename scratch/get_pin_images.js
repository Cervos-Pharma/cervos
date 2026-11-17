const https = require('https');
const fs = require('fs');

const pinIds = ['874261346431088020', '333759022406823529', '1098174690403810526'];

async function getPinImages() {
  for (const id of pinIds) {
    const url = `https://www.pinterest.com/pin/${id}/`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, res => {
      let html = '';
      res.on('data', c => html += c);
      res.on('end', () => {
        const matches = html.match(/https:\/\/i\.pinimg\.com\/originals\/[a-z0-9\/._-]+\.(jpg|png|gif)/gi) ||
                        html.match(/https:\/\/i\.pinimg\.com\/736x\/[a-z0-9\/._-]+\.(jpg|png|gif)/gi);
        console.log(`PIN ${id}:`, matches ? matches.slice(0, 3) : 'No matches found');
      });
    });
  }
}

getPinImages();
