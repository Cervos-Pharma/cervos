const PAT = process.env.GH_PAT || '';
const r = await fetch('https://api.github.com/repos/Cervos-Pharma/cervos/actions/secrets/public-key', {
  headers: { 'Authorization': 'token ' + PAT, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'cervos-setup' }
});
const d = await r.json();
console.log(JSON.stringify(d, null, 2));
