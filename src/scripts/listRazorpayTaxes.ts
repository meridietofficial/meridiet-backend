/**
 * Run once to find your Razorpay GST tax ID:
 *   npx ts-node --transpile-only -r tsconfig-paths/register src/scripts/listRazorpayTaxes.ts
 */
import 'dotenv/config';
import { env } from '../config/env';

const run = async () => {
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');

  const res = await fetch('https://api.razorpay.com/v1/taxes', {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    console.error('Failed:', res.status, await res.text());
    process.exit(1);
  }

  const data = (await res.json()) as { items: Array<{ id: string; name: string; rate: number; active: boolean }> };

  if (!data.items?.length) {
    console.log('No taxes found in your Razorpay account.');
    console.log('Go to: Razorpay Dashboard → Invoices → (create any invoice) → Add Tax');
    return;
  }

  console.log('\nYour Razorpay Taxes:\n');
  data.items.forEach((t) => {
    console.log(`  ID   : ${t.id}`);
    console.log(`  Name : ${t.name}`);
    console.log(`  Rate : ${t.rate / 100}%`);
    console.log(`  Active: ${t.active}`);
    console.log('');
  });

  const gst = data.items.find((t) => t.rate === 1800 && t.active);
  if (gst) {
    console.log(`Add this to your .env:\n\nRAZORPAY_GST_TAX_ID=${gst.id}\n`);
  }
};

run().catch(console.error);
