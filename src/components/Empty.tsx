import { cn } from '@/lib/utils';
import { FileText, type LucideIcon } from 'lucide-react';

interface EmptyProps {
  text?: string;
  icon?: LucideIcon;
  className?: string;
}

export default function Empty({ text = '暂无数据', icon: Icon = FileText, className }: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-10 px-4', className)}>
      <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mb-3">
        <Icon size={28} className="text-primary-300" />
      </div>
      <p className="text-sm text-primary-400">{text}</p>
    </div>
  );
}
