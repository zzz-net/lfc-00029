import { Router } from 'express';
import { dataStore } from '../store/dataStore';

const router = Router();

router.get('/', (req, res) => {
  const { format = 'json', date, deviceId } = req.query;

  let records = [...dataStore.inspections];

  if (date) {
    records = records.filter((r) => r.date === date);
  }
  if (deviceId) {
    records = records.filter((r) => r.deviceId === deviceId);
  }

  const devices = dataStore.devices;
  const templates = dataStore.templates;

  const enrichedRecords = records.map((r) => {
    const device = devices.find((d) => d.id === r.deviceId);
    const template = templates.find((t) => t.id === r.templateId);
    return {
      ...r,
      deviceCode: device?.code || '',
      deviceName: device?.name || '',
      templateName: template?.name || '',
    };
  });

  if (format === 'csv') {
    const headers = [
      '日期',
      '设备编号',
      '设备名称',
      '巡检员',
      '模板名称',
      '模板版本',
      '异常等级',
      '状态',
      '创建时间',
      '同步时间',
      '巡检数据',
    ];

    const rows = enrichedRecords.map((r) => [
      r.date,
      r.deviceCode,
      r.deviceName,
      r.inspectorName,
      r.templateName,
      r.templateVersion,
      r.anomalyLevel,
      r.status,
      r.createdAt,
      r.syncedAt || '',
      JSON.stringify(r.values),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inspections.csv"');
    res.send('\uFEFF' + csv);
    return;
  }

  res.json(enrichedRecords);
});

export default router;
