const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.goto('https://dex.cocorahs.org/stations/SD-DV-38/obs-tables', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Wait for the main table to appear
  await page.waitForSelector('table tbody tr');

  const rainInfo = await page.evaluate(() => {
    const row = document.querySelector('table tbody tr');
    if (!row) return { rain: 0.0, date: null };
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return { rain: 0.0, date: null };

    const dateText = cells[1].innerText.trim();       // ✅ correct date cell
    const gaugeText = cells[3].innerText.trim();      // ✅ rain value

    const matchGauge = gaugeText.match(/[\d.]+/);
    const rain = matchGauge ? parseFloat(matchGauge[0]) : 0.0;

    return { rain, date: dateText };
  });

  console.log("✅ Raw date string from site:", rainInfo.date);

  const isoDate = rainInfo.date || new Date().toISOString().split('T')[0];

  fs.writeFileSync('rain_today.json', JSON.stringify({
    date: isoDate,
    total_precip_in: rainInfo.rain
  }, null, 2));

  await browser.close();
})();
