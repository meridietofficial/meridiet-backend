import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authenticate';
import { adminLogin, getAdminProfile, changeAdminPassword, getDietitianList, getDietitianRequests, getDietitianDetails, toggleBlockDietitian, deleteDietitian, verifyDietitianHandler, getUserList, getUserDetails, toggleBlockUser, deleteUser, getDietFormRequests, getDietChartDetails, previewDietPlan } from '../controllers/admin';

export const adminRouter = Router();

// POST /api/v1/admin/login
adminRouter.post('/login', adminLogin);

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
adminRouter.get('/diet-form-requests/:form_id/details', authenticate, authorize('admin'), getDietChartDetails);
adminRouter.get('/diet-form-requests/:form_id/preview', authenticate, authorize('admin'), previewDietPlan);

// User management — admin only
adminRouter.get('/existing-users', authenticate, authorize('admin'), getUserList);
adminRouter.get('/user/:id', authenticate, authorize('admin'), getUserDetails);
adminRouter.patch('/toggle-block-user', authenticate, authorize('admin'), toggleBlockUser);
adminRouter.delete('/delete-user', authenticate, authorize('admin'), deleteUser);
