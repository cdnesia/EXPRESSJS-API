const env = require('../config/env');

let browserPromise = null;

// Production: puppeteer-core + Chromium statis dari @sparticuz/chromium —
// binary-nya sudah bawa hampir semua shared library-nya sendiri, jadi
// server tidak perlu apt/yum install libnspr4, libnss3, dkk.
// Lokal/dev: puppeteer biasa (bundled Chromium) supaya tidak perlu setup
// apa-apa di mesin developer.
async function launchBrowser() {
  if (env.nodeEnv === 'production') {
    // Paket ESM-only — lewat require(), API sebenarnya ada di .default.
    const chromium = require('@sparticuz/chromium').default;
    const puppeteer = require('puppeteer-core');

    return puppeteer.launch({
      headless: true,
      args: chromium.args,
      executablePath: await chromium.executablePath(),
    });
  }

  const puppeteer = require('puppeteer');
  return puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
}

function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }
  return browserPromise;
}

async function renderHtmlToPdf(html, pdfOptions = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'a4',
      printBackground: true,
      margin: { top: '1cm', bottom: '1.5cm', left: '1.5cm', right: '1.5cm' },
      ...pdfOptions,
    });
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

module.exports = { renderHtmlToPdf, closeBrowser };
