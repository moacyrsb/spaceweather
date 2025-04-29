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

  // Extract both rain amount and date from the first table row
  const rainInfo = await page.evaluate(() => {
    const row = document.querySelector('table tbody tr');
    if (!row) return { rain: 0.0, date: null };
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return { rain: 0.0, date: null };

    const dateText = cells[0].innerText.trim(); // first column = date
    const gaugeText = cells[3].innerText.trim(); // fourth column = Gauge Catch

    const matchGauge = gaugeText.match(/[\d.]+/);
    const rain = matchGauge ? parseFloat(matchGauge[0]) : 0.0;

    return { rain, date: dateText };
  });

  // Debug: show raw date string
  console.log("Raw date string from site:", rainInfo.date);

  // Try flexible parsing of date
  let isoDate = null;
  if (rainInfo.date) {
    const parsed = new Date(rainInfo.date);
    if (!isNaN(parsed)) {
      isoDate = parsed.toISOString().split('T')[0];
    } else {
      console.warn("⚠️ Could not parse date from site. Falling back to today's date.");
    }
  }

  // Write final JSON
  fs.writeFileSync('rain_today.json', JSON.stringify({
    date: isoDate || new Date().toISOString().split('T')[0], // fallback
    total_precip_in: rainInfo.rain
  }, null, 2));

  await browser.close();
})();


