import { Router } from 'express';
import { dataStore } from '../store/dataStore';
import { generateId } from '../../src/utils/id';
import type { Device } from '../../src/types';

const router = Router();

router.get('/', (_req, res) => {
  res.json(dataStore.devices);
});

router.get('/:id', (req, res) => {
  const dev = dataStore.devices.find((d) => d.id === req.params.id);
  if (!dev) {
    return res.status(404).json({ error: '设备不存在' });
  }
  res.json(dev);
});

router.post('/', (req, res) => {
  const { code, name, location, category, status } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: '设备编号和名称为必填' });
  }

  const newDevice: Device = {
    id: generateId('dev'),
    code,
    name,
    location: location || '',
    category: category || '',
    status: status || 'normal',
  };

  dataStore.addDevice(newDevice);
  res.status(201).json(newDevice);
});

router.put('/:id', (req, res) => {
  const existing = dataStore.devices.find((d) => d.id === req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '设备不存在' });
  }

  const updated: Device = {
    ...existing,
    ...req.body,
    id: existing.id,
  };

  dataStore.updateDevice(updated);
  res.json(updated);
});

router.post('/seed', (_req, res) => {
  const result = dataStore.seedDevices();
  res.json({ seeded: result, devices: dataStore.devices });
});

export default router;
