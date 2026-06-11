import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import type { DietPlan } from '../models/DietPlan';
import { buildDietPlanHtml } from './dietPlanHtml';

const LOCAL_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
  '/usr/bin/google-chrome',                                        // Linux
  '/usr/bin/chromium-browser',                                     // Linux
  '/usr/bin/chromium',                                             // Linux
];

const getExecutablePath = async (): Promise<string> => {
  if (process.env.NODE_ENV === 'production') {
    return chromium.executablePath();
  }
  for (const p of LOCAL_CHROME_PATHS) {
    const { existsSync } = await import('fs');
    if (existsSync(p)) return p;
  }
  throw new Error('No Chrome/Chromium found locally. Install Chrome or set NODE_ENV=production.');
};

export const generateDietPlanPdf = async (plan: DietPlan): Promise<Buffer> => {
  const html = buildDietPlanHtml(plan);
  const isProduction = process.env.NODE_ENV === 'production';

  const browser = await puppeteer.launch({
    args: isProduction ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    executablePath: await getExecutablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });

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
