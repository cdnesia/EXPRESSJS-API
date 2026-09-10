const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      // user-data-dir eksplisit — di beberapa environment (proses jalan
      // sebagai root lewat PM2/systemd tanpa HOME yang jelas) Chrome gagal
      // menentukan direktori data sendiri, bikin argumen --database yang
      // dikirim ke chrome_crashpad_handler jadi kosong dan crash saat start.
      userDataDir: path.join(os.tmpdir(), 'puppeteer-khs-data'),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-crash-reporter',
      ],
    });
  }
  return browserPromise;
}

async function renderHtmlToPdf(html, pdfOptions = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Template PDF di project ini selalu inline (gambar base64, tanpa CSS/
    // font eksternal), jadi tidak ada request jaringan buat ditunggu —
    // 'networkidle0' nunggu ~500ms+ idle window yang percuma di sini dan
    // terbukti bikin tiap render lebih dari 10x lebih lambat (benchmark:
    // ~960ms vs ~90ms) dibanding 'load', yang tetap menjamin gambar sudah
    // selesai di-decode sebelum di-print ke PDF.
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({
      format: 'a4',
      printBackground: true,
      margin: { top: '1cm', bottom: '1cm', left: '1.5cm', right: '1.5cm' },
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

module.exports = { renderHtmlToPdf, closeBrowser, getBrowser };
