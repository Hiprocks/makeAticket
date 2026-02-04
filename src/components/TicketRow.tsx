import { memo, type ChangeEvent, type ClipboardEvent } from 'react';
import type { TicketRow as TicketRowType } from '@/types';
import { useTicketStore } from '@/store/useTicketStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Copy, Plus } from 'lucide-react';
import { cn } from "@/lib/utils";

interface TicketRowProps {
    row: TicketRowType;
    index: number;
    onAddSubtask?: () => void;
    onOpenUsers?: () => void;
    onDescriptionTab?: (index: number) => void;
}

const COLUMN_FIELDS: Array<keyof TicketRowType> = [
    'type',
    'summary',
    'description',
    'assignee',
    'sprint',
    'startDate',
    'dueDate',
    'parentKey',
];

export const TicketRow = memo(function TicketRow({ row, index, onAddSubtask, onDescriptionTab }: TicketRowProps) {
    const { updateRow, copyRow, toggleSelect, ensureRowCount } = useTicketStore();
    const { users } = useSettingsStore() as any;

    // Grid layout matching the header
    const gridClass = "grid grid-cols-[40px_100px_1fr_1fr_120px_100px_120px_120px_120px_80px] gap-0 border-b hover:bg-slate-50 transition-colors group items-stretch";

    const handleChange = (field: keyof TicketRowType, value: any) => {
        updateRow(row.id, { [field]: value });
    };

    const handlePaste = (field: keyof TicketRowType) => (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text/plain');
        if (!text) return;

        const startCol = COLUMN_FIELDS.indexOf(field);
        if (startCol === -1) return;

        e.preventDefault();

        const grid = parseClipboard(text);
        if (grid.length === 0) return;

        ensureRowCount(index + grid.length);
        const updatedRows = useTicketStore.getState().rows;

        grid.forEach((rowCells, rowOffset) => {
            const targetRow = updatedRows[index + rowOffset];
            if (!targetRow) return;

            rowCells.forEach((cell, colOffset) => {
                const fieldKey = COLUMN_FIELDS[startCol + colOffset];
                if (!fieldKey) return;

                const value = cell;
                if (fieldKey === 'type') {
                    const lower = value.toLowerCase();
                    if (lower.startsWith('e')) {
                        updateRow(targetRow.id, { type: 'Epic' });
                    } else if (lower.startsWith('t')) {
                        updateRow(targetRow.id, { type: 'Task' });
                    }
                    return;
                }

                if (fieldKey === 'startDate' || fieldKey === 'dueDate') {
                    updateRow(targetRow.id, { [fieldKey]: normalizeDateInput(value) });
                    return;
                }

                updateRow(targetRow.id, { [fieldKey]: value });
            });
        });
    };

    const isChildTask = row.type === 'Task' && !!row.parentRowId;

    return (
        <div className={gridClass}>
            {/* Checkbox */}
            <div className="flex items-center justify-center border-r p-2 bg-white group-hover:bg-slate-50">
                <Checkbox
                    checked={row.selected}
                    onCheckedChange={() => toggleSelect(row.id)}
                />
            </div>

            {/* Type */}
            <div className="p-1 border-r">
                <Select
                    value={row.type}
                    onValueChange={(val: 'Epic' | 'Task') => handleChange('type', val)}
                >
                    <SelectTrigger
                        className={cn(
                            "h-full border-0 focus:ring-0 rounded-none bg-white",
                            row.type === 'Epic' ? "text-purple-700" : "text-blue-700"
                        )}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Task" className="text-blue-700">Task</SelectItem>
                        <SelectItem value="Epic" className="text-purple-700">Epic</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Summary */}
            <div className="p-1 border-r">
                <Input
                    value={row.summary}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('summary', e.target.value)}
                    onPaste={handlePaste('summary')}
                    data-summary-index={index}
                    className={cn(
                        "h-full border-0 focus-visible:ring-0 rounded-none bg-transparent",
                        isChildTask && "pl-6"
                    )}
                    placeholder="Summary"
                />
            </div>

            {/* Description */}
            <div className="p-1 border-r">
                <Textarea
                    value={row.description}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleChange('description', e.target.value)}
                    onPaste={handlePaste('description')}
                    onKeyDown={(e) => {
                        if (e.key === 'Tab' && !e.shiftKey) {
                            e.preventDefault();
                            onDescriptionTab?.(index);
                        }
                    }}
                    className="h-full min-h-[40px] border-0 focus-visible:ring-0 rounded-none bg-transparent resize-none py-2 leading-tight"
                    placeholder="Description"
                />
            </div>

            {/* Assignee */}
            <div className="p-1 border-r flex items-center gap-1">
                <Select
                    value={row.assignee}
                    onValueChange={(val: string) => handleChange('assignee', val)}
                >
                    <SelectTrigger className="h-full border-0 focus:ring-0 rounded-none bg-transparent text-xs p-2">
                        <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users?.map((user: any) => (
                            <SelectItem key={user.accountId} value={user.accountId}>
                                {user.displayName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Sprint */}
            <div className="p-1 border-r">
                <Input
                    value={row.sprint}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('sprint', e.target.value)}
                    onPaste={handlePaste('sprint')}
                    className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs"
                    placeholder="Sprint"
                />
            </div>

            {/* Start Date */}
            <div className="p-1 border-r">
                <Input
                    value={row.startDate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('startDate', normalizeDateInput(e.target.value))}
                    onPaste={handlePaste('startDate')}
                    className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs"
                    placeholder="YYYY-MM-DD"
                />
            </div>

            {/* Due Date */}
            <div className="p-1 border-r">
                <Input
                    value={row.dueDate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('dueDate', normalizeDateInput(e.target.value))}
                    onPaste={handlePaste('dueDate')}
                    className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs"
                    placeholder="YYYY-MM-DD"
                />
            </div>

            {/* Parent */}
            <div className="p-1 border-r">
                <Input
                    value={row.parentKey}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('parentKey', e.target.value)}
                    onPaste={handlePaste('parentKey')}
                    className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs"
                    placeholder="Parent key"
                    disabled={row.type === 'Epic'}
                />
            </div>

            {/* Actions */}
            <div className="p-1 flex items-center justify-center gap-1">
                {row.type === 'Task' ? (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyRow(row.id)} title="Copy">
                        <Copy className="h-3 w-3" />
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddSubtask} title="Add subtasks">
                        <Plus className="h-3 w-3" />
                    </Button>
                )}
            </div>
        </div>
    );
});

function normalizeDateInput(value: string) {
    const trimmed = value.trim();
    const digitsOnly = trimmed.replace(/[^0-9]/g, '');
    if (digitsOnly.length === 8) {
        const yyyy = digitsOnly.slice(0, 4);
        const mm = digitsOnly.slice(4, 6);
        const dd = digitsOnly.slice(6, 8);
        return `${yyyy}-${mm}-${dd}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    return trimmed;
}

function parseClipboard(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        const next = normalized[i + 1];

        if (ch === '"') {
            if (inQuotes && next === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (!inQuotes && ch === '\t') {
            row.push(cell);
            cell = '';
            continue;
        }

        if (!inQuotes && ch === '\n') {
            row.push(cell);
            if (row.length > 1 || row[0] !== '') {
                rows.push(row);
            }
            row = [];
            cell = '';
            continue;
        }

        cell += ch;
    }

    row.push(cell);
    if (row.length > 1 || row[0] !== '') {
        rows.push(row);
    }

    return rows;
}
