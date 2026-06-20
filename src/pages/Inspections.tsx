import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, FileCheck, AlertTriangle, ChevronRight, Filter, FileEdit, Send, CheckCircle } from 'lucide-react';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import { useStore } from '@/store/useStore';
import { getTodayString } from '@/utils/id';
import { getAnomalyLevelColor, getAnomalyLevelLabel } from '@/utils/anomaly';
import { appConfig, statusConfig } from '@/config/appConfig';

const statusList = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待巡检' },
  { value: 'draft', label: statusConfig.draft.shortLabel },
  { value: 'submitted', label: statusConfig.submitted.shortLabel },
  { value: 'synced', label: statusConfig.synced.shortLabel },
  { value: 'conflict', label: statusConfig.conflict.shortLabel },
];

export default function Inspections() {
  const navigate = useNavigate();
  const { devices, inspections, templates } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showFilter, setShowFilter] = useState(false);

  const today = getTodayString();

  const todayInspections = useMemo(() => {
    return inspections.filter((r) => r.date === today);
  }, [inspections, today]);

  const filteredInspections = useMemo(() => {
    return todayInspections.filter((r) => {
      const device = devices.find((d) => d.id === r.deviceId);
      const matchSearch =
        !search ||
        device?.name.toLowerCase().includes(search.toLowerCase()) ||
        device?.code.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [todayInspections, devices, search, statusFilter]);

  const devicesWithStatus = useMemo(() => {
    return devices.map((device) => {
      const records = todayInspections.filter((r) => r.deviceId === device.id);
      const hasDraft = records.some((r) => r.status === 'draft');
      const hasSynced = records.some((r) => r.status === 'synced');
      const hasSubmitted = records.some((r) => r.status === 'submitted');
      const hasConflict = records.some((r) => r.status === 'conflict');

      let status: 'pending' | 'draft' | 'submitted' | 'synced' | 'conflict' = 'pending';
      if (hasConflict) status = 'conflict';
      else if (hasDraft) status = 'draft';
      else if (hasSubmitted) status = 'submitted';
      else if (hasSynced) status = 'synced';

      return { device, records, status };
    });
  }, [devices, todayInspections]);

  const handleInspect = (deviceId: string) => {
    navigate(`/inspections/${deviceId}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return FileEdit;
      case 'submitted': return Send;
      case 'synced': return CheckCircle;
      case 'conflict': return AlertTriangle;
      default: return Clock;
    }
  };

  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      <TopBar title={appConfig.pages.inspections.title} />

      <div className="p-4 space-y-3 max-w-md mx-auto">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索设备"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm bg-white"
            />
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`p-3 rounded-xl transition-colors ${
              showFilter || statusFilter
                ? 'bg-primary-600 text-white'
                : 'bg-white text-primary-600 border border-surface-200'
            }`}
          >
            <Filter size={20} />
          </button>
        </div>

        {showFilter && (
          <div className="bg-white rounded-2xl shadow-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-primary-800">状态筛选</h3>
            <div className="flex flex-wrap gap-2">
              {statusList.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setStatusFilter(item.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === item.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-50 text-primary-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-primary-600">{devices.length}</div>
            <div className="text-[11px] text-primary-500 mt-0.5">设备总数</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-success-600">
              {devicesWithStatus.filter((d) => d.status === 'synced').length}
            </div>
            <div className="text-[11px] text-primary-500 mt-0.5">已完成</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-accent-500">
              {devicesWithStatus.filter((d) => d.status === 'draft' || d.status === 'submitted').length}
            </div>
            <div className="text-[11px] text-primary-500 mt-0.5">进行中</div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold text-primary-800">设备列表</h2>

          {devicesWithStatus.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-card p-8 text-center">
              <FileCheck size={48} className="mx-auto text-surface-200 mb-3" />
              <p className="text-primary-400 text-sm">暂无设备数据</p>
            </div>
          ) : (
            devicesWithStatus
              .filter((d) => {
                if (!search && !statusFilter) return true;
                if (search) {
                  return (
                    d.device.name.toLowerCase().includes(search.toLowerCase()) ||
                    d.device.code.toLowerCase().includes(search.toLowerCase())
                  );
                }
                if (statusFilter) {
                  return d.status === statusFilter;
                }
                return true;
              })
              .map(({ device, records, status }) => {
                const statusInfo = status === 'pending'
                  ? { label: '待巡检', color: 'bg-surface-100 text-surface-300' }
                  : { label: statusConfig[status as keyof typeof statusConfig]?.shortLabel || status, color: `${statusConfig[status as keyof typeof statusConfig]?.bgColor || ''} ${statusConfig[status as keyof typeof statusConfig]?.textColor || ''}` };

                const latestRecord = records[0];
                const anomalyLevel = latestRecord?.anomalyLevel || 'none';
                const StatusIcon = getStatusIcon(status);

                return (
                  <button
                    key={device.id}
                    onClick={() => handleInspect(device.id)}
                    className="w-full bg-white rounded-2xl shadow-card p-4 text-left hover:shadow-card-hover transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-primary-800">{device.name}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`} title={status !== 'pending' ? statusConfig[status as keyof typeof statusConfig]?.description : undefined}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-primary-500 mt-0.5 font-mono">{device.code}</p>
                      </div>
                      <ChevronRight size={20} className="text-surface-300" />
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-50">
                      <div className="flex items-center gap-3 text-xs text-primary-500">
                        <span>{device.location}</span>
                        <span>·</span>
                        <span>{device.category}</span>
                      </div>
                      {latestRecord && (
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getAnomalyLevelColor(anomalyLevel)}`}>
                            {getAnomalyLevelLabel(anomalyLevel)}
                          </span>
                          {records.length > 1 && (
                            <span className="text-[10px] text-accent-600">
                              {records.length}个版本
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
