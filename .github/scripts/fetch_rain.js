const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto('https://dex.cocorahs.org/stations/SD-DV-38/obs-tables', { waitUntil: 'networkidle2' });

  const text = await page.evaluate(() => {
    const match = Array.from(document.querySelectorAll('*'))
      .map(el => el.textContent)
      .find(text => text.includes('Today:'));
    const valMatch = match?.match(/Today:\s*([\d.]+)/);
    return valMatch ? parseFloat(valMatch[1]) : 0.0;
  });

  fs.writeFileSync('rain_today.json', JSON.stringify({
    date: new Date().toISOString().split('T')[0],
    total_precip_in: text
  }, null, 2));

  await browser.close();
})();
