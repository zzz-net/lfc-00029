export type UserRole = 'admin' | 'inspector';

export type AnomalyLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type FieldType = 'text' | 'number' | 'select' | 'photo' | 'textarea';

export type RecordStatus = 'draft' | 'submitted' | 'synced' | 'conflict';

export type StatusChangeAction = 'create_draft' | 'save_draft' | 'submit' | 'withdraw' | 'resubmit' | 'sync_success' | 'sync_fail' | 'conflict_detected' | 'conflict_resolved' | 'edit_after_sync';

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
