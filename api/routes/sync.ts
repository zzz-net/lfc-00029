import { Router } from 'express';
import { dataStore } from '../store/dataStore';
import { generateId } from '../../src/utils/id';
import { diffRecords } from '../../src/utils/anomaly';
import type { InspectionRecord, ConflictRecord, OperationLog } from '../../src/types';

const router = Router();

router.post('/batch', (req, res) => {
  const { records, userId, userName } = req.body as {
    records: InspectionRecord[];
    userId?: string;
    userName?: string;
  };

  if (!Array.isArray(records)) {
    return res.status(400).json({ error: '记录列表格式错误' });
  }

  const results: {
    recordId: string;
    status: 'success' | 'conflict' | 'error';
    conflictId?: string;
    error?: string;
  }[] = [];

  const conflicts: ConflictRecord[] = [];

  for (const record of records) {
    try {
      const existing = dataStore.findInspectionByDeviceAndDate(record.deviceId, record.date);

      if (existing && existing.id !== record.id) {
        const diffFields = diffRecords(record, existing);
        if (diffFields.length > 0) {
          const conflict: ConflictRecord = {
            id: generateId('cfl'),
            deviceId: record.deviceId,
            date: record.date,
            localVersion: record,
            remoteVersion: existing,
            resolved: false,
            diffFields,
          };
          dataStore.addConflict(conflict);
          conflicts.push(conflict);

          results.push({
            recordId: record.id,
            status: 'conflict',
            conflictId: conflict.id,
          });

          const log: OperationLog = {
            id: generateId('log'),
            timestamp: new Date().toISOString(),
            userId: userId || 'unknown',
            userName: userName || '未知用户',
            action: '同步冲突',
            target: record.deviceId,
            detail: `${record.date} 设备巡检记录存在冲突，共 ${diffFields.length} 个字段不同`,
            result: 'conflict',
          };
          dataStore.addLog(log);
          continue;
        }
      }

      if (existing) {
        const updated: InspectionRecord = {
          ...record,
          id: existing.id,
          status: 'synced',
          syncedAt: new Date().toISOString(),
        };
        dataStore.updateInspection(updated);
      } else {
        const newRec: InspectionRecord = {
          ...record,
          status: 'synced',
          syncedAt: new Date().toISOString(),
        };
        dataStore.addInspection(newRec);
      }

      results.push({
        recordId: record.id,
        status: 'success',
      });
    } catch (e) {
      results.push({
        recordId: record.id,
        status: 'error',
        error: (e as Error).message,
      });
    }
  }

  res.json({
    results,
    conflicts,
  });
});

router.get('/conflicts', (_req, res) => {
  const unresolved = dataStore.conflicts.filter((c) => !c.resolved);
  res.json(unresolved);
});

router.post('/resolve/:conflictId', (req, res) => {
  const { resolution, userId, userName } = req.body as {
    resolution: 'keep-local' | 'keep-remote' | 'merge';
    userId?: string;
    userName?: string;
  };

  const conflict = dataStore.conflicts.find((c) => c.id === req.params.conflictId);
  if (!conflict) {
    return res.status(404).json({ error: '冲突记录不存在' });
  }

  let finalRecord: InspectionRecord;

  switch (resolution) {
    case 'keep-local':
      finalRecord = {
        ...conflict.localVersion,
        status: 'synced',
        syncedAt: new Date().toISOString(),
      };
      break;
    case 'keep-remote':
      finalRecord = {
        ...conflict.remoteVersion,
        status: 'synced',
        syncedAt: new Date().toISOString(),
      };
      break;
    case 'merge': {
      const mergedValues = {
        ...conflict.remoteVersion.values,
        ...conflict.localVersion.values,
      };
      const mergedPhotos = [...conflict.remoteVersion.photos, ...conflict.localVersion.photos];
      finalRecord = {
        ...conflict.localVersion,
        values: mergedValues,
        photos: mergedPhotos,
        status: 'synced',
        syncedAt: new Date().toISOString(),
      };
      break;
    }
    default:
      return res.status(400).json({ error: '无效的解决方式' });
  }

  const existing = dataStore.findInspectionByDeviceAndDate(conflict.deviceId, conflict.date);
  if (existing) {
    finalRecord.id = existing.id;
    dataStore.updateInspection(finalRecord);
  } else {
    dataStore.addInspection(finalRecord);
  }

  const updatedConflict: ConflictRecord = {
    ...conflict,
    resolved: true,
    resolution,
    resolvedAt: new Date().toISOString(),
  };
  dataStore.updateConflict(updatedConflict);

  const log: OperationLog = {
    id: generateId('log'),
    timestamp: new Date().toISOString(),
    userId: userId || 'unknown',
    userName: userName || '未知用户',
    action: '解决冲突',
    target: conflict.deviceId,
    detail: `解决了 ${conflict.date} 的冲突，方式：${resolution}`,
    result: 'success',
  };
  dataStore.addLog(log);

  res.json({
    conflict: updatedConflict,
    record: finalRecord,
  });
});

export default router;
