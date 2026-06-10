import puppeteer from 'puppeteer';
import type { DietPlan } from '../models/DietPlan';
import { buildDietPlanHtml } from './dietPlanHtml';

export const generateDietPlanPdf = async (plan: DietPlan): Promise<Buffer> => {
  const html = buildDietPlanHtml(plan);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    // Match the 794px page width used in the HTML template
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
