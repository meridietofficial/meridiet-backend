import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authenticate';
import { adminLogin, refreshAdminToken, getAdminProfile, changeAdminPassword, getDietitianList, getDietitianRequests, getDietitianDetails, toggleBlockDietitian, deleteDietitian, verifyDietitianHandler, getUserList, getUserDetails, toggleBlockUser, deleteUser, getDashboardStats, getDashboardRevenue, getDashboardUserGrowth, getDashboardConsultations, getSystemOverview, adminRegisterDietitian } from '../controllers/admin';
import { listDietPlansForAdmin, getDietPlanForAdmin, editDietPlan, sendDietPlanToUser, retryDietPlanGeneration, listManualDietPlansForAdmin, getManualDietPlanForAdmin, getDietFormRequests, getPaidDietCharts, getDietChartDetails, previewDietPlan } from '../controllers/adminDietPlan';
import { adminCreateCoupon, adminListCoupons, adminGetCoupon, adminUpdateCoupon, adminDeactivateCoupon, adminGetCouponUsages, adminGetAllCouponUsages } from '../controllers/coupon';
import { adminListEnquiries, adminGetEnquiry, adminUpdateEnquiryStatus, adminListEnrollments, adminGetEnrollment, adminCourseStats } from '../controllers/adminCourse';
import {
  adminGetAppointments,
  adminGetOnlineAppointments,
  adminGetOfflineAppointments,
  adminGetAppointmentById,
  adminApprovePayment,
  adminGetPendingApprovalsList,
  adminGetPaymentHistoryList,
  adminGetNoShowQueueHandler,
  adminGetPendingNoShowApprovalsHandler,
  adminMarkNoShow,
  adminApproveNoShow,
} from '../controllers/adminAppointment';
import {
  getBmiCategories, createBmiCategory, updateBmiCategory, deleteBmiCategory,
  getActivityMultipliers, updateActivityMultiplier,
  getGoalSettings, updateGoalSetting,
  getCalorieFloors, updateCalorieFloor,
  getMedicalAdjustments, createMedicalAdjustment, updateMedicalAdjustment, deleteMedicalAdjustment,
  getGeneralSettings, updateGeneralSetting,
} from '../controllers/nutritionConfig';
import { listHealthGoals, createHealthGoal, updateHealthGoal, deleteHealthGoal } from '../controllers/healthGoals';
import { listCuisinePreferences, createCuisinePreference, updateCuisinePreference, deleteCuisinePreference } from '../controllers/cuisinePreferences';
import { listFoodAllergies, createFoodAllergy, updateFoodAllergy, deleteFoodAllergy } from '../controllers/foodAllergies';
import { listMedicalConditions, createMedicalCondition, updateMedicalCondition, deleteMedicalCondition } from '../controllers/medicalConditions';
import { listMedicines, createMedicine, updateMedicine, deleteMedicine } from '../controllers/medicines';
import { getBroadcastRecipients, sendBroadcastEmail, getBroadcastHistory, getBroadcastDetail } from '../controllers/adminBroadcast';
import { getAdminEarnings, adminCreditPlanCreditsHandler, adminCreditEarningsHandler } from '../controllers/adminEarnings';
import {
  adminListJobs, adminCreateJob, adminGetJob, adminUpdateJob, adminDeleteJob, adminToggleJob,
  adminListApplications, adminGetApplication, adminUpdateApplicationStatus,
} from '../controllers/career';

export const adminRouter = Router();

// POST /api/v1/admin/login
adminRouter.post('/login', adminLogin);

// POST /api/v1/admin/refresh-token
adminRouter.post('/refresh-token', refreshAdminToken);

// Profile & password — admin only
adminRouter.get('/profile', authenticate, authorize('admin'), getAdminProfile);
adminRouter.patch('/change-password', authenticate, authorize('admin'), changeAdminPassword);

// Dietitian management — admin only
adminRouter.post('/dietitians/register', authenticate, authorize('admin'), adminRegisterDietitian);
adminRouter.get('/dietitian-requests', authenticate, authorize('admin'), getDietitianRequests);
adminRouter.get('/dietitians', authenticate, authorize('admin'), getDietitianList);
adminRouter.get('/dietitian/:id', authenticate, authorize('admin'), getDietitianDetails);
adminRouter.patch('/toggle-block-dietitian', authenticate, authorize('admin'), toggleBlockDietitian);
adminRouter.delete('/delete-dietitian', authenticate, authorize('admin'), deleteDietitian);
adminRouter.patch('/dietitians/verify', authenticate, authorize('admin'), verifyDietitianHandler);

// Diet form requests — admin only
adminRouter.get('/diet-form-requests', authenticate, authorize('admin'), getDietFormRequests);
adminRouter.get('/paid-diet-charts',   authenticate, authorize('admin'), getPaidDietCharts);
adminRouter.get('/diet-form-requests/:form_id/details', authenticate, authorize('admin'), getDietChartDetails);
adminRouter.get('/diet-form-requests/:form_id/preview', authenticate, authorize('admin'), previewDietPlan);

// User management — admin only
adminRouter.get('/existing-users', authenticate, authorize('admin'), getUserList);
adminRouter.get('/user/:id', authenticate, authorize('admin'), getUserDetails);
adminRouter.patch('/toggle-block-user', authenticate, authorize('admin'), toggleBlockUser);
adminRouter.delete('/delete-user', authenticate, authorize('admin'), deleteUser);

// Earnings
adminRouter.get('/earnings', authenticate, authorize('admin'), getAdminEarnings);

// Plan credits — credit a dietitian's plan wallet
adminRouter.post('/dietitians/:id/plan-credits', authenticate, authorize('admin'), adminCreditPlanCreditsHandler);

// Earnings credit — credit a dietitian's earnings wallet
adminRouter.post('/dietitians/:id/earnings-credit', authenticate, authorize('admin'), adminCreditEarningsHandler);

// Dashboard analytics
adminRouter.get('/dashboard-stats',        authenticate, authorize('admin'), getDashboardStats);
adminRouter.get('/dashboard-revenue',      authenticate, authorize('admin'), getDashboardRevenue);
adminRouter.get('/dashboard-user-growth',  authenticate, authorize('admin'), getDashboardUserGrowth);
adminRouter.get('/dashboard-consultations',authenticate, authorize('admin'), getDashboardConsultations);
adminRouter.get('/system-overview',        authenticate, authorize('admin'), getSystemOverview);

// ── Nutrition Config (admin editable calculation settings) ────────────────────
// BMI categories
adminRouter.get   ('/nutrition/bmi-categories',      authenticate, authorize('admin'), getBmiCategories);
adminRouter.post  ('/nutrition/bmi-categories',      authenticate, authorize('admin'), createBmiCategory);
adminRouter.put   ('/nutrition/bmi-categories/:id',  authenticate, authorize('admin'), updateBmiCategory);
adminRouter.delete('/nutrition/bmi-categories/:id',  authenticate, authorize('admin'), deleteBmiCategory);

// Activity multipliers (PAL values for TDEE)
adminRouter.get('/nutrition/activity-multipliers',       authenticate, authorize('admin'), getActivityMultipliers);
adminRouter.put('/nutrition/activity-multipliers/:id',   authenticate, authorize('admin'), updateActivityMultiplier);

// Goal settings (calorie offsets + protein targets per goal)
adminRouter.get('/nutrition/goal-settings',      authenticate, authorize('admin'), getGoalSettings);
adminRouter.put('/nutrition/goal-settings/:id',  authenticate, authorize('admin'), updateGoalSetting);

// Calorie floors (minimum safe calories by gender)
adminRouter.get('/nutrition/calorie-floors',     authenticate, authorize('admin'), getCalorieFloors);
adminRouter.put('/nutrition/calorie-floors/:id', authenticate, authorize('admin'), updateCalorieFloor);

// Medical condition adjustments (macro overrides + AI prompt notes)
adminRouter.get   ('/nutrition/medical-adjustments',      authenticate, authorize('admin'), getMedicalAdjustments);
adminRouter.post  ('/nutrition/medical-adjustments',      authenticate, authorize('admin'), createMedicalAdjustment);
adminRouter.put   ('/nutrition/medical-adjustments/:id',  authenticate, authorize('admin'), updateMedicalAdjustment);
adminRouter.delete('/nutrition/medical-adjustments/:id',  authenticate, authorize('admin'), deleteMedicalAdjustment);

// General settings (scalar values like carb floor, IBW thresholds, elderly age)
adminRouter.get('/nutrition/general-settings',     authenticate, authorize('admin'), getGeneralSettings);
adminRouter.put('/nutrition/general-settings/:id', authenticate, authorize('admin'), updateGeneralSetting);

// ── Admin diet plan review & delivery ────────────────────────────────────────
// Static routes before /:plan_id to avoid Express matching "manual" as an ID
adminRouter.get ('/diet-plans/manual',           authenticate, authorize('admin'), listManualDietPlansForAdmin);
adminRouter.get ('/diet-plans/manual/:plan_id',  authenticate, authorize('admin'), getManualDietPlanForAdmin);
adminRouter.get ('/diet-plans',                  authenticate, authorize('admin'), listDietPlansForAdmin);
adminRouter.get ('/diet-plans/:plan_id',         authenticate, authorize('admin'), getDietPlanForAdmin);
adminRouter.put ('/diet-plans/:plan_id',         authenticate, authorize('admin'), editDietPlan);
adminRouter.post('/diet-plans/:plan_id/send',    authenticate, authorize('admin'), sendDietPlanToUser);
adminRouter.post('/diet-plans/:plan_id/retry',   authenticate, authorize('admin'), retryDietPlanGeneration);

// ── Appointment management ────────────────────────────────────────────────────
// Static routes must be before /:id to avoid conflict
adminRouter.get ('/appointments/online',                   authenticate, authorize('admin'), adminGetOnlineAppointments);
adminRouter.get ('/appointments/offline',                  authenticate, authorize('admin'), adminGetOfflineAppointments);
adminRouter.get ('/appointments/pending-approval',         authenticate, authorize('admin'), adminGetPendingApprovalsList);
adminRouter.get ('/appointments/payment-history',          authenticate, authorize('admin'), adminGetPaymentHistoryList);
adminRouter.get ('/appointments/no-show-queue',            authenticate, authorize('admin'), adminGetNoShowQueueHandler);
adminRouter.get ('/appointments/pending-no-show-approval', authenticate, authorize('admin'), adminGetPendingNoShowApprovalsHandler);
adminRouter.get ('/appointments',                          authenticate, authorize('admin'), adminGetAppointments);
adminRouter.get ('/appointments/:id',                      authenticate, authorize('admin'), adminGetAppointmentById);
adminRouter.post('/appointments/:id/approve-payment',      authenticate, authorize('admin'), adminApprovePayment);
adminRouter.post('/appointments/:id/mark-no-show',         authenticate, authorize('admin'), adminMarkNoShow);
adminRouter.post('/appointments/:id/approve-no-show',      authenticate, authorize('admin'), adminApproveNoShow);

// ── Coupon management ─────────────────────────────────────────────────────────
adminRouter.post  ('/coupons',           authenticate, authorize('admin'), adminCreateCoupon);
adminRouter.get   ('/coupons',           authenticate, authorize('admin'), adminListCoupons);
adminRouter.get   ('/coupons/:id',       authenticate, authorize('admin'), adminGetCoupon);
adminRouter.patch ('/coupons/:id',       authenticate, authorize('admin'), adminUpdateCoupon);
adminRouter.delete('/coupons/:id',       authenticate, authorize('admin'), adminDeactivateCoupon);
adminRouter.get   ('/coupons/:id/usages',authenticate, authorize('admin'), adminGetCouponUsages);
adminRouter.get   ('/coupon-usages',     authenticate, authorize('admin'), adminGetAllCouponUsages);

// ── Medicines management ──────────────────────────────────────────────────────
adminRouter.get   ('/medicines',     authenticate, authorize('admin'), listMedicines);
adminRouter.post  ('/medicines',     authenticate, authorize('admin'), createMedicine);
adminRouter.put   ('/medicines/:id', authenticate, authorize('admin'), updateMedicine);
adminRouter.delete('/medicines/:id', authenticate, authorize('admin'), deleteMedicine);

// ── Medical Conditions management ────────────────────────────────────────────
adminRouter.get   ('/medical-conditions',     authenticate, authorize('admin'), listMedicalConditions);
adminRouter.post  ('/medical-conditions',     authenticate, authorize('admin'), createMedicalCondition);
adminRouter.put   ('/medical-conditions/:id', authenticate, authorize('admin'), updateMedicalCondition);
adminRouter.delete('/medical-conditions/:id', authenticate, authorize('admin'), deleteMedicalCondition);

// ── Food Allergies management ─────────────────────────────────────────────────
adminRouter.get   ('/food-allergies',     authenticate, authorize('admin'), listFoodAllergies);
adminRouter.post  ('/food-allergies',     authenticate, authorize('admin'), createFoodAllergy);
adminRouter.put   ('/food-allergies/:id', authenticate, authorize('admin'), updateFoodAllergy);
adminRouter.delete('/food-allergies/:id', authenticate, authorize('admin'), deleteFoodAllergy);

// ── Cuisine Preferences management ───────────────────────────────────────────
adminRouter.get   ('/cuisine-preferences',     authenticate, authorize('admin'), listCuisinePreferences);
adminRouter.post  ('/cuisine-preferences',     authenticate, authorize('admin'), createCuisinePreference);
adminRouter.put   ('/cuisine-preferences/:id', authenticate, authorize('admin'), updateCuisinePreference);
adminRouter.delete('/cuisine-preferences/:id', authenticate, authorize('admin'), deleteCuisinePreference);

// ── Health Goals management ───────────────────────────────────────────────────
adminRouter.get   ('/health-goals',     authenticate, authorize('admin'), listHealthGoals);
adminRouter.post  ('/health-goals',     authenticate, authorize('admin'), createHealthGoal);
adminRouter.put   ('/health-goals/:id', authenticate, authorize('admin'), updateHealthGoal);
adminRouter.delete('/health-goals/:id', authenticate, authorize('admin'), deleteHealthGoal);

// ── Broadcast / bulk email ────────────────────────────────────────────────────
adminRouter.get ('/broadcast/recipients',    authenticate, authorize('admin'), getBroadcastRecipients);
adminRouter.post('/broadcast/send',          authenticate, authorize('admin'), sendBroadcastEmail);
adminRouter.get ('/broadcast/history',       authenticate, authorize('admin'), getBroadcastHistory);
adminRouter.get ('/broadcast/history/:id',   authenticate, authorize('admin'), getBroadcastDetail);

// ── Career / Job Postings ─────────────────────────────────────────────────────
adminRouter.get   ('/career/jobs',                        authenticate, authorize('admin'), adminListJobs);
adminRouter.post  ('/career/jobs',                        authenticate, authorize('admin'), adminCreateJob);
adminRouter.get   ('/career/jobs/:id',                    authenticate, authorize('admin'), adminGetJob);
adminRouter.put   ('/career/jobs/:id',                    authenticate, authorize('admin'), adminUpdateJob);
adminRouter.delete('/career/jobs/:id',                    authenticate, authorize('admin'), adminDeleteJob);
adminRouter.patch ('/career/jobs/:id/toggle',             authenticate, authorize('admin'), adminToggleJob);
adminRouter.get   ('/career/applications',                authenticate, authorize('admin'), adminListApplications);
adminRouter.get   ('/career/applications/:id',            authenticate, authorize('admin'), adminGetApplication);
adminRouter.patch ('/career/applications/:id/status',     authenticate, authorize('admin'), adminUpdateApplicationStatus);

// ── Course management ─────────────────────────────────────────────────────────
adminRouter.get  ('/course/stats',                    authenticate, authorize('admin'), adminCourseStats);
adminRouter.get  ('/course/enquiries',                authenticate, authorize('admin'), adminListEnquiries);
adminRouter.get  ('/course/enquiries/:id',            authenticate, authorize('admin'), adminGetEnquiry);
adminRouter.patch('/course/enquiries/:id/status',     authenticate, authorize('admin'), adminUpdateEnquiryStatus);
adminRouter.get  ('/course/enrollments',              authenticate, authorize('admin'), adminListEnrollments);
adminRouter.get  ('/course/enrollments/:id',          authenticate, authorize('admin'), adminGetEnrollment);
