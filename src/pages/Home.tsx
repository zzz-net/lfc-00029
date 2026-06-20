import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  FileCheck,
  RefreshCw,
  AlertTriangle,
  Zap,
  Settings,
  Download,
  Clock,
} from 'lucide-react';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import { useStore } from '@/store/useStore';
import { getTodayString } from '@/utils/id';

export default function Home() {
  const navigate = useNavigate();
  const {
    role,
    devices,
    inspections,
    conflicts,
    offlineMode,
    loadInitialData,
    seedDevices,
    isLoading,
  } = useStore();

  const today = getTodayString();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    seedDevices();
  }, [devices.length]);

  const todayInspections = inspections.filter((r) => r.date === today);
  const draftCount = inspections.filter((r) => r.status === 'draft').length;
  const pendingSyncCount = inspections.filter(
    (r) => r.status === 'submitted' || r.status === 'draft'
  ).length;
  const anomalyCount = inspections.filter((r) => r.anomalyLevel !== 'none' && r.status === 'synced').length;
  const conflictCount = conflicts.filter((c) => !c.resolved).length;
  const totalDevices = devices.length;
  const inspectedToday = new Set(todayInspections.map((r) => r.deviceId)).size;

  const stats = [
    {
      label: '待巡检设备',
      value: Math.max(0, totalDevices - inspectedToday),
      icon: ClipboardList,
      color: 'bg-primary-500',
      bgLight: 'bg-primary-50',
      textColor: 'text-primary-600',
      path: '/inspections',
    },
    {
      label: '草稿',
      value: draftCount,
      icon: FileCheck,
      color: 'bg-warning-500',
      bgLight: 'bg-warning-50',
      textColor: 'text-warning-600',
      path: '/inspections',
    },
    {
      label: '待同步',
      value: pendingSyncCount,
      icon: RefreshCw,
      color: 'bg-accent-500',
      bgLight: 'bg-accent-50',
      textColor: 'text-accent-600',
      path: '/sync',
    },
    {
      label: '异常',
      value: anomalyCount,
      icon: AlertTriangle,
      color: 'bg-danger-500',
      bgLight: 'bg-danger-50',
      textColor: 'text-danger-600',
      path: '/inspections',
    },
    {
      label: '冲突',
      value: conflictCount,
      icon: Zap,
      color: 'bg-critical-500',
      bgLight: 'bg-critical-500/10',
      textColor: 'text-critical-500',
      path: '/sync',
    },
  ];

  const quickActions =
    role === 'inspector'
      ? [
          { label: '开始巡检', icon: ClipboardList, path: '/inspections', color: 'bg-primary-600 hover:bg-primary-700' },
          { label: '同步中心', icon: RefreshCw, path: '/sync', color: 'bg-accent-500 hover:bg-accent-600' },
          { label: '导出记录', icon: Download, path: '/export', color: 'bg-success-500 hover:bg-success-600' },
          { label: '操作日志', icon: Clock, path: '/logs', color: 'bg-primary-700 hover:bg-primary-800' },
        ]
      : [
          { label: '模板配置', icon: Settings, path: '/templates', color: 'bg-primary-600 hover:bg-primary-700' },
          { label: '设备管理', icon: ClipboardList, path: '/devices', color: 'bg-accent-500 hover:bg-accent-600' },
          { label: '同步中心', icon: RefreshCw, path: '/sync', color: 'bg-success-500 hover:bg-success-600' },
          { label: '操作日志', icon: Clock, path: '/logs', color: 'bg-primary-700 hover:bg-primary-800' },
        ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="text-primary-600 animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      <TopBar title="设备巡检" />

      <div className="p-4 space-y-5 max-w-md mx-auto">
        <div className="grid grid-cols-5 gap-2">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                onClick={() => navigate(stat.path)}
                className={`${stat.bgLight} rounded-xl p-3 flex flex-col items-center gap-2 transition-transform active:scale-95`}
              >
                <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center text-white`}>
                  <Icon size={20} />
                </div>
                <div className="text-center">
                  <div className={`text-xl font-bold ${stat.textColor}`}>{stat.value}</div>
                  <div className="text-[10px] text-primary-700/70 mt-0.5">{stat.label}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <h2 className="text-base font-bold text-primary-800 mb-3">快捷操作</h2>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className={`${action.color} text-white rounded-xl p-3 flex flex-col items-center gap-2 transition-all active:scale-95 shadow-sm`}
                >
                  <Icon size={22} />
                  <span className="text-xs font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-primary-800">今日概览</h2>
            <span className="text-xs text-primary-500">{today}</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-surface-100">
              <span className="text-sm text-primary-700">设备总数</span>
              <span className="text-sm font-medium text-primary-800">{totalDevices} 台</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-surface-100">
              <span className="text-sm text-primary-700">今日已巡检</span>
              <span className="text-sm font-medium text-success-600">{inspectedToday} 台</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-surface-100">
              <span className="text-sm text-primary-700">巡检记录数</span>
              <span className="text-sm font-medium text-primary-800">{todayInspections.length} 条</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-primary-700">离线模式</span>
              <span className={`text-sm font-medium ${offlineMode ? 'text-danger-600' : 'text-success-600'}`}>
                {offlineMode ? '已开启' : '已关闭'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary-700 to-primary-600 rounded-2xl shadow-card p-5 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">离线巡检提示</h3>
              <p className="text-sm text-white/80 leading-relaxed">
                在弱网环境下可正常填写巡检记录，所有数据将保存在本地。恢复网络后进入同步中心一键上传。
              </p>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
