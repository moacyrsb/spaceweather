const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto('https://dex.cocorahs.org/stations/SD-DV-38/obs-tables', {
    waitUntil: 'networkidle2'
  });

  // Evaluate the table rows and grab the first Gauge Catch value
  const rain = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    if (!rows.length) return 0.0;

    // The 4th cell (index 3) is usually "Gauge Catch (in)"
    const todayRow = rows[0];
    const cells = todayRow.querySelectorAll('td');
    if (cells.length < 4) return 0.0;

    const val = cells[3].textContent.trim();
    const match = val.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0.0;
  });

  // Save the rainfall data to JSON
  fs.writeFileSync('rain_today.json', JSON.stringify({
    date: new Date().toISOString().split('T')[0],
    total_precip_in: rain
  }, null, 2));

  await browser.close();
})();

