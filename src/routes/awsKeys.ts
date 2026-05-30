import { Router } from 'express';
import { awsKeys } from '../controllers/awsKeys';

export const awsKeysRouter = Router();

awsKeysRouter.get('/', awsKeys);
awsKeysRouter.post('/', awsKeys);
