import 'dotenv/config';
import { sendEmail } from '../services/email';
import { courseEnquiryUserEmail, courseEnquiryAdminEmail } from '../services/emails/courseEnquiryEmail';
import { courseEnrollmentUserEmail, courseEnrollmentAdminEmail } from '../services/emails/courseEnrollmentEmail';
import { coursePaymentSuccessUserEmail, coursePaymentSuccessAdminEmail } from '../services/emails/coursePaymentSuccessEmail';
import { coursePaymentFailedUserEmail } from '../services/emails/coursePaymentFailedEmail';

const TEST_TO = 'mannu@yopmail.com';

const SAMPLE = {
  name:          'Priya Sharma',
  email:         TEST_TO,
  phone:         '+919876543210',
  qualification: 'B.Sc Nutrition',
  message:       'I am very interested in the course. Please share more details.',
  enquiryId:     42,
  enrollmentId:  7,
  amountPaid:    24999,
  paymentId:     'pay_QxSamplePayment123',
  orderId:       'order_QxSampleOrder456',
};

const run = async () => {
  console.log(`\nSending all course email templates to ${TEST_TO}...\n`);

  // 1. Enquiry — user confirmation
  const enquiryUser = courseEnquiryUserEmail(SAMPLE.name, {
    email: SAMPLE.email, phone: SAMPLE.phone,
    qualification: SAMPLE.qualification, message: SAMPLE.message,
  });
  await sendEmail({ to: TEST_TO, subject: enquiryUser.subject, html: enquiryUser.html, text: enquiryUser.text });
  console.log('✅ 1. Enquiry user email      :', enquiryUser.subject);

  // 2. Enquiry — admin alert
  const enquiryAdmin = courseEnquiryAdminEmail({
    id: SAMPLE.enquiryId, name: SAMPLE.name, email: SAMPLE.email,
    phone: SAMPLE.phone, qualification: SAMPLE.qualification, message: SAMPLE.message,
  });
  await sendEmail({ to: TEST_TO, subject: enquiryAdmin.subject, html: enquiryAdmin.html, text: enquiryAdmin.text });
  console.log('✅ 2. Enquiry admin email     :', enquiryAdmin.subject);

  // 3. Enrollment — user (proceed to pay)
  const enrollUser = courseEnrollmentUserEmail(SAMPLE.name, {
    email: SAMPLE.email, phone: SAMPLE.phone, enrollmentId: SAMPLE.enrollmentId,
  });
  await sendEmail({ to: TEST_TO, subject: enrollUser.subject, html: enrollUser.html, text: enrollUser.text });
  console.log('✅ 3. Enrollment user email   :', enrollUser.subject);

  // 4. Enrollment — admin (payment pending)
  const enrollAdmin = courseEnrollmentAdminEmail({
    id: SAMPLE.enrollmentId, name: SAMPLE.name, email: SAMPLE.email, phone: SAMPLE.phone,
  });
  await sendEmail({ to: TEST_TO, subject: enrollAdmin.subject, html: enrollAdmin.html, text: enrollAdmin.text });
  console.log('✅ 4. Enrollment admin email  :', enrollAdmin.subject);

  // 5. Payment success — user
  const successUser = coursePaymentSuccessUserEmail(SAMPLE.name, {
    enrollmentId: SAMPLE.enrollmentId, email: SAMPLE.email, phone: SAMPLE.phone,
    amountPaid: SAMPLE.amountPaid, razorpayPaymentId: SAMPLE.paymentId,
  });
  await sendEmail({ to: TEST_TO, subject: successUser.subject, html: successUser.html, text: successUser.text });
  console.log('✅ 5. Payment success user    :', successUser.subject);

  // 6. Payment success — admin
  const successAdmin = coursePaymentSuccessAdminEmail({
    enrollmentId: SAMPLE.enrollmentId, name: SAMPLE.name, email: SAMPLE.email, phone: SAMPLE.phone,
    amountPaid: SAMPLE.amountPaid, razorpayPaymentId: SAMPLE.paymentId, razorpayOrderId: SAMPLE.orderId,
  });
  await sendEmail({ to: TEST_TO, subject: successAdmin.subject, html: successAdmin.html, text: successAdmin.text });
  console.log('✅ 6. Payment success admin   :', successAdmin.subject);

  // 7. Payment failed — user
  const failedUser = coursePaymentFailedUserEmail(SAMPLE.name, {
    enrollmentId: SAMPLE.enrollmentId, amountAttempted: SAMPLE.amountPaid,
  });
  await sendEmail({ to: TEST_TO, subject: failedUser.subject, html: failedUser.html, text: failedUser.text });
  console.log('✅ 7. Payment failed user     :', failedUser.subject);

  console.log(`\nAll 7 emails sent. Check ${TEST_TO}\n`);
};

run().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
