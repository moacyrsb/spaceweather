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

  // Screenshot for debugging
  await page.screenshot({ path: 'debug_screenshot.png', fullPage: true });

  // Log contents of first row
  const debugText = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    if (!rows.length) return "No rows found";
    const cells = Array.from(rows[0].querySelectorAll('td')).map(td => td.textContent.trim());
    return cells.join(" | ");
  });

  fs.writeFileSync('debug_row.txt', debugText);

  // Extract gauge value
  const rain = await page.evaluate(() => {
    const row = document.querySelector('table tbody tr');
    if (!row) return 0.0;
    const cell = row.querySelectorAll('td')[3]; // Gauge Catch column
    if (!cell) return 0.0;
    const val = cell.textContent.trim();
    const match = val.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0.0;
  });
  
  fs.writeFileSync('rain_today.json', JSON.stringify({
    date: new Date().toISOString().split('T')[0],
    total_precip_in: rain
  }, null, 2));

  await browser.close();
})();

