import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Calendar, Filter, ChevronDown } from 'lucide-react';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import Empty from '@/components/Empty';
import { useStore } from '@/store/useStore';
import { getAnomalyLevelColor, getAnomalyLevelLabel } from '@/utils/anomaly';
import { getTodayString } from '@/utils/id';
import { appConfig, statusConfig, exportFields } from '@/config/appConfig';
import type { InspectionRecord } from '@/types';

export default function Export() {
  const { inspections, devices, templates, offlineMode, markRecordExported, getStatusHistory } = useStore();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filteredInspections = inspections.filter((r) => {
    if (selectedDate && r.date !== selectedDate) return false;
    if (selectedDevice && r.deviceId !== selectedDevice) return false;
    return true;
  });

  const getDeviceName = (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    return device ? `${device.code} ${device.name}` : deviceId;
  };

  const getDeviceCode = (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    return device?.code || deviceId;
  };

  const getDeviceLocation = (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    return device?.location || '';
  };

  const getTemplateName = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    return tpl?.name || '未知模板';
  };

  const getStatusLabel = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig]?.label || status;
  };

  const getStatusColor = (status: string) => {
    const meta = statusConfig[status as keyof typeof statusConfig];
    return meta ? `${meta.bgColor} ${meta.textColor}` : 'bg-surface-100 text-primary-500';
  };

  const buildExportRow = (record: InspectionRecord): Record<string, any> => {
    const device = devices.find((d) => d.id === record.deviceId);
    const tpl = templates.find((t) => t.id === record.templateId);
    const history = getStatusHistory(record.id);
    const lastChange = history[0];

    return {
      recordId: record.id,
      deviceCode: device?.code || '',
      deviceName: device?.name || '',
      deviceLocation: device?.location || '',
      date: record.date,
      templateName: tpl?.name || '',
      templateVersion: record.templateVersion,
      inspectorName: record.inspectorName,
      statusLabel: getStatusLabel(record.status),
      anomalyLabel: getAnomalyLevelLabel(record.anomalyLevel),
      values: record.values,
      photoCount: record.photos.length,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      submittedAt: record.submittedAt || '',
      syncedAt: record.syncedAt || '',
      lastStatusChange: lastChange ? `${lastChange.action} @ ${lastChange.timestamp}` : '',
    };
  };

  const exportJSON = async () => {
    setExporting(true);
    try {
      const data = filteredInspections.map(buildExportRow);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${appConfig.export.fileNamePrefix}${getTodayString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      for (const r of filteredInspections) {
        await markRecordExported(r.id);
      }
    } catch (e) {
      alert('导出失败：' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const csvFields = exportFields.filter((f) => !f.csvOnly);
      const headers = csvFields.map((f) => f.label);
      const rows = filteredInspections.map((record) => {
        const row = buildExportRow(record);
        return csvFields.map((f) => {
          let val = row[f.key];
          if (f.key === 'values') val = JSON.stringify(val);
          if (f.key === 'createdAt' || f.key === 'updatedAt' || f.key === 'submittedAt' || f.key === 'syncedAt') {
            val = val ? new Date(val).toLocaleString() : '';
          }
          return val !== undefined && val !== null ? String(val) : '';
        });
      });

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${appConfig.export.fileNamePrefix}${getTodayString()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      for (const r of filteredInspections) {
        await markRecordExported(r.id);
      }
    } catch (e) {
      alert('导出失败：' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const dates = [...new Set(inspections.map((r) => r.date))].sort().reverse();

  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      <TopBar title={appConfig.pages.export.title} />

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <h2 className="text-sm font-bold text-primary-800 mb-3 flex items-center gap-2">
            <Filter size={16} className="text-primary-500" />
            筛选条件
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <button
                onClick={() => {
                  setShowDatePicker(!showDatePicker);
                  setShowDevicePicker(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-50 rounded-xl text-sm text-primary-700 hover:bg-surface-100 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-primary-400" />
                  {selectedDate || '全部日期'}
                </span>
                <ChevronDown size={14} className={`text-primary-400 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
              </button>
              {showDatePicker && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card border border-surface-200 z-10 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedDate('');
                      setShowDatePicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 ${!selectedDate ? 'text-primary-600 bg-primary-50 font-medium' : 'text-primary-700'}`}
                  >
                    全部日期
                  </button>
                  {dates.map((date) => (
                    <button
                      key={date}
                      onClick={() => {
                        setSelectedDate(date);
                        setShowDatePicker(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 ${selectedDate === date ? 'text-primary-600 bg-primary-50 font-medium' : 'text-primary-700'}`}
                    >
                      {date}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowDevicePicker(!showDevicePicker);
                  setShowDatePicker(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-50 rounded-xl text-sm text-primary-700 hover:bg-surface-100 transition-colors"
              >
                <span className="truncate">{selectedDevice ? getDeviceName(selectedDevice) : '全部设备'}</span>
                <ChevronDown size={14} className={`text-primary-400 flex-shrink-0 ml-1 transition-transform ${showDevicePicker ? 'rotate-180' : ''}`} />
              </button>
              {showDevicePicker && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card border border-surface-200 z-10 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedDevice('');
                      setShowDevicePicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 ${!selectedDevice ? 'text-primary-600 bg-primary-50 font-medium' : 'text-primary-700'}`}
                  >
                    全部设备
                  </button>
                  {devices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => {
                        setSelectedDevice(device.id);
                        setShowDevicePicker(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 ${selectedDevice === device.id ? 'text-primary-600 bg-primary-50 font-medium' : 'text-primary-700'}`}
                    >
                      {device.code} {device.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-xs text-primary-500 mt-2">
            共 {filteredInspections.length} 条记录
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={exportJSON}
            disabled={exporting || filteredInspections.length === 0}
            className="bg-white rounded-2xl shadow-card p-4 text-left hover:bg-surface-50 transition-colors disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-3">
              <FileJson size={24} className="text-primary-600" />
            </div>
            <div className="text-sm font-bold text-primary-800">{appConfig.export.jsonLabel}</div>
            <div className="text-xs text-primary-500 mt-1">{appConfig.export.jsonDesc}</div>
          </button>

          <button
            onClick={exportCSV}
            disabled={exporting || filteredInspections.length === 0}
            className="bg-white rounded-2xl shadow-card p-4 text-left hover:bg-surface-50 transition-colors disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center mb-3">
              <FileSpreadsheet size={24} className="text-success-600" />
            </div>
            <div className="text-sm font-bold text-primary-800">{appConfig.export.csvLabel}</div>
            <div className="text-xs text-primary-500 mt-1">{appConfig.export.csvDesc}</div>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-surface-100">
            <h2 className="text-base font-bold text-primary-800 flex items-center gap-2">
              <Download size={18} className="text-primary-500" />
              记录列表
            </h2>
          </div>

          {filteredInspections.length === 0 ? (
            <Empty type="export" icon={FileSpreadsheet} />
          ) : (
            <div className="divide-y divide-surface-100 max-h-96 overflow-y-auto">
              {filteredInspections.map((record) => (
                <div key={record.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary-800 truncate">
                        {getDeviceName(record.deviceId)}
                      </div>
                      <div className="text-xs text-primary-500 mt-0.5">
                        {record.date} · {getTemplateName(record.templateId)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusColor(record.status)}`} title={statusConfig[record.status as keyof typeof statusConfig]?.description}>
                        {getStatusLabel(record.status)}
                      </span>
                      {record.anomalyLevel !== 'none' && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${getAnomalyLevelColor(record.anomalyLevel)}`}>
                          {getAnomalyLevelLabel(record.anomalyLevel)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-primary-400 mt-2">
                    巡检员：{record.inspectorName} · {new Date(record.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {offlineMode && (
          <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 flex items-start gap-2">
            <Download size={16} className="text-warning-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-warning-700">
              当前为离线模式，导出的仅为本地缓存数据。
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
