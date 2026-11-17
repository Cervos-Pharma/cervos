const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function compositeBrand() {
  const pubDir = path.resolve(__dirname, '../public');
  
  // 1. Prepare rasterized logo badges
  const logoCircularSvg = fs.readFileSync(path.join(pubDir, 'cervos-company-logo-circular.svg'));
  const prodCircularSvg = fs.readFileSync(path.join(pubDir, 'cervos-product-logo-circular.svg'));
  
  const logo120 = await sharp(logoCircularSvg).resize(120, 120).png().toBuffer();
  const logo160 = await sharp(logoCircularSvg).resize(160, 160).png().toBuffer();
  const prod100 = await sharp(prodCircularSvg).resize(100, 100).png().toBuffer();
  const prod120 = await sharp(prodCircularSvg).resize(120, 120).png().toBuffer();
  const prod140 = await sharp(prodCircularSvg).resize(140, 140).png().toBuffer();

  // 1. Pharmacy Counter: Place Cervos Product Logo right on the POS Tablet / Header area
  // Dimensions 1376x768
  console.log('Compositing pharmacy-counter.jpg...');
  await sharp(path.join(pubDir, 'pharmacy-counter.jpg'))
    .composite([
      {
        input: prod140,
        top: 260,
        left: 450,
        blend: 'over'
      }
    ])
    .toFile(path.join(pubDir, 'pharmacy-counter.jpg.tmp'));
  fs.renameSync(path.join(pubDir, 'pharmacy-counter.jpg.tmp'), path.join(pubDir, 'pharmacy-counter.jpg'));

  // 2. Pharmacy Logistics: Brand the delivery van with official Cervos Company Logo
  console.log('Compositing pharmacy-logistics.jpg...');
  await sharp(path.join(pubDir, 'pharmacy-logistics.jpg'))
    .composite([
      {
        input: logo160,
        top: 310,
        left: 560,
        blend: 'over'
      }
    ])
    .toFile(path.join(pubDir, 'pharmacy-logistics.jpg.tmp'));
  fs.renameSync(path.join(pubDir, 'pharmacy-logistics.jpg.tmp'), path.join(pubDir, 'pharmacy-logistics.jpg'));

  // 3. Pharmacy Shelves: Brand with clinical accreditation seal
  console.log('Compositing pharmacy-shelves.jpg...');
  await sharp(path.join(pubDir, 'pharmacy-shelves.jpg'))
    .composite([
      {
        input: prod120,
        top: 50,
        left: 1200,
        blend: 'over'
      }
    ])
    .toFile(path.join(pubDir, 'pharmacy-shelves.jpg.tmp'));
  fs.renameSync(path.join(pubDir, 'pharmacy-shelves.jpg.tmp'), path.join(pubDir, 'pharmacy-shelves.jpg'));

  // 4. Pharmacist 1: Add clinical Cervos badge to the pharmacist's station/coat
  console.log('Compositing pharmacist-1.png...');
  await sharp(path.join(pubDir, 'pharmacist-1.png'))
    .composite([
      {
        input: logo120,
        top: 40,
        left: 50,
        blend: 'over'
      }
    ])
    .toFile(path.join(pubDir, 'pharmacist-1.png.tmp'));
  fs.renameSync(path.join(pubDir, 'pharmacist-1.png.tmp'), path.join(pubDir, 'pharmacist-1.png'));

  // 5. Pharmacist 2: Add clinical Cervos badge to the practitioner's lab coat
  console.log('Compositing pharmacist-2.png...');
  await sharp(path.join(pubDir, 'pharmacist-2.png'))
    .composite([
      {
        input: logo120,
        top: 40,
        left: 50,
        blend: 'over'
      }
    ])
    .toFile(path.join(pubDir, 'pharmacist-2.png.tmp'));
  fs.renameSync(path.join(pubDir, 'pharmacist-2.png.tmp'), path.join(pubDir, 'pharmacist-2.png'));

  console.log('Done compositing brand logos onto all images!');
}

compositeBrand().catch(err => {
  console.error(err);
  process.exit(1);
});
