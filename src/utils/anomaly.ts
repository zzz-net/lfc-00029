import type { AnomalyLevel, TemplateField, InspectionRecord } from '@/types';

export function getAnomalyLevelColor(level: AnomalyLevel): string {
  switch (level) {
    case 'none':
      return 'bg-success-100 text-success-700';
    case 'low':
      return 'bg-warning-100 text-warning-600';
    case 'medium':
      return 'bg-accent-100 text-accent-600';
    case 'high':
      return 'bg-danger-100 text-danger-600';
    case 'critical':
      return 'bg-critical-500 text-white';
    default:
      return 'bg-surface-100 text-surface-300';
  }
}

export function getAnomalyLevelLabel(level: AnomalyLevel): string {
  switch (level) {
    case 'none':
      return '正常';
    case 'low':
      return '低';
    case 'medium':
      return '中';
    case 'high':
      return '高';
    case 'critical':
      return '严重';
    default:
      return '-';
  }
}

export function calculateAnomalyLevel(
  values: Record<string, any>,
  fields: TemplateField[]
): AnomalyLevel {
  let maxLevel: AnomalyLevel = 'none';
  const levelOrder: AnomalyLevel[] = ['none', 'low', 'medium', 'high', 'critical'];

  for (const field of fields) {
    if (!field.anomalyLevel) continue;
    const value = values[field.key];
    if (value === undefined || value === null || value === '') continue;

    if (field.type === 'select' && field.options) {
      const normalIndex = field.options.findIndex((o) => o === '正常' || o === '无');
      if (normalIndex >= 0 && value !== field.options[normalIndex]) {
        const currentIdx = levelOrder.indexOf(field.anomalyLevel);
        const maxIdx = levelOrder.indexOf(maxLevel);
        if (currentIdx > maxIdx) {
          maxLevel = field.anomalyLevel;
        }
      }
    } else if (field.type === 'number') {
      if (value !== 0 && value !== '') {
        const currentIdx = levelOrder.indexOf(field.anomalyLevel);
        const maxIdx = levelOrder.indexOf(maxLevel);
        if (currentIdx > maxIdx) {
          maxLevel = field.anomalyLevel;
        }
      }
    }
  }

  return maxLevel;
}

export function diffRecords(
  local: InspectionRecord,
  remote: InspectionRecord
): string[] {
  const diffs: string[] = [];
  const allKeys = new Set([...Object.keys(local.values), ...Object.keys(remote.values)]);

  for (const key of allKeys) {
    if (JSON.stringify(local.values[key]) !== JSON.stringify(remote.values[key])) {
      diffs.push(key);
    }
  }

  if (local.photos.length !== remote.photos.length) {
    diffs.push('photos');
  }

  if (local.anomalyLevel !== remote.anomalyLevel) {
    diffs.push('anomalyLevel');
  }

  return diffs;
}
