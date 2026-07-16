import { Router } from 'express';
import { sendCourseOtp, submitCourseEnquiry, submitCourseEnrollment, createCourseOrder, verifyCoursePayment, coursePyamentFailed } from '../controllers/course';

export const courseRouter = Router();

courseRouter.post('/send-otp',              sendCourseOtp);
courseRouter.post('/enquiry',               submitCourseEnquiry);
courseRouter.post('/enroll',                submitCourseEnrollment);
courseRouter.post('/payment/create-order',  createCourseOrder);
courseRouter.post('/payment/verify',        verifyCoursePayment);
courseRouter.post('/payment/failed',        coursePyamentFailed);
