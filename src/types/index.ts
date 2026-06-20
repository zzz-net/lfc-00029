export type UserRole = 'admin' | 'inspector';

export type AnomalyLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type FieldType = 'text' | 'number' | 'select' | 'photo' | 'textarea';

export type RecordStatus = 'draft' | 'submitted' | 'synced' | 'conflict' | 'withdrawn' | 'resumed';

export type StatusChangeAction = 'create_draft' | 'save_draft' | 'submit' | 'withdraw' | 'resubmit' | 'sync_success' | 'sync_fail' | 'conflict_detected' | 'conflict_resolved' | 'edit_after_sync' | 'resume' | 'resubmit_after_withdraw' | 'withdraw_audit_logged';

export type DeviceStatus = 'normal' | 'maintenance' | 'offline';

export type ConflictResolution = 'keep-local' | 'keep-remote' | 'merge';

export type SectionKey = 'drafts' | 'pending' | 'synced';

export interface TemplateField {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  anomalyLevel?: Exclude<AnomalyLevel, 'none'>;
}

export interface Template {
  id: string;
  name: string;
  version: number;
  enabled: boolean;
  fields: TemplateField[];
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  code: string;
  name: string;
  location: string;
  category: string;
  status: DeviceStatus;
}

export interface PhotoPlaceholder {
  id: string;
  placeholderName: string;
  thumbnail?: string;
  realUrl?: string;
  size: number;
  createdAt: string;
}

export interface StatusChangeEvent {
  id: string;
  recordId: string;
  fromStatus: RecordStatus | null;
  toStatus: RecordStatus;
  action: StatusChangeAction;
  actorId: string;
  actorName: string;
  timestamp: string;
  note?: string;
  deviceId?: string;
  date?: string;
}

export interface SubmissionSnapshot {
  id: string;
  recordId: string;
  snapshotAt: string;
  submittedAt: string;
  recordValues: Record<string, any>;
  recordPhotos: PhotoPlaceholder[];
  anomalyLevel: AnomalyLevel;
  templateName: string;
  templateVersion: number;
  deviceCode: string;
  deviceName: string;
  inspectorId: string;
  inspectorName: string;
  date: string;
  submissionCount: number;
  withdrawCount: number;
  lastStatusChange?: string;
  conflictResolution?: ConflictResolution;
  conflictResolvedAt?: string;
}

export interface RecordMeta {
  recordId: string;
  submissionCount: number;
  withdrawCount: number;
  firstSubmittedAt?: string;
  lastSubmittedAt?: string;
  lastWithdrawnAt?: string;
  hasConflict: boolean;
  lastConflictResolution?: ConflictResolution;
  lastConflictResolvedAt?: string;
  exportCount: number;
}

export interface InspectionRecord {
  id: string;
  deviceId: string;
  templateId: string;
  templateVersion: number;
  inspectorId: string;
  inspectorName: string;
  date: string;
  values: Record<string, any>;
  photos: PhotoPlaceholder[];
  anomalyLevel: AnomalyLevel;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  conflictId?: string;
  submittedAt?: string;
  firstSubmittedAt?: string;
  submissionCount?: number;
  withdrawCount?: number;
  lastWithdrawnAt?: string;
  originDeviceId?: string;
}

export interface ConflictRecord {
  id: string;
  deviceId: string;
  date: string;
  localVersion: InspectionRecord;
  remoteVersion: InspectionRecord;
  resolved: boolean;
  resolution?: ConflictResolution;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  diffFields: string[];
}

export interface OperationLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  detail: string;
  result: 'success' | 'fail' | 'conflict';
}

export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update';
  recordId: string;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  error?: string;
  createdAt: string;
  retryCount: number;
}

export interface AppState {
  role: UserRole;
  offlineMode: boolean;
  networkStatus: 'online' | 'offline';
  currentUserId: string;
  currentUserName: string;
  lastVisitAt?: string;
}

export interface SubmissionReceipt {
  id: string;
  recordId: string;
  receiptNo: string;
  submittedAt: string;
  receivedAt?: string;
  sourceDeviceId: string;
  sourceDeviceInfo: string;
  operatorId: string;
  operatorName: string;
  snapshotId: string;
  recordValuesHash: string;
  status: 'pending' | 'acknowledged' | 'failed';
  errorMessage?: string;
}

export interface AuditLogEntry {
  id: string;
  recordId: string;
  timestamp: string;
  action: StatusChangeAction | string;
  operatorId: string;
  operatorName: string;
  sourceDeviceId: string;
  fromStatus: RecordStatus | null;
  toStatus: RecordStatus | null;
  detail: string;
  snapshotBefore?: string;
  snapshotAfter?: string;
  result: 'success' | 'fail' | 'skipped';
  errorMessage?: string;
}

export interface SessionState {
  id: string;
  userId: string;
  deviceId: string;
  startedAt: string;
  lastActiveAt: string;
  lastEditingRecordId?: string;
  lastEditingField?: string;
  scrollPosition?: number;
  formValues?: Record<string, any>;
  unsavedChanges: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorItem[];
  warnings: ValidationWarningItem[];
}

export interface ValidationErrorItem {
  type: 'required' | 'version' | 'status_gate' | 'duplicate' | 'conflict' | 'format';
  fieldKey?: string;
  message: string;
  blocking: boolean;
}

export interface ValidationWarningItem {
  type: 'auxiliary_skip' | 'multi_version' | 'offline_hint' | 'recommend';
  fieldKey?: string;
  message: string;
}

export interface TimelineEvent {
  id: string;
  recordId: string;
  timestamp: string;
  action: StatusChangeAction | string;
  actionLabel: string;
  operatorName: string;
  fromStatus: RecordStatus | null;
  toStatus: RecordStatus | null;
  note?: string;
  sourceDeviceId?: string;
  receiptId?: string;
  snapshotId?: string;
}

export interface ExportFilter {
  startDate?: string;
  endDate?: string;
  deviceIds?: string[];
  statuses?: RecordStatus[];
  inspectorIds?: string[];
}

export type ExportFormat = 'json' | 'csv';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingRecordId?: string;
  existingStatus?: RecordStatus;
  existingSubmittedAt?: string;
  reason?: 'same_day_same_device' | 'same_values_hash';
}
