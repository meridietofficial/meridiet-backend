import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const LOCAL_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

const getExecutablePath = async (): Promise<string> => {
  if (process.env.NODE_ENV === 'production') {
    return chromium.executablePath();
  }
  for (const p of LOCAL_CHROME_PATHS) {
    const { existsSync } = await import('fs');
    if (existsSync(p)) return p;
  }
  throw new Error('No Chrome/Chromium found locally.');
};

export const generateGstInvoicePdf = async (html: string): Promise<Buffer> => {
  const isProduction = process.env.NODE_ENV === 'production';

  const browser = await puppeteer.launch({
    args: isProduction
      ? [...chromium.args, '--font-render-hinting=none']
      : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
    executablePath: await getExecutablePath(),
    headless: isProduction ? ('shell' as const) : true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.evaluate('document.fonts.ready');
    await new Promise((r) => setTimeout(r, 150));

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
};
