import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, ChevronRight, Zap, ArrowLeftRight, FileCheck } from 'lucide-react';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import Empty from '@/components/Empty';
import { useStore } from '@/store/useStore';
import { getAnomalyLevelColor, getAnomalyLevelLabel } from '@/utils/anomaly';
import type { ConflictRecord, InspectionRecord } from '@/types';

export default function Sync() {
  const {
    inspections,
    conflicts,
    devices,
    templates,
    offlineMode,
    syncAll,
    resolveConflict,
    isLoading,
  } = useStore();

  const [syncing, setSyncing] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<ConflictRecord | null>(null);
  const [resolving, setResolving] = useState(false);

  const pendingRecords = inspections.filter(
    (r) => r.status === 'submitted' || r.status === 'draft'
  );
  const conflictRecords = conflicts.filter((c) => !c.resolved);
  const syncedRecords = inspections.filter((r) => r.status === 'synced');

  const handleSync = async () => {
    if (offlineMode) {
      alert('当前处于离线模式，请先关闭离线模式再同步');
      return;
    }
    setSyncing(true);
    try {
      const result = await syncAll();
      alert(`同步完成：成功 ${result.success} 条，冲突 ${result.conflicts} 条，失败 ${result.errors} 条`);
    } catch (e) {
      alert('同步失败：' + (e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleResolve = async (resolution: 'keep-local' | 'keep-remote' | 'merge') => {
    if (!selectedConflict) return;
    if (offlineMode) {
      alert('当前处于离线模式，请先关闭离线模式再解决冲突');
      return;
    }
    setResolving(true);
    try {
      await resolveConflict(selectedConflict.id, resolution);
      setSelectedConflict(null);
      alert('冲突已解决');
    } catch (e) {
      alert('解决冲突失败：' + (e as Error).message);
    } finally {
      setResolving(false);
    }
  };

  const getDeviceName = (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    return device ? `${device.code} ${device.name}` : deviceId;
  };

  const getTemplateName = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    return tpl?.name || '未知模板';
  };

  const ConflictDetailModal = () => {
    if (!selectedConflict) return null;
    const { localVersion, remoteVersion, diffFields } = selectedConflict;

    const renderFieldDiff = (field: string, localVal: any, remoteVal: any) => {
      const isSame = JSON.stringify(localVal) === JSON.stringify(remoteVal);
      return (
        <div key={field} className={`p-3 rounded-lg ${isSame ? 'bg-surface-50' : 'bg-warning-50'}`}>
          <div className="text-xs text-primary-600 mb-2 font-medium">{field}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-[10px] text-accent-600 mb-1">本地</div>
              <div className={`text-primary-800 ${!isSame ? 'font-medium' : ''}`}>
                {localVal !== undefined && localVal !== null ? String(localVal) : '-'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-primary-500 mb-1">远端</div>
              <div className={`text-primary-800 ${!isSame ? 'font-medium' : ''}`}>
                {remoteVal !== undefined && remoteVal !== null ? String(remoteVal) : '-'}
              </div>
            </div>
          </div>
        </div>
      );
    };

    const getFieldLabel = (key: string) => {
      const tpl = templates.find((t) => t.id === localVersion.templateId);
      const field = tpl?.fields.find((f) => f.key === key);
      return field?.label || key;
    };

    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full max-w-md max-h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-surface-200">
            <h3 className="text-base font-bold text-primary-800">冲突详情</h3>
            <button
              onClick={() => setSelectedConflict(null)}
              disabled={resolving}
              className="text-primary-400 hover:text-primary-600 text-sm"
            >
              关闭
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-warning-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-warning-700 mb-2">
                <AlertTriangle size={18} />
                <span className="font-medium">同一设备同一天存在不同版本</span>
              </div>
              <div className="text-sm text-warning-600 space-y-1">
                <div>设备：{getDeviceName(selectedConflict.deviceId)}</div>
                <div>日期：{selectedConflict.date}</div>
                <div>差异字段：{diffFields.length} 个</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-primary-700">字段对比</div>
              <div className="space-y-2">
                {diffFields.includes('photos') && renderFieldDiff('照片', `${localVersion.photos.length} 张`, `${remoteVersion.photos.length} 张`)}
                {diffFields.includes('anomalyLevel') && renderFieldDiff('异常等级', getAnomalyLevelLabel(localVersion.anomalyLevel), getAnomalyLevelLabel(remoteVersion.anomalyLevel))}
                {diffFields.filter(f => f !== 'photos' && f !== 'anomalyLevel').map((key) =>
                  renderFieldDiff(getFieldLabel(key), localVersion.values[key], remoteVersion.values[key])
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-accent-50 rounded-lg p-3">
                <div className="text-accent-600 font-medium mb-1">本地版本</div>
                <div className="text-primary-600">提交人：{localVersion.inspectorName}</div>
                <div className="text-primary-600">更新时间：{new Date(localVersion.updatedAt).toLocaleString()}</div>
              </div>
              <div className="bg-primary-50 rounded-lg p-3">
                <div className="text-primary-600 font-medium mb-1">远端版本</div>
                <div className="text-primary-600">提交人：{remoteVersion.inspectorName}</div>
                <div className="text-primary-600">更新时间：{new Date(remoteVersion.updatedAt).toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-surface-200 space-y-2">
            <button
              onClick={() => handleResolve('keep-local')}
              disabled={resolving}
              className="w-full py-3 bg-accent-500 text-white rounded-xl font-medium hover:bg-accent-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <FileCheck size={18} />
              保留本地版本
            </button>
            <button
              onClick={() => handleResolve('keep-remote')}
              disabled={resolving}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ArrowLeftRight size={18} />
              采用远端版本
            </button>
            <button
              onClick={() => handleResolve('merge')}
              disabled={resolving}
              className="w-full py-3 bg-success-500 text-white rounded-xl font-medium hover:bg-success-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Zap size={18} />
              合并版本（保留非空值）
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="text-primary-600 animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      <TopBar title="同步中心" />

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-accent-600">{pendingRecords.length}</div>
            <div className="text-xs text-primary-600 mt-1">待同步</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-warning-600">{conflictRecords.length}</div>
            <div className="text-xs text-primary-600 mt-1">冲突</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-success-600">{syncedRecords.length}</div>
            <div className="text-xs text-primary-600 mt-1">已同步</div>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing || pendingRecords.length === 0 || offlineMode}
          className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-card"
        >
          <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
          {syncing ? '同步中...' : '立即同步'}
        </button>

        {offlineMode && (
          <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-warning-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-warning-700">
              当前为离线模式，无法同步。请关闭离线模式后再进行同步操作。
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-surface-100">
            <h2 className="text-base font-bold text-primary-800 flex items-center gap-2">
              <Clock size={18} className="text-accent-500" />
              待同步队列
            </h2>
          </div>

          {pendingRecords.length === 0 ? (
            <Empty text="暂无待同步记录" icon={CheckCircle} />
          ) : (
            <div className="divide-y divide-surface-100">
              {pendingRecords.map((record) => (
                <div key={record.id} className="p-4 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    record.status === 'draft' ? 'bg-warning-500' : 'bg-accent-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary-800 truncate">
                      {getDeviceName(record.deviceId)}
                    </div>
                    <div className="text-xs text-primary-500 mt-0.5">
                      {record.date} · {getTemplateName(record.templateId)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        record.status === 'draft'
                          ? 'bg-warning-100 text-warning-600'
                          : 'bg-accent-100 text-accent-600'
                      }`}>
                        {record.status === 'draft' ? '草稿' : '已提交'}
                      </span>
                      {record.anomalyLevel !== 'none' && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${getAnomalyLevelColor(record.anomalyLevel)}`}>
                          {getAnomalyLevelLabel(record.anomalyLevel)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-primary-300 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-surface-100">
            <h2 className="text-base font-bold text-primary-800 flex items-center gap-2">
              <Zap size={18} className="text-warning-500" />
              冲突记录
              {conflictRecords.length > 0 && (
                <span className="text-xs bg-warning-100 text-warning-600 px-2 py-0.5 rounded-full">
                  {conflictRecords.length}
                </span>
              )}
            </h2>
          </div>

          {conflictRecords.length === 0 ? (
            <Empty text="暂无冲突记录" icon={CheckCircle} />
          ) : (
            <div className="divide-y divide-surface-100">
              {conflictRecords.map((conflict) => (
                <button
                  key={conflict.id}
                  onClick={() => setSelectedConflict(conflict)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-surface-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={20} className="text-warning-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary-800 truncate">
                      {getDeviceName(conflict.deviceId)}
                    </div>
                    <div className="text-xs text-primary-500 mt-0.5">
                      {conflict.date} · {conflict.diffFields.length} 个字段差异
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-primary-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
      <ConflictDetailModal />
    </div>
  );
}
