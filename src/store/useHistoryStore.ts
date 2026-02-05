import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CreationRecord } from '@/types';
import { getPersistStorage } from '@/lib/indexedDbStorage';

interface HistoryStore {
    records: CreationRecord[];
    addRecord: (record: CreationRecord) => void;
    clearHistory: () => void;
    replaceRecordsFromImport: (records: CreationRecord[]) => void;
}

export const useHistoryStore = create<HistoryStore>()(
    persist(
        (set) => ({
            records: [],
            addRecord: (record) => set((state) => ({
                records: [record, ...state.records]
            })),
            clearHistory: () => set({ records: [] }),
            replaceRecordsFromImport: (records) => set({
                records: Array.isArray(records) ? records : []
            }),
        }),
        {
            name: 'history-storage',
            storage: createJSONStorage(() => getPersistStorage()),
        }
    )
);
