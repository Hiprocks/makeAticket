import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TicketRow } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface TicketState {
    rows: TicketRow[];
    addRow: (index?: number, data?: Partial<TicketRow>) => void;
    deleteRows: () => void; // Selected rows
    updateRow: (id: string, data: Partial<TicketRow>) => void;
    copyRow: (id: string) => void;
    setRows: (rows: TicketRow[]) => void;
    toggleSelect: (id: string) => void;
    toggleSelectAll: () => void;
    addSubtasks: (parentId: string, types: string[], parentTitle: string) => void;
    ensureRowCount: (count: number) => void;
    replaceRowsFromImport: (rows: Partial<TicketRow>[]) => void;
    clearRows: () => void;
}

const createEmptyRow = (): TicketRow => ({
    id: uuidv4(),
    selected: true,
    type: 'Task',
    summary: '',
    description: '',
    assignee: '',
    sprint: '',
    startDate: '',
    dueDate: '',
    parentKey: '',
    parentRowId: '',
});

export const useTicketStore = create<TicketState>()(
    persist(
        (set) => ({
            rows: [createEmptyRow()],

            addRow: (index, data) => set((state) => {
                const newRow = { ...createEmptyRow(), ...data };
                const newRows = [...state.rows];
                const insertIndex = index !== undefined ? index + 1 : newRows.length;
                newRows.splice(insertIndex, 0, newRow);
                return { rows: newRows };
            }),

            deleteRows: () => set((state) => ({
                rows: state.rows.filter(row => !row.selected)
            })),

            updateRow: (id, data) => set((state) => ({
                rows: state.rows.map(row =>
                    row.id === id ? { ...row, ...data } : row
                )
            })),

            copyRow: (id) => set((state) => {
                const index = state.rows.findIndex(row => row.id === id);
                if (index === -1) return state;
                const sourceRow = state.rows[index];
                const newRow = {
                    ...sourceRow,
                    id: uuidv4(),
                    selected: true
                };
                const newRows = [...state.rows];
                newRows.splice(index + 1, 0, newRow);
                return { rows: newRows };
            }),

            setRows: (rows) => set({ rows }),

            toggleSelect: (id) => set((state) => ({
                rows: state.rows.map(row =>
                    row.id === id ? { ...row, selected: !row.selected } : row
                )
            })),

            toggleSelectAll: () => set((state) => {
                const allSelected = state.rows.every(row => row.selected);
                return {
                    rows: state.rows.map(row => ({ ...row, selected: !allSelected }))
                };
            }),

            addSubtasks: (parentId, types, parentTitle) => set((state) => {
                const parentIndex = state.rows.findIndex(row => row.id === parentId);
                if (parentIndex === -1) return state;

                const newRows = types.map(type => ({
                    ...createEmptyRow(),
                    summary: `[${type}] ${parentTitle}`,
                    description: '',
                    type: 'Task' as const,
                    parentRowId: parentId,
                }));

                const currentRows = [...state.rows];
                currentRows.splice(parentIndex + 1, 0, ...newRows);
                return { rows: currentRows };
            }),

            ensureRowCount: (count) => set((state) => {
                if (state.rows.length >= count) return state;
                const newRows = [...state.rows];
                while (newRows.length < count) {
                    newRows.push(createEmptyRow());
                }
                return { rows: newRows };
            }),

            replaceRowsFromImport: (rows) => set(() => {
                const normalized: TicketRow[] = (rows || []).map((row) => ({
                    ...createEmptyRow(),
                    ...row,
                    id: row.id || uuidv4(),
                    selected: row.selected ?? true,
                    type: row.type === 'Epic' ? 'Epic' : 'Task',
                }));
                return { rows: normalized.length > 0 ? normalized : [createEmptyRow()] };
            }),
            clearRows: () => set(() => ({ rows: [createEmptyRow()] })),
        }),
        {
            name: 'jbc-draft',
        }
    )
);
