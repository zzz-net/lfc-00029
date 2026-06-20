import { useState } from 'react';
import { Search, MapPin, Tag, Cpu, Plus } from 'lucide-react';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import { useStore } from '@/store/useStore';

const statusConfig = {
  normal: { label: '正常', color: 'bg-success-100 text-success-600' },
  maintenance: { label: '维护中', color: 'bg-warning-100 text-warning-600' },
  offline: { label: '停用', color: 'bg-surface-100 text-surface-300' },
};

export default function Devices() {
  const { devices } = useStore();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  const categories = Array.from(new Set(devices.map((d) => d.category)));

  const filteredDevices = devices.filter((d) => {
    const matchSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || d.category === filterCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      <TopBar title="设备管理" />

      <div className="p-4 space-y-3 max-w-md mx-auto">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索设备名称/编号"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm bg-white"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <button
            onClick={() => setFilterCategory('')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !filterCategory
                ? 'bg-primary-600 text-white'
                : 'bg-white text-primary-600 border border-surface-200'
            }`}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterCategory === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-primary-600 border border-surface-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredDevices.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-card p-8 text-center">
              <Cpu size={48} className="mx-auto text-surface-200 mb-3" />
              <p className="text-primary-400 text-sm">暂无设备</p>
            </div>
          ) : (
            filteredDevices.map((device) => {
              const status = statusConfig[device.status];
              return (
                <div
                  key={device.id}
                  className="bg-white rounded-2xl shadow-card p-4 hover:shadow-card-hover transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-primary-800">{device.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-primary-500 mt-1 font-mono">{device.code}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-primary-600">
                    <div className="flex items-center gap-1">
                      <MapPin size={14} className="text-primary-400" />
                      {device.location}
                    </div>
                    <div className="flex items-center gap-1">
                      <Tag size={14} className="text-primary-400" />
                      {device.category}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
