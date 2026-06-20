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
} from '@/types';
import { validateRecord, type ValidationError } from '@/utils/validation';
import { statusConfig, actionConfig, validationMessages, featureFlags } from '@/config/appConfig';

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
