import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  Template,
  Device,
  InspectionRecord,
  ConflictRecord,
  OperationLog,
} from '../../src/types';
import { generateId, getTodayString } from '../../src/utils/id';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

interface DataStore {
  templates: Template[];
  devices: Device[];
  inspections: InspectionRecord[];
  conflicts: ConflictRecord[];
  logs: OperationLog[];
}

let memoryStore: DataStore = {
  templates: [],
  devices: [],
  inspections: [],
  conflicts: [],
  logs: [],
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadFromFile() {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      memoryStore = JSON.parse(data);
    } catch (e) {
      console.error('Failed to load data file:', e);
    }
  }
}

function saveToFile() {
  ensureDataDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save data file:', e);
  }
}

function initSeedData() {
  if (memoryStore.devices.length === 0) {
    memoryStore.devices = [
      { id: generateId('dev'), code: 'PUMP-001', name: '1号循环泵', location: 'A区泵房', category: '泵类', status: 'normal' },
      { id: generateId('dev'), code: 'PUMP-002', name: '2号循环泵', location: 'A区泵房', category: '泵类', status: 'normal' },
      { id: generateId('dev'), code: 'VALVE-101', name: '主管道阀门', location: 'B区管廊', category: '阀门', status: 'normal' },
      { id: generateId('dev'), code: 'MOTOR-201', name: '送风机电机', location: 'C区车间', category: '电机', status: 'maintenance' },
      { id: generateId('dev'), code: 'SENSOR-301', name: '温度传感器组', location: 'D区控制室', category: '仪表', status: 'normal' },
      { id: generateId('dev'), code: 'COMP-401', name: '空压机', location: 'E区动力房', category: '压缩机', status: 'normal' },
      { id: generateId('dev'), code: 'TRANS-501', name: '主变压器', location: 'F区变电站', category: '电气', status: 'normal' },
      { id: generateId('dev'), code: 'BOILER-601', name: '蒸汽锅炉', location: 'G区锅炉房', category: '锅炉', status: 'offline' },
    ];
  }

  if (memoryStore.templates.length === 0) {
    const now = new Date().toISOString();
    memoryStore.templates = [
      {
        id: generateId('tpl'),
        name: '通用设备巡检模板',
        version: 1,
        enabled: true,
        fields: [
          { id: generateId('fld'), key: 'appearance', label: '外观检查', type: 'select', required: true, options: ['正常', '有灰尘', '有油污', '破损'], anomalyLevel: 'medium' },
          { id: generateId('fld'), key: 'temperature', label: '运行温度(℃)', type: 'number', required: true, anomalyLevel: 'high' },
          { id: generateId('fld'), key: 'vibration', label: '振动情况', type: 'select', required: true, options: ['无', '轻微', '明显', '剧烈'], anomalyLevel: 'high' },
          { id: generateId('fld'), key: 'noise', label: '噪音情况', type: 'select', required: false, options: ['正常', '轻微异常', '明显异响'], anomalyLevel: 'medium' },
          { id: generateId('fld'), key: 'leak', label: '泄漏检查', type: 'select', required: true, options: ['无', '轻微渗', '明显漏'], anomalyLevel: 'critical' },
          { id: generateId('fld'), key: 'photo', label: '现场照片', type: 'photo', required: false },
          { id: generateId('fld'), key: 'remark', label: '备注', type: 'textarea', required: false },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  if (memoryStore.inspections.length === 0) {
    const template = memoryStore.templates[0];
    const device = memoryStore.devices[0];
    if (template && device) {
      const now = new Date().toISOString();
      memoryStore.inspections = [
        {
          id: generateId('rec'),
          deviceId: device.id,
          templateId: template.id,
          templateVersion: template.version,
          inspectorId: 'inspector_001',
          inspectorName: '张巡检',
          date: getTodayString(),
          values: {
            appearance: '正常',
            temperature: 45,
            vibration: '无',
            noise: '正常',
            leak: '无',
            remark: '例行巡检，一切正常',
          },
          photos: [],
          anomalyLevel: 'none',
          status: 'synced',
          createdAt: now,
          updatedAt: now,
          syncedAt: now,
        },
      ];
    }
  }

  saveToFile();
}

loadFromFile();
initSeedData();

export const dataStore = {
  get templates(): Template[] {
    return memoryStore.templates;
  },
  get devices(): Device[] {
    return memoryStore.devices;
  },
  get inspections(): InspectionRecord[] {
    return memoryStore.inspections;
  },
  get conflicts(): ConflictRecord[] {
    return memoryStore.conflicts;
  },
  get logs(): OperationLog[] {
    return memoryStore.logs;
  },

  save() {
    saveToFile();
  },

  addTemplate(tpl: Template) {
    memoryStore.templates.push(tpl);
    saveToFile();
  },

  updateTemplate(tpl: Template) {
    const idx = memoryStore.templates.findIndex((t) => t.id === tpl.id);
    if (idx >= 0) {
      memoryStore.templates[idx] = tpl;
      saveToFile();
    }
  },

  deleteTemplate(id: string) {
    memoryStore.templates = memoryStore.templates.filter((t) => t.id !== id);
    saveToFile();
  },

  addDevice(dev: Device) {
    memoryStore.devices.push(dev);
    saveToFile();
  },

  updateDevice(dev: Device) {
    const idx = memoryStore.devices.findIndex((d) => d.id === dev.id);
    if (idx >= 0) {
      memoryStore.devices[idx] = dev;
      saveToFile();
    }
  },

  addInspection(rec: InspectionRecord) {
    memoryStore.inspections.push(rec);
    saveToFile();
  },

  updateInspection(rec: InspectionRecord) {
    const idx = memoryStore.inspections.findIndex((r) => r.id === rec.id);
    if (idx >= 0) {
      memoryStore.inspections[idx] = rec;
      saveToFile();
    }
  },

  findInspectionByDeviceAndDate(deviceId: string, date: string): InspectionRecord | undefined {
    return memoryStore.inspections.find((r) => r.deviceId === deviceId && r.date === date && r.status !== 'conflict');
  },

  addConflict(conflict: ConflictRecord) {
    memoryStore.conflicts.push(conflict);
    saveToFile();
  },

  updateConflict(conflict: ConflictRecord) {
    const idx = memoryStore.conflicts.findIndex((c) => c.id === conflict.id);
    if (idx >= 0) {
      memoryStore.conflicts[idx] = conflict;
      saveToFile();
    }
  },

  addLog(log: OperationLog) {
    memoryStore.logs.unshift(log);
    if (memoryStore.logs.length > 500) {
      memoryStore.logs = memoryStore.logs.slice(0, 500);
    }
    saveToFile();
  },

  seedDevices() {
    if (memoryStore.devices.length > 0) {
      return false;
    }
    initSeedData();
    return true;
  },

  reset() {
    memoryStore = {
      templates: [],
      devices: [],
      inspections: [],
      conflicts: [],
      logs: [],
    };
    initSeedData();
  },
};
