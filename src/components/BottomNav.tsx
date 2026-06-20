import { Home, ClipboardList, RefreshCw, FileText, Settings, LayoutDashboard, Briefcase, type LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';

interface TabItem {
  path: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
}

export default function BottomNav() {
  const location = useLocation();
  const { role, offlineMode, conflicts, inspections } = useStore();

  const isInspector = role === 'inspector';
  const conflictCount = conflicts.filter(c => !c.resolved).length;
  const pendingSyncCount = inspections.filter(r => r.status === 'submitted').length;

  const inspectorTabs: TabItem[] = [
    { path: '/', icon: Home, label: '首页' },
    { path: '/inspections', icon: ClipboardList, label: '巡检' },
    { path: '/submission-workbench', icon: Briefcase, label: '工作台', badge: pendingSyncCount + conflictCount },
    { path: '/status-desk', icon: LayoutDashboard, label: '状态台', badge: pendingSyncCount + conflictCount },
    { path: '/sync', icon: RefreshCw, label: '同步', badge: conflictCount },
  ];

  const adminTabs: TabItem[] = [
    { path: '/', icon: Home, label: '首页' },
    { path: '/templates', icon: ClipboardList, label: '模板' },
    { path: '/devices', icon: Settings, label: '设备' },
    { path: '/submission-workbench', icon: Briefcase, label: '工作台' },
    { path: '/sync', icon: RefreshCw, label: '同步' },
  ];

  const tabs = isInspector ? inspectorTabs : adminTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 safe-bottom z-50 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          const badge = tab.badge || 0;

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
                isActive
                  ? 'text-primary-600'
                  : 'text-surface-300 hover:text-primary-500'
              }`}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-accent-500 text-white text-[10px] font-medium rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className="text-xs mt-1 font-medium">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
