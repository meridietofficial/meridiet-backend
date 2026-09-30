import 'dotenv/config';
import { disconnectDatabase } from '../config/database';
import { findDietPlanById, saveDietPlanPdfUrl } from '../models/DietPlan';
import { findDietFormById } from '../models/DietForm';
import { generateDietPlanPdf } from '../services/dietPlanPdf';
import { uploadBufferToS3 } from '../services/uploadToS3';
import { sendDietPlanWhatsApp } from '../services/whatsapp';

// Usage:
//   PLAN_ID=301 WHATSAPP=+919810043718 npx ts-node src/scripts/regenPdfAndSend.ts

const run = async () => {
  const planId    = parseInt(process.env.PLAN_ID ?? '', 10);
  const whatsapp  = process.env.WHATSAPP ?? null;

  if (!planId || isNaN(planId)) {
    console.error('Usage: PLAN_ID=<id> [WHATSAPP=+91XXXXXXXXXX] npx ts-node src/scripts/regenPdfAndSend.ts');
    process.exit(1);
  }

  const plan = await findDietPlanById(planId);
  if (!plan) { console.error(`Plan ${planId} not found`); process.exit(1); }

  const form = await findDietFormById(plan.form_id);
  if (!form) { console.error(`Form ${plan.form_id} not found`); process.exit(1); }

  console.log(`\nGenerating PDF for plan #${planId} (${form.full_name ?? 'Unknown'}, form #${plan.form_id})...`);

  // Generate fresh PDF
  const pdfBuffer = await generateDietPlanPdf(plan);
  const s3Key     = `diet-plans/form_${plan.form_id}_${Date.now()}.pdf`;
  const url       = await uploadBufferToS3(pdfBuffer, s3Key, 'application/pdf');

  // Save new URL
  await saveDietPlanPdfUrl(planId, url);
  console.log(`✅ New PDF URL saved: ${url}`);

  // Send on WhatsApp if provided
  const target = whatsapp ?? form.whatsapp;
  if (target) {
    console.log(`\nSending diet plan on WhatsApp to ${target}...`);
    await sendDietPlanWhatsApp(target, form.full_name ?? 'there', url);
    console.log(`✅ WhatsApp sent to ${target}`);
  } else {
    console.log('\nNo WhatsApp number provided — skipping send.');
  }
};

run()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => disconnectDatabase());
