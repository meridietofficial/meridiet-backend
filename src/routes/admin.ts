import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authenticate';
import { adminLogin, refreshAdminToken, getAdminProfile, changeAdminPassword, getDietitianList, getDietitianRequests, getDietitianDetails, toggleBlockDietitian, deleteDietitian, verifyDietitianHandler, getUserList, getUserDetails, toggleBlockUser, deleteUser, getDietFormRequests, getDietChartDetails, previewDietPlan, getDashboardStats, getDashboardRevenue, getDashboardUserGrowth, getDashboardConsultations, getSystemOverview, getPaidDietCharts } from '../controllers/admin';
import { listDietPlansForAdmin, getDietPlanForAdmin, editDietPlan, sendDietPlanToUser } from '../controllers/adminDietPlan';
import { adminCreateCoupon, adminListCoupons, adminGetCoupon, adminUpdateCoupon, adminDeactivateCoupon, adminGetCouponUsages } from '../controllers/coupon';
import { adminGetAppointments, adminGetAppointmentById } from '../controllers/adminAppointment';
import {
  getBmiCategories, createBmiCategory, updateBmiCategory, deleteBmiCategory,
  getActivityMultipliers, updateActivityMultiplier,
  getGoalSettings, updateGoalSetting,
  getCalorieFloors, updateCalorieFloor,
  getMedicalAdjustments, createMedicalAdjustment, updateMedicalAdjustment, deleteMedicalAdjustment,
  getGeneralSettings, updateGeneralSetting,
} from '../controllers/nutritionConfig';

export const adminRouter = Router();

// POST /api/v1/admin/login
adminRouter.post('/login', adminLogin);

// POST /api/v1/admin/refresh-token
adminRouter.post('/refresh-token', refreshAdminToken);

// Profile & password — admin only
adminRouter.get('/profile', authenticate, authorize('admin'), getAdminProfile);
adminRouter.patch('/change-password', authenticate, authorize('admin'), changeAdminPassword);

// Dietitian management — admin only
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
// Dietitian reviews AI-generated plans, edits if needed, then sends to user
adminRouter.get ('/diet-plans',              authenticate, authorize('admin'), listDietPlansForAdmin);
adminRouter.get ('/diet-plans/:plan_id',     authenticate, authorize('admin'), getDietPlanForAdmin);
adminRouter.put ('/diet-plans/:plan_id',     authenticate, authorize('admin'), editDietPlan);
adminRouter.post('/diet-plans/:plan_id/send', authenticate, authorize('admin'), sendDietPlanToUser);

// ── Appointment management ────────────────────────────────────────────────────
adminRouter.get('/appointments',     authenticate, authorize('admin'), adminGetAppointments);
adminRouter.get('/appointments/:id', authenticate, authorize('admin'), adminGetAppointmentById);

// ── Coupon management ─────────────────────────────────────────────────────────
adminRouter.post  ('/coupons',           authenticate, authorize('admin'), adminCreateCoupon);
adminRouter.get   ('/coupons',           authenticate, authorize('admin'), adminListCoupons);
adminRouter.get   ('/coupons/:id',       authenticate, authorize('admin'), adminGetCoupon);
adminRouter.patch ('/coupons/:id',       authenticate, authorize('admin'), adminUpdateCoupon);
adminRouter.delete('/coupons/:id',       authenticate, authorize('admin'), adminDeactivateCoupon);
adminRouter.get   ('/coupons/:id/usages',authenticate, authorize('admin'), adminGetCouponUsages);
