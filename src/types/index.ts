export type UserRole = 'admin' | 'inspector';

export type AnomalyLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type FieldType = 'text' | 'number' | 'select' | 'photo' | 'textarea';

export type RecordStatus = 'draft' | 'submitted' | 'synced' | 'conflict';

export type DeviceStatus = 'normal' | 'maintenance' | 'offline';

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
}

export interface ConflictRecord {
  id: string;
  deviceId: string;
  date: string;
  localVersion: InspectionRecord;
  remoteVersion: InspectionRecord;
  resolved: boolean;
  resolution?: 'keep-local' | 'keep-remote' | 'merge';
  resolvedAt?: string;
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
}
