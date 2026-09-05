const puppeteer = require('puppeteer');

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
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
