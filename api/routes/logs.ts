import { Router } from 'express';
import { dataStore } from '../store/dataStore';

const router = Router();

router.get('/', (_req, res) => {
  res.json(dataStore.logs);
});

export default router;
