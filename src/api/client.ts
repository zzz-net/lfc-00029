import type {
  Template,
  Device,
  InspectionRecord,
  ConflictRecord,
  OperationLog,
} from '@/types';

const API_BASE = '/api';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const apiClient = {
  templates: {
    list: () => request<Template[]>('/templates'),
    get: (id: string) => request<Template>(`/templates/${id}`),
    create: (data: Partial<Template>) =>
      request<Template>('/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Template>) =>
      request<Template>(`/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<{ success: boolean }>(`/templates/${id}`, {
        method: 'DELETE',
      }),
  },

  devices: {
    list: () => request<Device[]>('/devices'),
    get: (id: string) => request<Device>(`/devices/${id}`),
    create: (data: Partial<Device>) =>
      request<Device>('/devices', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Device>) =>
      request<Device>(`/devices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    seed: () =>
      request<{ seeded: boolean; devices: Device[] }>('/devices/seed', {
        method: 'POST',
      }),
  },

  inspections: {
    list: (params?: { date?: string; deviceId?: string; status?: string }) => {
      const query = new URLSearchParams();
      if (params?.date) query.set('date', params.date);
      if (params?.deviceId) query.set('deviceId', params.deviceId);
      if (params?.status) query.set('status', params.status);
      const qs = query.toString();
      return request<InspectionRecord[]>(`/inspections${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => request<InspectionRecord>(`/inspections/${id}`),
    create: (data: Partial<InspectionRecord>) =>
      request<InspectionRecord>('/inspections', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<InspectionRecord>) =>
      request<InspectionRecord>(`/inspections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  sync: {
    batch: (records: InspectionRecord[], userId: string, userName: string) =>
      request<{
        results: { recordId: string; status: 'success' | 'conflict' | 'error'; conflictId?: string; error?: string }[];
        conflicts: ConflictRecord[];
      }>('/sync/batch', {
        method: 'POST',
        body: JSON.stringify({ records, userId, userName }),
      }),
    conflicts: () => request<ConflictRecord[]>('/sync/conflicts'),
    resolve: (conflictId: string, resolution: 'keep-local' | 'keep-remote' | 'merge', userId: string, userName: string) =>
      request<{ conflict: ConflictRecord; record: InspectionRecord }>(`/sync/resolve/${conflictId}`, {
        method: 'POST',
        body: JSON.stringify({ resolution, userId, userName }),
      }),
  },

  logs: {
    list: () => request<OperationLog[]>('/logs'),
  },

  export: {
    json: (params?: { date?: string; deviceId?: string }) => {
      const query = new URLSearchParams();
      if (params?.date) query.set('date', params.date);
      if (params?.deviceId) query.set('deviceId', params.deviceId);
      query.set('format', 'json');
      const qs = query.toString();
      return request<any[]>(`/export${qs ? `?${qs}` : ''}`);
    },
    csvUrl: (params?: { date?: string; deviceId?: string }) => {
      const query = new URLSearchParams();
      if (params?.date) query.set('date', params.date);
      if (params?.deviceId) query.set('deviceId', params.deviceId);
      query.set('format', 'csv');
      const qs = query.toString();
      return `/api/export${qs ? `?${qs}` : ''}`;
    },
  },
};
