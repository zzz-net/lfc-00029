import { Wifi, WifiOff, User, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { appConfig } from '@/config/appConfig';
import type { UserRole } from '@/types';

export default function TopBar({ title }: { title: string }) {
  const { role, offlineMode, networkStatus, currentUserName, setRole, setOfflineMode } = useStore();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${title} - ${appConfig.productName}`;
  }, [title]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isOnline = networkStatus === 'online' && !offlineMode;

  const roles: { value: UserRole; label: string }[] = [
    { value: 'inspector', label: '巡检员' },
    { value: 'admin', label: '管理员' },
  ];

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-surface-200">
      {offlineMode && (
        <div className="bg-danger-500 text-white text-xs text-center py-1.5 font-medium">
          {appConfig.offline.enabledText}
        </div>
      )}
      <div className="flex items-center justify-between px-4 h-14">
        <h1 className="text-lg font-bold text-primary-800">{title}</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOfflineMode(!offlineMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isOnline
                  ? 'bg-success-50 text-success-600 hover:bg-success-100'
                  : 'bg-danger-50 text-danger-600 hover:bg-danger-100'
              }`}
            >
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              {isOnline ? '在线' : '离线'}
            </button>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 text-primary-700 text-xs font-medium hover:bg-surface-200 transition-colors"
            >
              <User size={14} />
              {currentUserName}
              <ChevronDown size={14} className={`transition-transform ${showRoleMenu ? 'rotate-180' : ''}`} />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-card border border-surface-200 overflow-hidden">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => {
                      setRole(r.value);
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface-50 transition-colors ${
                      role === r.value
                        ? 'text-primary-600 font-medium bg-primary-50'
                        : 'text-primary-800'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
