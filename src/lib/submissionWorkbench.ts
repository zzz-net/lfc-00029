import type {
  InspectionRecord,
  Template,
  TemplateField,
  RecordStatus,
  StatusChangeAction,
  ValidationResult,
  ValidationErrorItem,
  ValidationWarningItem,
  DuplicateCheckResult,
  TimelineEvent,
  StaleDraftInfo,
  ImportResult,
  ImportErrorItem,
  ButtonActionState,
} from '@/types';
import { validateRecord, type ValidationError } from '@/utils/validation';
import { statusConfig, actionConfig, validationMessages, featureFlags, buttonDisableReasons } from '@/config/appConfig';

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
  existingRecords: InspectionRecord[]
): { valid: InspectionRecord[]; skipped: InspectionRecord[]; errors: ImportErrorItem[] } {
  const valid: InspectionRecord[] = [];
  const skipped: InspectionRecord[] = [];
  const errors: ImportErrorItem[] = [];
  const existingIds = new Set(existingRecords.map(r => r.id));

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || typeof row !== 'object') {
      errors.push({ row: i + 1, reason: '数据格式不正确' });
      continue;
    }
    if (!row.id || typeof row.id !== 'string') {
      errors.push({ row: i + 1, id: row.id, reason: '缺少记录ID或格式错误' });
      continue;
    }
    if (!row.deviceId || !row.templateId || !row.date) {
      errors.push({ row: i + 1, id: row.id, reason: '缺少必要字段（deviceId/templateId/date）' });
      continue;
    }
    if (existingIds.has(row.id)) {
      skipped.push(row as InspectionRecord);
      continue;
    }
    const status: RecordStatus = row.status || 'draft';
    const validStatuses: RecordStatus[] = ['draft', 'submitted', 'synced', 'conflict', 'withdrawn', 'resumed'];
    if (!validStatuses.includes(status)) {
      errors.push({ row: i + 1, id: row.id, reason: `无效的状态值: ${status}` });
      continue;
    }
    const record: InspectionRecord = {
      id: row.id,
      deviceId: row.deviceId,
      templateId: row.templateId,
      templateVersion: row.templateVersion || 1,
      inspectorId: row.inspectorId || 'imported',
      inspectorName: row.inspectorName || '导入',
      date: row.date,
      values: row.values || {},
      photos: row.photos || [],
      anomalyLevel: row.anomalyLevel || 'none',
      status,
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || new Date().toISOString(),
      syncedAt: row.syncedAt,
      conflictId: row.conflictId,
      submittedAt: row.submittedAt,
      firstSubmittedAt: row.firstSubmittedAt,
      submissionCount: row.submissionCount || 0,
      withdrawCount: row.withdrawCount || 0,
      lastWithdrawnAt: row.lastWithdrawnAt,
      originDeviceId: row.originDeviceId || 'imported',
    };
    valid.push(record);
  }

  return { valid, skipped, errors };
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
