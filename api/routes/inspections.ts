import { Router } from 'express';
import { dataStore } from '../store/dataStore';
import { generateId } from '../../src/utils/id';
import type { InspectionRecord, OperationLog } from '../../src/types';

const router = Router();

router.get('/', (req, res) => {
  const { date, deviceId, status } = req.query;
  let records = [...dataStore.inspections];

  if (date) {
    records = records.filter((r) => r.date === date);
  }
  if (deviceId) {
    records = records.filter((r) => r.deviceId === deviceId);
  }
  if (status) {
    records = records.filter((r) => r.status === status);
  }

  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(records);
});

router.get('/:id', (req, res) => {
  const rec = dataStore.inspections.find((r) => r.id === req.params.id);
  if (!rec) {
    return res.status(404).json({ error: '巡检记录不存在' });
  }
  res.json(rec);
});

router.post('/', (req, res) => {
  const body = req.body as Partial<InspectionRecord>;
  if (!body.deviceId || !body.templateId || !body.date) {
    return res.status(400).json({ error: '设备、模板、日期为必填' });
  }

  const now = new Date().toISOString();
  const newRecord: InspectionRecord = {
    id: generateId('rec'),
    deviceId: body.deviceId,
    templateId: body.templateId,
    templateVersion: body.templateVersion || 1,
    inspectorId: body.inspectorId || 'unknown',
    inspectorName: body.inspectorName || '未知巡检员',
    date: body.date,
    values: body.values || {},
    photos: body.photos || [],
    anomalyLevel: body.anomalyLevel || 'none',
    status: 'synced',
    createdAt: now,
    updatedAt: now,
    syncedAt: now,
  };

  dataStore.addInspection(newRecord);

  const log: OperationLog = {
    id: generateId('log'),
    timestamp: now,
    userId: body.inspectorId || 'unknown',
    userName: body.inspectorName || '未知巡检员',
    action: '创建巡检记录',
    target: body.deviceId,
    detail: `创建了 ${body.date} 的巡检记录`,
    result: 'success',
  };
  dataStore.addLog(log);

  res.status(201).json(newRecord);
});

router.put('/:id', (req, res) => {
  const existing = dataStore.inspections.find((r) => r.id === req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '巡检记录不存在' });
  }

  const now = new Date().toISOString();
  const updated: InspectionRecord = {
    ...existing,
    ...req.body,
    id: existing.id,
    updatedAt: now,
  };

  dataStore.updateInspection(updated);
  res.json(updated);
});

export default router;
