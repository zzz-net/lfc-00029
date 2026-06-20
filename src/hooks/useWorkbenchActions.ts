import { useMemo } from 'react';
import { computeButtonActions } from '@/lib/submissionWorkbench';
import { useStore } from '@/store/useStore';
import type { InspectionRecord, ButtonActionState } from '@/types';

export function useWorkbenchActions(record: InspectionRecord | null): ButtonActionState[] {
  const templates = useStore(s => s.templates);
  const inspections = useStore(s => s.inspections);
  const conflicts = useStore(s => s.conflicts);
  const getRecordMeta = useStore(s => s.getRecordMeta);

  return useMemo(() => {
    if (!record) return [];
    const meta = getRecordMeta(record.id);
    const hasConflict = record.status === 'conflict' ||
      (meta?.hasConflict ?? false) ||
      conflicts.some(c => !c.resolved && (c.localVersion.id === record.id || c.remoteVersion.id === record.id));
    return computeButtonActions(record, templates, inspections, hasConflict);
  }, [record, templates, inspections, conflicts, getRecordMeta]);
}
