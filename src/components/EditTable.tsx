import { useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEditStore } from '@/store/useEditStore';
import { downloadJson, pickCsvFile } from '@/lib/fileStorage';
import { normalizeHeader, parseCsvWithHeaders } from '@/lib/csv';
import { EditPreviewModal } from './EditPreviewModal';
import { EditResultModal } from './EditResultModal';
import { useTicketEdit } from '@/hooks/useTicketEdit';
import type { EditRow } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const HEADER_CANDIDATES = {
    key: ['issuekey', 'issue key', 'key', 'jirakey', 'jira key', 'issueid', 'id'],
    summary: ['summary', 'summarytext', 'title', '요약'],
    description: ['description', 'descriptiontext', 'details', '설명', '상세'],
    type: ['issuetype', 'type', '이슈유형'],
    status: ['status', 'issuestatus', 'state', '상태'],
    sprint: ['sprint', 'sprintname'],
    assignee: ['assignee', 'assigneeid', 'assigneeaccountid', '담당자', '담당자id'],
    startDate: ['startdate', 'start date', 'start'],
    dueDate: ['duedate', 'due date', 'due', '기한'],
    parentKey: ['parent', 'parentkey', 'epiclink', 'epic link'],
};

export function EditTable() {
    const { rows, replaceRowsFromImport, updateRow, toggleSelect, toggleSelectAll, clearRows } = useEditStore();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [resultOpen, setResultOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSprint, setActiveSprint] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<'none' | 'summary' | 'status'>('none');
    const { isUpdating, progress, result, startUpdate, resetUpdate } = useTicketEdit();

    const sprintOptions = useMemo(() => {
        const seen = new Set<string>();
        const options: string[] = [];
        rows.forEach((row) => {
            const sprint = (row.sprint || '').trim();
            if (sprint && !seen.has(sprint)) {
                seen.add(sprint);
                options.push(sprint);
            }
        });
        return options;
    }, [rows]);

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return rows.filter((row) => {
            if (term && !row.summary.toLowerCase().includes(term)) return false;
            if (activeSprint && row.sprint !== activeSprint) return false;
            return true;
        });
    }, [rows, searchTerm, activeSprint]);

    const sortedRows = useMemo(() => {
        if (sortKey === 'none') return filteredRows;
        const copy = [...filteredRows];
        if (sortKey === 'summary') {
            copy.sort((a, b) => a.summary.localeCompare(b.summary, undefined, { sensitivity: 'base' }));
        } else if (sortKey === 'status') {
            copy.sort((a, b) => (a.status || '').localeCompare(b.status || '', undefined, { sensitivity: 'base' }));
        }
        return copy;
    }, [filteredRows, sortKey]);

    const hasStatus = useMemo(() => rows.some(row => (row.status || '').trim()), [rows]);

    const changedRows = useMemo(
        () => rows.filter(r => r.selected && (r.summary !== r.originalSummary || r.description !== r.originalDescription)),
        [rows]
    );

    useEffect(() => {
        if (activeSprint && !sprintOptions.includes(activeSprint)) {
            setActiveSprint(null);
        }
    }, [activeSprint, sprintOptions]);

    useEffect(() => {
        if (isUpdating || result) setResultOpen(true);
    }, [isUpdating, result]);

    useEffect(() => {
        if (!result) return;
        result.tickets
            .filter(t => t.status === 'success')
            .forEach((ticket) => {
                updateRow(ticket.rowId, {
                    originalSummary: ticket.summary,
                    originalDescription: ticket.description,
                });
            });
    }, [result, updateRow]);

    const handleConfirmUpdate = () => {
        setPreviewOpen(false);
        startUpdate(changedRows);
    };

    const handleCloseResult = () => {
        setResultOpen(false);
        resetUpdate();
    };

    const handleImportCsv = async () => {
        try {
            const text = await pickCsvFile();
            const { headers, rows: dataRows } = parseCsvWithHeaders(text);
            if (headers.length === 0) throw new Error('No headers found');

            const normalized = headers.map(normalizeHeader);
            const guessKeyIndexFromData = () => {
                if (dataRows.length === 0) return -1;
                const sampleSize = Math.min(dataRows.length, 50);
                const columnCount = headers.length;
                const scores = new Array(columnCount).fill(0);
                const keyPattern = /^[A-Z][A-Z0-9]+-\d+$/i;
                for (let r = 0; r < sampleSize; r++) {
                    const row = dataRows[r] || [];
                    for (let c = 0; c < columnCount; c++) {
                        const value = (row[c] || '').trim();
                        if (keyPattern.test(value)) {
                            scores[c] += 1;
                        }
                    }
                }
                let bestIndex = -1;
                let bestScore = 0;
                for (let c = 0; c < columnCount; c++) {
                    if (scores[c] > bestScore) {
                        bestScore = scores[c];
                        bestIndex = c;
                    }
                }
                return bestScore > 0 ? bestIndex : -1;
            };
            const guessTextIndexFromData = (exclude: number[]) => {
                if (dataRows.length === 0) return -1;
                const sampleSize = Math.min(dataRows.length, 50);
                const columnCount = headers.length;
                const scores = new Array(columnCount).fill(0);
                for (let r = 0; r < sampleSize; r++) {
                    const row = dataRows[r] || [];
                    for (let c = 0; c < columnCount; c++) {
                        if (exclude.includes(c)) continue;
                        const value = (row[c] || '').trim();
                        if (!value) continue;
                        if (/^\d+$/.test(value)) continue;
                        scores[c] += value.length;
                    }
                }
                let bestIndex = -1;
                let bestScore = 0;
                for (let c = 0; c < columnCount; c++) {
                    if (scores[c] > bestScore) {
                        bestScore = scores[c];
                        bestIndex = c;
                    }
                }
                return bestScore > 0 ? bestIndex : -1;
            };
            const headerIndex = (candidates: string[]) => {
                for (const candidate of candidates) {
                    const idx = normalized.indexOf(normalizeHeader(candidate));
                    if (idx !== -1) return idx;
                }
                return -1;
            };

            let keyIndex = headerIndex(HEADER_CANDIDATES.key);
            let summaryIndex = headerIndex(HEADER_CANDIDATES.summary);
            let descriptionIndex = headerIndex(HEADER_CANDIDATES.description);
            const typeIndex = headerIndex(HEADER_CANDIDATES.type);
            const statusIndex = headerIndex(HEADER_CANDIDATES.status);
            const sprintIndex = headerIndex(HEADER_CANDIDATES.sprint);
            const assigneeIndex = headerIndex(HEADER_CANDIDATES.assignee);
            const startDateIndex = headerIndex(HEADER_CANDIDATES.startDate);
            const dueDateIndex = headerIndex(HEADER_CANDIDATES.dueDate);
            const parentKeyIndex = headerIndex(HEADER_CANDIDATES.parentKey);

            if (keyIndex === -1) {
                const fallbackIndex = normalized.findIndex((value) => {
                    if (value === 'parentkey') return false;
                    if (value === 'key') return true;
                    return value.includes('issue') && value.includes('key');
                });
                if (fallbackIndex !== -1) keyIndex = fallbackIndex;
            }

            if (keyIndex === -1) {
                keyIndex = guessKeyIndexFromData();
            }

            if (summaryIndex === -1) {
                const exclude = [keyIndex, typeIndex, statusIndex, sprintIndex, assigneeIndex, startDateIndex, dueDateIndex, parentKeyIndex].filter(i => i >= 0);
                summaryIndex = guessTextIndexFromData(exclude);
            }

            // Description should only map when explicit header is present.
            if (descriptionIndex === -1) {
                descriptionIndex = -1;
            }

            if (keyIndex === -1) {
                throw new Error('CSV must include Issue Key column');
            }

            const mapped: EditRow[] = dataRows
                .map((row) => {
                    const key = (row[keyIndex] || '').trim();
                    if (!key) return null;
                    const summary = summaryIndex >= 0 ? (row[summaryIndex] || '').trim() : '';
                    const description = descriptionIndex >= 0 ? (row[descriptionIndex] || '').trim() : '';
                    const rawType = typeIndex >= 0 ? (row[typeIndex] || '').trim() : 'Task';
                    const compactType = rawType.replace(/\s+/g, '');
                    const normalizedType =
                        compactType === '작업' ? 'Task' :
                        compactType === '에픽' ? 'Epic' :
                        compactType === '해야할일' ? 'Task' :
                        rawType;
                    const type = normalizedType;
                    const status = statusIndex >= 0 ? (row[statusIndex] || '').trim() : '';
                    const sprint = sprintIndex >= 0 ? (row[sprintIndex] || '').trim() : '';
                    const assignee = assigneeIndex >= 0 ? (row[assigneeIndex] || '').trim() : '';
                    const startDate = startDateIndex >= 0 ? (row[startDateIndex] || '').trim() : '';
                    const dueDate = dueDateIndex >= 0 ? (row[dueDateIndex] || '').trim() : '';
                    const parentKey = parentKeyIndex >= 0 ? (row[parentKeyIndex] || '').trim() : '';
                    return {
                        id: uuidv4(),
                        key,
                        type: type || 'Task',
                        status,
                        sprint,
                        assignee,
                        startDate,
                        dueDate,
                        parentKey,
                        summary,
                        description,
                        originalSummary: summary,
                        originalDescription: description,
                        selected: true,
                    };
                })
                .filter(Boolean) as EditRow[];

            replaceRowsFromImport(mapped);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            alert(`Import failed: ${message}`);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            <EditPreviewModal
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                rows={changedRows}
                onConfirm={handleConfirmUpdate}
            />
            <EditResultModal
                open={resultOpen}
                onOpenChange={setResultOpen}
                isUpdating={isUpdating}
                progress={progress}
                result={result}
                onClose={handleCloseResult}
            />

            <div className="flex items-center justify-between p-2 border-b bg-slate-50">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground mr-2">
                        Selected tickets: {rows.length}
                    </span>
                    <Button variant="outline" size="sm" onClick={handleImportCsv}>
                        Import
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadJson('jbc-edit.json', { version: 1, rows })}>
                        Export
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (confirm('Clear all edit rows?')) clearRows();
                        }}
                    >
                        Clear
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-slate-50">
                <div className="flex items-center gap-2">
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-9 w-56"
                        placeholder="Search summary..."
                    />
                </div>
                {sprintOptions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant={activeSprint ? "outline" : "secondary"}
                            size="sm"
                            onClick={() => setActiveSprint(null)}
                        >
                            All sprints
                        </Button>
                        {sprintOptions.map((sprint) => (
                            <Button
                                key={sprint}
                                variant={activeSprint === sprint ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => setActiveSprint(sprint)}
                            >
                                {sprint}
                            </Button>
                        ))}
                    </div>
                )}
                <div className="ml-auto">
                    <Select value={sortKey} onValueChange={(value) => setSortKey(value as typeof sortKey)}>
                        <SelectTrigger className="h-9 w-40">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No sorting</SelectItem>
                            <SelectItem value="summary">Name (summary)</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-[40px_120px_100px_1fr_1fr_120px_100px_120px_120px_120px_80px] gap-0 border-b bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0 z-10">
                    <div className="p-2 text-center border-r">
                        <Checkbox checked={rows.length > 0 && rows.every(r => r.selected)} onCheckedChange={toggleSelectAll} />
                    </div>
                    <div className="p-2 border-r">Issue Key</div>
                    <div className="p-2 border-r">Type</div>
                    <div className="p-2 border-r">Summary</div>
                    <div className="p-2 border-r">Description</div>
                    <div className="p-2 border-r">Assignee</div>
                    <div className="p-2 border-r">Sprint</div>
                    <div className="p-2 border-r">Start</div>
                    <div className="p-2 border-r">Due</div>
                    <div className="p-2 border-r">Parent</div>
                    <div className="p-2 text-center">Action</div>
                </div>
                {rows.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        Import Jira CSV to start editing.
                    </div>
                ) : (
                    sortedRows.map((row) => {
                        const summaryChanged = row.summary !== row.originalSummary;
                        const descriptionChanged = row.description !== row.originalDescription;

                        return (
                            <div key={row.id} className="grid grid-cols-[40px_120px_100px_1fr_1fr_120px_100px_120px_120px_120px_80px] gap-0 border-b hover:bg-slate-50 transition-colors group items-stretch">
                                <div className="flex items-center justify-center border-r p-2 bg-white group-hover:bg-slate-50">
                                    <Checkbox checked={row.selected} onCheckedChange={() => toggleSelect(row.id)} />
                                </div>
                                <div className="p-1 border-r">
                                    <Input
                                        value={row.key}
                                        onChange={(e) => updateRow(row.id, { key: e.target.value })}
                                        className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs font-mono"
                                        placeholder="Issue Key"
                                    />
                                </div>
                                <div className="p-1 border-r">
                                    <Input
                                        value={row.type || ''}
                                        onChange={(e) => updateRow(row.id, { type: e.target.value })}
                                        className={`h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs font-medium ${
                                            row.type === 'Epic' ? "text-purple-700" : row.type === 'Task' ? "text-blue-700" : "text-foreground"
                                        }`}
                                        placeholder="Type"
                                    />
                                    {hasStatus && (
                                        <Input
                                            value={row.status || ''}
                                            onChange={(e) => updateRow(row.id, { status: e.target.value })}
                                            className="h-6 border-0 focus-visible:ring-0 rounded-none bg-transparent text-[11px] text-muted-foreground"
                                            placeholder="Status"
                                        />
                                    )}
                                </div>
                                <div className="p-1 border-r">
                                    <Input
                                        value={row.summary}
                                        onChange={(e) => updateRow(row.id, { summary: e.target.value })}
                                        className={`h-full border-0 focus-visible:ring-0 rounded-none bg-transparent ${summaryChanged ? 'bg-amber-50' : ''}`}
                                        placeholder="Summary"
                                    />
                                </div>
                                <div className="p-1 border-r">
                                    <Textarea
                                        value={row.description}
                                        onChange={(e) => updateRow(row.id, { description: e.target.value })}
                                        className={`h-full min-h-[40px] border-0 focus-visible:ring-0 rounded-none bg-transparent resize-none py-2 leading-tight ${descriptionChanged ? 'bg-amber-50' : ''}`}
                                        placeholder="Description"
                                    />
                                </div>
                                <div className="p-1 border-r">
                                    <Input
                                        value={row.assignee || ''}
                                        onChange={(e) => updateRow(row.id, { assignee: e.target.value })}
                                        className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs"
                                        placeholder="Assignee"
                                    />
                                </div>
                                <div className="p-1 border-r">
                                    <Input
                                        value={row.sprint || ''}
                                        onChange={(e) => updateRow(row.id, { sprint: e.target.value })}
                                        className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs"
                                        placeholder="Sprint"
                                    />
                                </div>
                                <div className="p-1 border-r">
                                    <Input
                                        value={row.startDate || ''}
                                        onChange={(e) => updateRow(row.id, { startDate: e.target.value })}
                                        className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs"
                                        placeholder="Start"
                                    />
                                </div>
                                <div className="p-1 border-r">
                                    <Input
                                        value={row.dueDate || ''}
                                        onChange={(e) => updateRow(row.id, { dueDate: e.target.value })}
                                        className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs"
                                        placeholder="Due"
                                    />
                                </div>
                                <div className="p-1 border-r">
                                    <Input
                                        value={row.parentKey || ''}
                                        onChange={(e) => updateRow(row.id, { parentKey: e.target.value })}
                                        className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs"
                                        placeholder="Parent"
                                    />
                                </div>
                                <div className="p-2 text-xs text-center text-muted-foreground">-</div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="flex items-center justify-between p-4 border-t bg-slate-50">
                <div className="text-sm text-muted-foreground">
                    Changes selected: {changedRows.length}
                </div>
                <div className="flex gap-2">
                    <Button
                        className="bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => setPreviewOpen(true)}
                        disabled={changedRows.length === 0 || isUpdating}
                    >
                        Update
                    </Button>
                </div>
            </div>
        </div>
    );
}



