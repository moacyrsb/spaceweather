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

  // Extract gauge value AND measurement date
  const rainInfo = await page.evaluate(() => {
    const row = document.querySelector('table tbody tr');
    if (!row) return { rain: 0.0, date: null };
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return { rain: 0.0, date: null };

    const dateCell = cells[0];
    const dateText = dateCell ? dateCell.innerText.trim() : null;
    const gaugeText = cells[3].textContent.trim(); // fourth column = Gauge Catch

    const matchGauge = gaugeText.match(/[\d.]+/);
    const rain = matchGauge ? parseFloat(matchGauge[0]) : 0.0;

    return { rain, date: dateText };
  });

  // Parse rainInfo.date into ISO if possible
  let isoDate = null;
  if (rainInfo.date) {
    const parts = rainInfo.date.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      isoDate = `${year}-${month}-${day}`;
    }
  }

  fs.writeFileSync('rain_today.json', JSON.stringify({
    date: isoDate || new Date().toISOString().split('T')[0], // fallback to today if parsing fails
    total_precip_in: rainInfo.rain
  }, null, 2));

  await browser.close();
})();

