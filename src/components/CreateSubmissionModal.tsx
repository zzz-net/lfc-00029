import { useState, useMemo } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { getTodayString } from '@/utils/id';
import type { Device, Template } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (recordId: string) => void;
}

export default function CreateSubmissionModal({ open, onClose, onCreated }: Props) {
  const { devices, templates, saveInspectionDraft } = useStore();
  const [deviceId, setDeviceId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const enabledTemplates = useMemo(() => templates.filter(t => t.enabled), [templates]);
  const selectedDevice = useMemo(() => devices.find(d => d.id === deviceId), [devices, deviceId]);
  const selectedTemplate = useMemo(() => enabledTemplates.find(t => t.id === templateId), [enabledTemplates, templateId]);

  const canCreate = deviceId && templateId && date && !submitting;

  const handleCreate = async () => {
    if (!canCreate) return;
    setSubmitting(true);
    setError('');
    try {
      const record = await saveInspectionDraft({
        deviceId,
        templateId,
        templateVersion: selectedTemplate?.version || 1,
        date,
        values: {},
        photos: [],
      });
      onCreated(record.id);
      setDeviceId('');
      setTemplateId('');
      setDate(getTodayString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl animate-[slideUp_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
          <h2 className="text-base font-bold text-primary-800">新建提交单</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-100 text-primary-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-primary-600 block mb-1.5">巡检日期</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-50 rounded-xl text-sm text-primary-800 border border-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <div className="relative">
            <label className="text-xs font-medium text-primary-600 block mb-1.5">选择设备</label>
            <button
              onClick={() => { setShowDeviceDropdown(!showDeviceDropdown); setShowTemplateDropdown(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-50 rounded-xl text-sm text-primary-800 border border-surface-200 hover:bg-surface-100 transition-colors"
            >
              <span className={deviceId ? '' : 'text-primary-400'}>
                {selectedDevice ? `${selectedDevice.code} - ${selectedDevice.name}` : '请选择设备'}
              </span>
              <ChevronDown size={14} className={`text-primary-400 transition-transform ${showDeviceDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showDeviceDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card border border-surface-200 z-20 max-h-48 overflow-y-auto">
                {devices.map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setDeviceId(d.id); setShowDeviceDropdown(false); }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-surface-50 ${deviceId === d.id ? 'bg-primary-50 text-primary-600 font-medium' : 'text-primary-700'}`}
                  >
                    {d.code} - {d.name}
                    <span className="text-primary-400 text-xs ml-2">{d.location}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <label className="text-xs font-medium text-primary-600 block mb-1.5">选择模板</label>
            <button
              onClick={() => { setShowTemplateDropdown(!showTemplateDropdown); setShowDeviceDropdown(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-50 rounded-xl text-sm text-primary-800 border border-surface-200 hover:bg-surface-100 transition-colors"
            >
              <span className={templateId ? '' : 'text-primary-400'}>
                {selectedTemplate ? `${selectedTemplate.name} (v${selectedTemplate.version})` : '请选择模板'}
              </span>
              <ChevronDown size={14} className={`text-primary-400 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTemplateDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card border border-surface-200 z-20 max-h-48 overflow-y-auto">
                {enabledTemplates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTemplateId(t.id); setShowTemplateDropdown(false); }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-surface-50 ${templateId === t.id ? 'bg-primary-50 text-primary-600 font-medium' : 'text-primary-700'}`}
                  >
                    {t.name} <span className="text-primary-400 text-xs">v{t.version}</span>
                  </button>
                ))}
                {enabledTemplates.length === 0 && (
                  <p className="px-3 py-4 text-sm text-primary-400 text-center">暂无可用模板</p>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-critical-50 border border-critical-200 rounded-xl p-3">
              <p className="text-xs text-critical-700">{error}</p>
            </div>
          )}
        </div>

        <div className="border-t border-surface-200 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-surface-100 text-primary-700 rounded-xl text-sm font-medium hover:bg-surface-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {submitting ? '创建中...' : '创建草稿'}
          </button>
        </div>
      </div>
    </div>
  );
}
