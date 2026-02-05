import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CreatedTicket, EditRow } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { getPersistStorage } from '@/lib/indexedDbStorage';

interface EditStore {
    rows: EditRow[];
    replaceRowsFromImport: (rows: EditRow[]) => void;
    addFromCreatedTickets: (tickets: CreatedTicket[]) => void;
    updateRow: (id: string, data: Partial<EditRow>) => void;
    toggleSelect: (id: string) => void;
    toggleSelectAll: () => void;
    clearRows: () => void;
}

const createEmptyRow = (data: Partial<EditRow>): EditRow => ({
    id: uuidv4(),
    key: data.key || '',
    type: data.type || 'Task',
    status: data.status || '',
    sprint: data.sprint || '',
    assignee: data.assignee || '',
    startDate: data.startDate || '',
    dueDate: data.dueDate || '',
    parentKey: data.parentKey || '',
    summary: data.summary || '',
    description: data.description || '',
    originalSummary: data.originalSummary ?? data.summary ?? '',
    originalDescription: data.originalDescription ?? data.description ?? '',
    selected: data.selected ?? true,
});

export const useEditStore = create<EditStore>()(
    persist(
        (set) => ({
            rows: [],
            replaceRowsFromImport: (rows) => set({
                rows: Array.isArray(rows) ? rows : []
            }),
            addFromCreatedTickets: (tickets) => set((state) => {
                const existingKeys = new Set(state.rows.map(r => r.key));
                const additions = tickets
                    .filter(t => t.status === 'success' && t.jiraKey)
                    .filter(t => !existingKeys.has(t.jiraKey!))
                    .map((t) => createEmptyRow({
                        key: t.jiraKey || '',
                        type: t.type,
                        summary: t.summary,
                        description: '',
                        originalSummary: t.summary,
                        originalDescription: '',
                    }));

                return { rows: [...additions, ...state.rows] };
            }),
            updateRow: (id, data) => set((state) => ({
                rows: state.rows.map(row =>
                    row.id === id ? { ...row, ...data } : row
                )
            })),
            toggleSelect: (id) => set((state) => ({
                rows: state.rows.map(row =>
                    row.id === id ? { ...row, selected: !row.selected } : row
                )
            })),
            toggleSelectAll: () => set((state) => {
                const allSelected = state.rows.length > 0 && state.rows.every(row => row.selected);
                return {
                    rows: state.rows.map(row => ({ ...row, selected: !allSelected }))
                };
            }),
            clearRows: () => set({ rows: [] }),
        }),
        {
            name: 'edit-storage',
            storage: createJSONStorage(() => getPersistStorage()),
        }
    )
);
