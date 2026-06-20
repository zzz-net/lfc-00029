import type {
  InspectionRecord,
  Template,
  TemplateField,
  RecordStatus,
  StatusChangeAction,
  StatusChangeEvent,
  ValidationResult,
  ValidationErrorItem,
  ValidationWarningItem,
  DuplicateCheckResult,
  TimelineEvent,
  StaleDraftInfo,
  ImportResult,
  ImportErrorItem,
  ButtonActionState,
  SubmissionSnapshot,
  SubmissionReceipt,
  AuditLogEntry,
  RecordMeta,
  Device,
  CsvColumnMapping,
  RevertPreviewItem,
  RevertConflictInfo,
} from '@/types';
import { validateRecord, type ValidationError } from '@/utils/validation';
import { statusConfig, actionConfig, validationMessages, featureFlags, buttonDisableReasons, csvColumnMappings, revertModuleConfig } from '@/config/appConfig';

export const STATUS_TRANSITIONS: Record<RecordStatus, RecordStatus[]> = {
  draft: ['submitted', 'withdrawn'],
  resumed: ['submitted'],
  submitted: ['synced', 'conflict', 'withdrawn', 'draft'],
  conflict: ['synced', 'draft'],
  synced: [],
  withdrawn: ['submitted', 'draft'],
};

export function canTransition(from: RecordStatus, to: RecordStatus): boolean {
  const allowed = STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function canPerformAction(status: RecordStatus, action: StatusChangeAction): boolean {
  const cfg = statusConfig[status as keyof typeof statusConfig];
  if (!cfg) return false;
  const actionToKey: Partial<Record<StatusChangeAction, string>> = {
    save_draft: 'save_draft',
    submit: 'submit',
    withdraw: 'withdraw',
    sync_success: 'sync',
    resubmit: 'resubmit',
    resubmit_after_withdraw: 'resubmit_after_withdraw',
    resume: 'resume',
    conflict_resolved: 'resolve_conflict',
  };
  const key = actionToKey[action];
  return key ? cfg.nextActions.includes(key as any) : false;
}

export function validateRequiredFields(
  values: Record<string, any>,
  fields: TemplateField[]
): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];
  const rawErrors = validateRecord(values, fields);
  for (const e of rawErrors) {
    errors.push({
      type: 'required',
      fieldKey: e.fieldKey,
      message: e.message,
      blocking: true,
    });
  }
  return errors;
}

export function validateVersionMatch(
  recordVersion: number,
  template: Template | undefined
): ValidationErrorItem | null {
  if (!template) {
    return {
      type: 'version',
      message: '模板不存在，无法校验版本',
      blocking: true,
    };
  }
  if (recordVersion !== template.version) {
    return {
      type: 'version',
      message: validationMessages.versionMismatch + `（当前 v${recordVersion}，最新 v${template.version}）`,
      blocking: true,
    };
  }
  return null;
}

export function validateStatusGate(
  currentStatus: RecordStatus,
  targetAction: StatusChangeAction
): ValidationErrorItem | null {
  if (!canPerformAction(currentStatus, targetAction)) {
    return {
      type: 'status_gate',
      message: `${validationMessages.statusGateFailed}：${currentStatus} 状态不允许 ${actionConfig[targetAction as keyof typeof actionConfig]?.label || targetAction}`,
      blocking: true,
    };
  }
  return null;
}

export function checkDuplicateSubmission(
  deviceId: string,
  date: string,
  existingRecords: InspectionRecord[],
  excludeRecordId?: string
): DuplicateCheckResult {
  if (!featureFlags.enableDuplicateBlocking) {
    return { isDuplicate: false };
  }

  const sameDaySameDevice = existingRecords.filter(
    (r) =>
      r.deviceId === deviceId &&
      r.date === date &&
      r.id !== excludeRecordId &&
      (r.status === 'submitted' || r.status === 'synced')
  );

  if (sameDaySameDevice.length > 0) {
    const latest = sameDaySameDevice.sort(
      (a, b) => (b.submittedAt || b.createdAt).localeCompare(a.submittedAt || a.createdAt)
    )[0];
    return {
      isDuplicate: true,
      existingRecordId: latest.id,
      existingStatus: latest.status,
      existingSubmittedAt: latest.submittedAt || latest.createdAt,
      reason: 'same_day_same_device',
    };
  }

  return { isDuplicate: false };
}

export function computeValuesHash(values: Record<string, any>): string {
  try {
    const normalized = JSON.stringify(values, Object.keys(values).sort());
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  } catch {
    return 'hash_error';
  }
}

export function buildFullValidation(
  ctx: {
    values: Record<string, any>;
    templateFields: TemplateField[];
    recordVersion: number;
    currentTemplate?: Template;
    currentStatus: RecordStatus;
    targetAction: StatusChangeAction;
    deviceId: string;
    date: string;
    existingRecords: InspectionRecord[];
    excludeRecordId?: string;
    hasConflict?: boolean;
  }
): ValidationResult {
  const errors: ValidationErrorItem[] = [];
  const warnings: ValidationWarningItem[] = [];

  const requiredErrors = validateRequiredFields(ctx.values, ctx.templateFields);
  errors.push(...requiredErrors);

  const versionErr = validateVersionMatch(ctx.recordVersion, ctx.currentTemplate);
  if (versionErr) errors.push(versionErr);

  const statusErr = validateStatusGate(ctx.currentStatus, ctx.targetAction);
  if (statusErr) errors.push(statusErr);

  if (ctx.hasConflict) {
    errors.push({
      type: 'conflict',
      message: validationMessages.conflictDetected,
      blocking: true,
    });
  }

  if (ctx.targetAction === 'submit' || ctx.targetAction === 'resubmit' || ctx.targetAction === 'resubmit_after_withdraw') {
    const dup = checkDuplicateSubmission(ctx.deviceId, ctx.date, ctx.existingRecords, ctx.excludeRecordId);
    if (dup.isDuplicate) {
      errors.push({
        type: 'duplicate',
        message: validationMessages.duplicateSubmit,
        blocking: true,
      });
    }
  }

  const blockingErrors = errors.filter((e) => e.blocking);
  return {
    valid: blockingErrors.length === 0,
    errors,
    warnings,
  };
}

export function buildTimelineEvents(
  statusHistory: Array<{
    id: string;
    recordId: string;
    timestamp: string;
    action: StatusChangeAction | string;
    operatorName: string;
    fromStatus: RecordStatus | null;
    toStatus: RecordStatus | null;
    note?: string;
    deviceId?: string;
  }>
): TimelineEvent[] {
  const actionLabels: Partial<Record<StatusChangeAction, string>> = {
    create_draft: '创建草稿',
    save_draft: '保存草稿',
    submit: '提交上报',
    withdraw: '撤销回滚',
    resubmit: '重新提交',
    resubmit_after_withdraw: '撤回后重新发起',
    sync_success: '同步成功',
    sync_fail: '同步失败',
    conflict_detected: '检测到冲突',
    conflict_resolved: '冲突已解决',
    edit_after_sync: '同步后编辑',
    resume: '恢复续办',
    withdraw_audit_logged: '撤回审计已记录',
  };

  return statusHistory
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map((evt) => ({
      id: evt.id,
      recordId: evt.recordId,
      timestamp: evt.timestamp,
      action: evt.action,
      actionLabel: actionLabels[evt.action as StatusChangeAction] || String(evt.action),
      operatorName: evt.operatorName,
      fromStatus: evt.fromStatus,
      toStatus: evt.toStatus,
      note: evt.note,
      sourceDeviceId: evt.deviceId,
    }));
}

export function getMissingRequiredFields(
  values: Record<string, any>,
  fields: TemplateField[]
): string[] {
  const missing: string[] = [];
  for (const field of fields) {
    if (!field.required) continue;
    const v = values[field.key];
    if (v === undefined || v === null || v === '') {
      missing.push(field.label);
    }
  }
  return missing;
}

export function generateReceiptNo(recordId: string, submittedAt: string): string {
  const ts = new Date(submittedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}`;
  const hms = `${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  const shortId = recordId.slice(-6).toUpperCase();
  return `RCP-${ymd}-${hms}-${shortId}`;
}

export function getDeviceFingerprint(): string {
  if (typeof navigator === 'undefined') return 'server-env';
  const parts = [
    navigator.userAgent || 'ua',
    navigator.language || 'lang',
    navigator.platform || 'plat',
    String(screen?.width || 0) + 'x' + String(screen?.height || 0),
  ];
  let hash = 0;
  const combined = parts.join('|');
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash |= 0;
  }
  return 'dev_' + Math.abs(hash).toString(36);
}

export function detectStaleDrafts(
  records: InspectionRecord[],
  templates: Template[]
): StaleDraftInfo[] {
  const result: StaleDraftInfo[] = [];
  for (const record of records) {
    if (record.status !== 'draft' && record.status !== 'resumed' && record.status !== 'withdrawn') continue;
    const template = templates.find(t => t.id === record.templateId);
    if (!template) continue;
    if (record.templateVersion < template.version) {
      result.push({
        recordId: record.id,
        recordTemplateVersion: record.templateVersion,
        latestTemplateVersion: template.version,
        templateId: template.id,
        templateName: template.name,
      });
    }
  }
  return result;
}

export function validateImportData(
  data: any[],
  existingRecords: InspectionRecord[],
  options?: { skipDuplicateId?: boolean }
): { valid: InspectionRecord[]; skipped: InspectionRecord[]; errors: ImportErrorItem[]; warnings: string[] } {
  const valid: InspectionRecord[] = [];
  const skipped: InspectionRecord[] = [];
  const errors: ImportErrorItem[] = [];
  const warnings: string[] = [];
  const existingIds = new Set(existingRecords.map(r => r.id));
  const seenIds = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1;

    if (!row || typeof row !== 'object') {
      errors.push({ row: rowNum, reason: '数据格式不正确' });
      continue;
    }

    if (!row.id || typeof row.id !== 'string') {
      errors.push({ row: rowNum, id: row.id, reason: '缺少记录ID或格式错误' });
      continue;
    }

    if (seenIds.has(row.id)) {
      errors.push({ row: rowNum, id: row.id, reason: '文件内存在重复记录ID' });
      continue;
    }
    seenIds.add(row.id);

    if (!row.deviceId || !row.templateId || !row.date) {
      errors.push({ row: rowNum, id: row.id, reason: '缺少必要字段（deviceId/templateId/date）' });
      continue;
    }

    if (existingIds.has(row.id) && !options?.skipDuplicateId) {
      skipped.push(row as InspectionRecord);
      continue;
    }

    const status: RecordStatus = row.status || 'draft';
    const validStatuses: RecordStatus[] = ['draft', 'submitted', 'synced', 'conflict', 'withdrawn', 'resumed'];
    if (!validStatuses.includes(status)) {
      errors.push({ row: rowNum, id: row.id, reason: `无效的状态值: ${status}` });
      continue;
    }

    const record: InspectionRecord = {
      id: row.id,
      deviceId: row.deviceId,
      templateId: row.templateId,
      templateVersion: Number(row.templateVersion) || 1,
      inspectorId: row.inspectorId || 'imported',
      inspectorName: row.inspectorName || '导入',
      date: row.date,
      values: typeof row.values === 'string' ? safeJsonParse(row.values, {}) : row.values || {},
      photos: typeof row.photos === 'string' ? safeJsonParse(row.photos, []) : row.photos || [],
      anomalyLevel: row.anomalyLevel || 'none',
      status,
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || new Date().toISOString(),
      syncedAt: row.syncedAt || undefined,
      conflictId: row.conflictId || undefined,
      submittedAt: row.submittedAt || undefined,
      firstSubmittedAt: row.firstSubmittedAt || undefined,
      submissionCount: Number(row.submissionCount) || 0,
      withdrawCount: Number(row.withdrawCount) || 0,
      lastWithdrawnAt: row.lastWithdrawnAt || undefined,
      originDeviceId: row.originDeviceId || 'imported',
    };

    if (record.templateVersion < 1) {
      warnings.push(`行 ${rowNum} (${row.id}): 模板版本号异常，已重置为 1`);
      record.templateVersion = 1;
    }

    valid.push(record);
  }

  return { valid, skipped, errors, warnings };
}

function safeJsonParse(str: string, fallback: any): any {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export interface FullExportRecord {
  record: InspectionRecord;
  statusHistory: StatusChangeEvent[];
  snapshots: SubmissionSnapshot[];
  receipts: SubmissionReceipt[];
  auditLogs: AuditLogEntry[];
  meta: RecordMeta;
}

export function buildFullExportData(
  records: InspectionRecord[],
  allHistory: StatusChangeEvent[],
  allSnapshots: SubmissionSnapshot[],
  allReceipts: SubmissionReceipt[],
  allAuditLogs: AuditLogEntry[],
  allMeta: RecordMeta[]
): FullExportRecord[] {
  return records.map(record => ({
    record,
    statusHistory: allHistory.filter(h => h.recordId === record.id),
    snapshots: allSnapshots.filter(s => s.recordId === record.id),
    receipts: allReceipts.filter(r => r.recordId === record.id),
    auditLogs: allAuditLogs.filter(a => a.recordId === record.id),
    meta: allMeta.find(m => m.recordId === record.id) || {
      recordId: record.id,
      submissionCount: record.submissionCount || 0,
      withdrawCount: record.withdrawCount || 0,
      hasConflict: record.status === 'conflict',
      exportCount: 0,
    },
  }));
}

export function flattenForCsv(
  fullData: FullExportRecord[],
  devices: Device[],
  templates: Template[]
): any[] {
  return fullData.map(item => {
    const device = devices.find(d => d.id === item.record.deviceId);
    const template = templates.find(t => t.id === item.record.templateId);
    const latestReceipt = item.receipts[0];
    return {
      id: item.record.id,
      deviceId: item.record.deviceId,
      deviceCode: device?.code || '',
      deviceName: device?.name || '',
      deviceLocation: device?.location || '',
      deviceCategory: device?.category || '',
      templateId: item.record.templateId,
      templateName: template?.name || '',
      templateVersion: item.record.templateVersion,
      inspectorId: item.record.inspectorId,
      inspectorName: item.record.inspectorName,
      date: item.record.date,
      status: item.record.status,
      anomalyLevel: item.record.anomalyLevel,
      submissionCount: item.record.submissionCount || 0,
      withdrawCount: item.record.withdrawCount || 0,
      photoCount: item.record.photos.length,
      values: JSON.stringify(item.record.values),
      photos: JSON.stringify(item.record.photos),
      createdAt: item.record.createdAt,
      updatedAt: item.record.updatedAt,
      submittedAt: item.record.submittedAt || '',
      firstSubmittedAt: item.record.firstSubmittedAt || '',
      lastWithdrawnAt: item.record.lastWithdrawnAt || '',
      syncedAt: item.record.syncedAt || '',
      originDeviceId: item.record.originDeviceId || '',
      hasConflict: item.meta.hasConflict,
      conflictResolution: item.meta.lastConflictResolution || '',
      receiptNo: latestReceipt?.receiptNo || '',
      sourceDevice: latestReceipt?.sourceDeviceInfo || '',
      exportCount: item.meta.exportCount,
      statusHistoryCount: item.statusHistory.length,
      snapshotCount: item.snapshots.length,
      auditLogCount: item.auditLogs.length,
    };
  });
}

export interface ImportConflictInfo {
  recordId: string;
  type: 'id_duplicate' | 'same_device_date' | 'values_hash_match';
  existingStatus?: RecordStatus;
  existingUpdatedAt?: string;
  detail: string;
}

export function checkImportConflicts(
  importRecords: InspectionRecord[],
  existingRecords: InspectionRecord[]
): ImportConflictInfo[] {
  const conflicts: ImportConflictInfo[] = [];
  const existingById = new Map(existingRecords.map(r => [r.id, r]));
  const existingByDeviceDate = new Map<string, InspectionRecord>();

  for (const r of existingRecords) {
    if (r.status === 'submitted' || r.status === 'synced') {
      const key = `${r.deviceId}_${r.date}`;
      if (!existingByDeviceDate.has(key)) {
        existingByDeviceDate.set(key, r);
      }
    }
  }

  for (const record of importRecords) {
    if (existingById.has(record.id)) {
      const existing = existingById.get(record.id)!;
      conflicts.push({
        recordId: record.id,
        type: 'id_duplicate',
        existingStatus: existing.status,
        existingUpdatedAt: existing.updatedAt,
        detail: `记录ID已存在，当前状态：${existing.status}`,
      });
      continue;
    }

    const key = `${record.deviceId}_${record.date}`;
    const sameDayDevice = existingByDeviceDate.get(key);
    if (sameDayDevice && (record.status === 'submitted' || record.status === 'synced')) {
      const importHash = computeValuesHash(record.values);
      const existingHash = computeValuesHash(sameDayDevice.values);
      if (importHash === existingHash) {
        conflicts.push({
          recordId: record.id,
          type: 'values_hash_match',
          existingStatus: sameDayDevice.status,
          existingUpdatedAt: sameDayDevice.updatedAt,
          detail: '同设备同日且数据内容完全相同',
        });
      } else {
        conflicts.push({
          recordId: record.id,
          type: 'same_device_date',
          existingStatus: sameDayDevice.status,
          existingUpdatedAt: sameDayDevice.updatedAt,
          detail: '同设备同日已有提交记录，但内容不同',
        });
      }
    }
  }

  return conflicts;
}

export interface FieldCompatibilityReport {
  recordId: string;
  missingFields: string[];
  extraFields: string[];
  typeMismatches: { field: string; expected: string; actual: string }[];
  compatible: boolean;
}

export function checkFieldCompatibility(
  importRecords: InspectionRecord[],
  templates: Template[]
): FieldCompatibilityReport[] {
  const reports: FieldCompatibilityReport[] = [];

  for (const record of importRecords) {
    const template = templates.find(t => t.id === record.templateId);
    if (!template) {
      reports.push({
        recordId: record.id,
        missingFields: [],
        extraFields: [],
        typeMismatches: [],
        compatible: false,
      });
      continue;
    }

    const templateKeys = new Set(template.fields.map(f => f.key));
    const valueKeys = Object.keys(record.values || {});

    const missingFields: string[] = [];
    const extraFields: string[] = [];
    const typeMismatches: { field: string; expected: string; actual: string }[] = [];

    for (const field of template.fields) {
      if (!(field.key in record.values) && field.required) {
        missingFields.push(field.key);
      }
    }

    for (const key of valueKeys) {
      if (!templateKeys.has(key)) {
        extraFields.push(key);
      }
    }

    const compatible = missingFields.length === 0;

    reports.push({
      recordId: record.id,
      missingFields,
      extraFields,
      typeMismatches,
      compatible,
    });
  }

  return reports;
}

export function applyFieldCompatibilityFix(
  record: InspectionRecord,
  template: Template
): InspectionRecord {
  const migratedValues: Record<string, any> = { ...record.values };

  for (const field of template.fields) {
    if (!(field.key in migratedValues)) {
      switch (field.type) {
        case 'text':
        case 'textarea':
        case 'select':
          migratedValues[field.key] = '';
          break;
        case 'number':
          migratedValues[field.key] = null;
          break;
        case 'photo':
          migratedValues[field.key] = '';
          break;
        default:
          migratedValues[field.key] = '';
      }
    }
  }

  return {
    ...record,
    values: migratedValues,
    templateVersion: template.version,
  };
}

export function parseCsvToRecords(csvText: string): any[] {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const records: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) continue;
    const obj: Record<string, any> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j];
    }
    try {
      if (obj.values) obj.values = JSON.parse(obj.values);
      if (obj.photos) obj.photos = JSON.parse(obj.photos);
      if (obj.templateVersion) obj.templateVersion = Number(obj.templateVersion);
      if (obj.submissionCount) obj.submissionCount = Number(obj.submissionCount);
      if (obj.withdrawCount) obj.withdrawCount = Number(obj.withdrawCount);
    } catch {
      // keep as-is
    }
    records.push(obj);
  }
  return records;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export function computeButtonActions(
  record: InspectionRecord,
  templates: Template[],
  existingRecords: InspectionRecord[],
  hasConflict: boolean
): ButtonActionState[] {
  const status = record.status;
  const template = templates.find(t => t.id === record.templateId);
  const isVersionMismatch = template ? record.templateVersion < template.version : false;
  const missingFields = template ? getMissingRequiredFields(record.values, template.fields) : [];
  const dupCheck = checkDuplicateSubmission(record.deviceId, record.date, existingRecords, record.id);
  const reasons = buttonDisableReasons;

  const actions: ButtonActionState[] = [];

  actions.push({
    key: 'edit',
    label: '编辑',
    disabled: status !== 'draft' && status !== 'resumed' && status !== 'withdrawn',
    reason: status !== 'draft' && status !== 'resumed' && status !== 'withdrawn' ? reasons.edit_wrong_status.message : '',
    variant: 'ghost',
  });

  actions.push({
    key: 'submit',
    label: actionConfig.submit.shortLabel,
    disabled: (() => {
      if (status !== 'draft' && status !== 'resumed' && status !== 'withdrawn') return true;
      if (isVersionMismatch) return true;
      if (missingFields.length > 0) return true;
      if (hasConflict) return true;
      if (dupCheck.isDuplicate && (status === 'draft' || status === 'resumed')) return true;
      return false;
    })(),
    reason: (() => {
      if (status !== 'draft' && status !== 'resumed' && status !== 'withdrawn') return reasons.edit_wrong_status.message;
      if (isVersionMismatch) return reasons.submit_version_mismatch.message;
      if (missingFields.length > 0) return reasons.submit_required_missing.message;
      if (hasConflict) return reasons.submit_conflict_exists.message;
      if (dupCheck.isDuplicate) return reasons.submit_duplicate.message;
      return '';
    })(),
    variant: 'primary',
  });

  actions.push({
    key: 'withdraw',
    label: actionConfig.withdraw.shortLabel,
    disabled: status !== 'submitted',
    reason: status !== 'submitted' ? reasons.withdraw_wrong_status.message : '',
    variant: 'warning',
  });

  actions.push({
    key: 'resubmit',
    label: actionConfig.resubmit_after_withdraw.shortLabel,
    disabled: (() => {
      if (status !== 'withdrawn') return true;
      if (isVersionMismatch) return true;
      return false;
    })(),
    reason: (() => {
      if (status !== 'withdrawn') return reasons.resubmit_wrong_status.message;
      if (isVersionMismatch) return reasons.submit_version_mismatch.message;
      return '';
    })(),
    variant: 'primary',
  });

  actions.push({
    key: 'resume',
    label: actionConfig.resume.shortLabel,
    disabled: status !== 'draft' && status !== 'withdrawn',
    reason: status !== 'draft' && status !== 'withdrawn' ? reasons.resume_wrong_status.message : '',
    variant: 'info',
  });

  return actions;
}

export function buildColumnNameMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const col of csvColumnMappings) {
    map.set(col.displayName, col.fieldName);
  }
  return map;
}

export function buildReverseColumnNameMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const col of csvColumnMappings) {
    map.set(col.fieldName, col.displayName);
  }
  return map;
}

export function getColumnMappings(): CsvColumnMapping[] {
  return csvColumnMappings.map(c => ({
    displayName: c.displayName,
    fieldName: c.fieldName,
    required: c.required,
    description: c.description,
  }));
}

export function normalizeCsvHeaders(headers: string[]): { normalized: string[]; unknown: string[] } {
  const nameMap = buildColumnNameMap();
  const normalized: string[] = [];
  const unknown: string[] = [];
  for (const h of headers) {
    const trimmed = h.trim();
    if (nameMap.has(trimmed)) {
      normalized.push(nameMap.get(trimmed)!);
    } else {
      normalized.push(trimmed);
      if (!trimmed) continue;
      let found = false;
      for (const col of csvColumnMappings) {
        if (col.fieldName === trimmed) {
          found = true;
          break;
        }
      }
      if (!found) unknown.push(trimmed);
    }
  }
  return { normalized, unknown };
}

export function parseRevertCsvToRecords(csvText: string): {
  records: any[];
  unknownColumns: string[];
  missingRequired: string[];
} {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    return { records: [], unknownColumns: [], missingRequired: ['记录ID', '设备ID', '巡检日期', '模板ID', '模板版本', '状态', '巡检内容'] };
  }
  const rawHeaders = parseCsvLine(lines[0]);
  const { normalized: headers, unknown } = normalizeCsvHeaders(rawHeaders);

  const requiredDisplayNames = csvColumnMappings.filter(c => c.required).map(c => c.displayName);
  const requiredFieldNames = csvColumnMappings.filter(c => c.required).map(c => c.fieldName);
  const missingRequired: string[] = [];
  for (let i = 0; i < requiredFieldNames.length; i++) {
    if (!headers.includes(requiredFieldNames[i])) {
      missingRequired.push(requiredDisplayNames[i]);
    }
  }

  const records: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) continue;
    const obj: Record<string, any> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j];
    }
    try {
      if (obj.values && typeof obj.values === 'string') {
        try { obj.values = JSON.parse(obj.values); } catch { /* keep string */ }
      }
      if (obj.photos && typeof obj.photos === 'string') {
        try { obj.photos = JSON.parse(obj.photos); } catch { /* keep string */ }
      }
      if (obj.templateVersion) obj.templateVersion = Number(obj.templateVersion);
      if (obj.submissionCount) obj.submissionCount = Number(obj.submissionCount);
      if (obj.withdrawCount) obj.withdrawCount = Number(obj.withdrawCount);
      if (obj.photoCount) obj.photoCount = Number(obj.photoCount);
    } catch {
      // keep as-is
    }
    records.push(obj);
  }

  return { records, unknownColumns: unknown, missingRequired };
}

export function buildCsvTemplate(): string {
  const headers = csvColumnMappings.map(c => c.displayName);
  const sample: string[] = csvColumnMappings.map(c => {
    switch (c.fieldName) {
      case 'id': return 'rec_示例ID';
      case 'deviceCode': return 'PUMP-001';
      case 'deviceId': return 'dev_示例设备ID';
      case 'deviceName': return '1号循环泵';
      case 'deviceLocation': return 'A区泵房';
      case 'deviceCategory': return '泵类';
      case 'date': return '2024-01-15';
      case 'templateId': return 'tpl_示例模板ID';
      case 'templateName': return '泵类日常巡检模板';
      case 'templateVersion': return '1';
      case 'inspectorId': return 'inspector_001';
      case 'inspectorName': return '张巡检';
      case 'status': return 'draft';
      case 'anomalyLevel': return 'none';
      case 'submissionCount': return '0';
      case 'withdrawCount': return '0';
      case 'photoCount': return '0';
      case 'values': return '{}';
      case 'photos': return '[]';
      case 'createdAt': return new Date().toISOString();
      case 'updatedAt': return new Date().toISOString();
      default: return '';
    }
  });
  const csv = [headers, sample]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  return '\uFEFF' + csv;
}

export function computeConfigFingerprint(
  templates: Template[],
  devices: Device[]
): string {
  const tplFingerprint = templates
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(t => `${t.id}:v${t.version}:${t.fields.length}`)
    .join('|');
  const devFingerprint = devices
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(d => `${d.id}:${d.code}`)
    .join('|');
  const combined = `${tplFingerprint}||${devFingerprint}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash |= 0;
  }
  return 'fp_' + Math.abs(hash).toString(36);
}

export function isRevertDraftStale(
  draftFingerprint: string,
  currentTemplates: Template[],
  currentDevices: Device[]
): boolean {
  if (!revertModuleConfig.enableConfigFingerprint) return false;
  const currentFp = computeConfigFingerprint(currentTemplates, currentDevices);
  return draftFingerprint !== currentFp;
}

export function isRevertDraftExpired(createdAt: string): boolean {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  return ageHours > revertModuleConfig.maxDraftAgeHours;
}

export function buildRevertPreviewItems(
  importRecords: InspectionRecord[],
  existingRecords: InspectionRecord[],
  devices: Device[]
): {
  items: RevertPreviewItem[];
  conflicts: RevertConflictInfo[];
  duplicates: RevertPreviewItem[];
} {
  const items: RevertPreviewItem[] = [];
  const conflicts: RevertConflictInfo[] = [];
  const duplicates: RevertPreviewItem[] = [];

  const existingById = new Map(existingRecords.map(r => [r.id, r]));
  const existingByDeviceDate = new Map<string, InspectionRecord>();
  for (const r of existingRecords) {
    if (r.status === 'submitted' || r.status === 'synced') {
      const key = `${r.deviceId}_${r.date}`;
      if (!existingByDeviceDate.has(key)) {
        existingByDeviceDate.set(key, r);
      }
    }
  }

  for (const record of importRecords) {
    const device = devices.find(d => d.id === record.deviceId);
    let action: RevertPreviewItem['action'] = 'insert';
    let detail = '';

    if (existingById.has(record.id)) {
      action = 'skip';
      detail = '记录ID已存在';
      const existing = existingById.get(record.id)!;
      conflicts.push({
        recordId: record.id,
        type: 'id_duplicate',
        existingRecord: existing,
        importRecord: record,
        detail: `记录ID已存在，当前状态：${existing.status}`,
        resolution: 'skip',
      });
    } else {
      const key = `${record.deviceId}_${record.date}`;
      const sameDayDevice = existingByDeviceDate.get(key);
      if (sameDayDevice && (record.status === 'submitted' || record.status === 'synced')) {
        const importHash = computeValuesHash(record.values);
        const existingHash = computeValuesHash(sameDayDevice.values);
        if (importHash === existingHash) {
          action = 'skip';
          detail = '同设备同日且内容完全相同';
          duplicates.push({
            recordId: record.id,
            deviceCode: device?.code || '',
            deviceName: device?.name || '',
            date: record.date,
            status: record.status,
            action: 'skip',
            detail,
          });
          conflicts.push({
            recordId: record.id,
            type: 'values_hash_match',
            existingRecord: sameDayDevice,
            importRecord: record,
            detail: '同设备同日且数据内容完全相同',
            resolution: 'skip',
          });
        } else {
          action = 'conflict';
          detail = '同设备同日但内容不同';
          conflicts.push({
            recordId: record.id,
            type: 'same_device_date',
            existingRecord: sameDayDevice,
            importRecord: record,
            detail: '同设备同日已有提交记录，但内容不同',
            resolution: 'skip',
          });
        }
      }
    }

    items.push({
      recordId: record.id,
      deviceCode: device?.code || '',
      deviceName: device?.name || '',
      date: record.date,
      status: record.status,
      action,
      detail,
    });
  }

  return { items, conflicts, duplicates };
}

export function computeRevertImportId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `IMP-${ts}-${rand}`;
}

export function validateRevertImportForSameDeviceSameDay(
  importRecords: InspectionRecord[],
  existingRecords: InspectionRecord[],
  currentDeviceId: string,
  currentDate: string
): { blocked: InspectionRecord[]; blockedCount: number } {
  if (!revertModuleConfig.enableDuplicateBlocking) {
    return { blocked: [], blockedCount: 0 };
  }

  const existingSubmissions = existingRecords.filter(
    r => r.deviceId === currentDeviceId
      && r.date === currentDate
      && (r.status === 'submitted' || r.status === 'synced')
  );
  if (existingSubmissions.length === 0) {
    return { blocked: [], blockedCount: 0 };
  }

  const blocked: InspectionRecord[] = [];
  for (const rec of importRecords) {
    if (rec.deviceId === currentDeviceId && rec.date === currentDate
      && (rec.status === 'submitted' || rec.status === 'synced' || rec.status === 'draft')) {
      const importHash = computeValuesHash(rec.values);
      for (const existing of existingSubmissions) {
        if (computeValuesHash(existing.values) === importHash) {
          blocked.push(rec);
          break;
        }
      }
    }
  }

  return { blocked, blockedCount: blocked.length };
}
