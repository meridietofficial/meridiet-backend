import 'dotenv/config';
import { findDietPlanByFormId } from '../models/DietPlan';
import { generateDietPlanPdf } from '../services/dietPlanPdf';
import { uploadBufferToS3 } from '../services/uploadToS3';

const run = async () => {
  const FORM_ID = 2;

  console.log(`\nFetching diet plan for form_id = ${FORM_ID}...`);
  const plan = await findDietPlanByFormId(FORM_ID);

  if (!plan) {
    console.error('No diet plan found for form_id', FORM_ID);
    process.exit(1);
  }

  console.log(`Found plan: id=${plan.id}, status=${plan.status}, client=${plan.client_name}`);
  console.log(`Weeks: ${(plan.weeks as unknown[])?.length ?? 0}, Recipes: ${(plan.featured_recipes as unknown[])?.length ?? 0}`);

  console.log('\nGenerating PDF...');
  const pdfBuffer = await generateDietPlanPdf(plan);
  console.log(`PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

  console.log('\nUploading to S3...');
  const key = `diet-plans/test_form${FORM_ID}_${Date.now()}.pdf`;
  const url = await uploadBufferToS3(pdfBuffer, key, 'application/pdf');

  console.log('\n✅ PDF ready! Preview URL:');
  console.log(url);
  process.exit(0);
};

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
