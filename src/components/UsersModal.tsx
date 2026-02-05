import { useState, type ClipboardEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from '@/store/useSettingsStore';
import type { JiraUser } from '@/types';
import { Plus, Trash2 } from 'lucide-react';
import { downloadJson, pickJsonFile } from '@/lib/fileStorage';

interface UsersModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UsersModal({ open, onOpenChange }: UsersModalProps) {
    const { users, setCache } = useSettingsStore();
    const [draft, setDraft] = useState<JiraUser[]>([]);
    const [warning, setWarning] = useState<string | null>(null);

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            setDraft(users.length > 0 ? users : []);
            setWarning(null);
        }
        onOpenChange(nextOpen);
    };

    const handleChange = (index: number, field: keyof JiraUser, value: string) => {
        setDraft(prev => prev.map((u, i) => (i === index ? { ...u, [field]: value } : u)));
    };

    const handlePaste = (startIndex: number, field: keyof JiraUser) => (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text/plain');
        if (!text) return;
        e.preventDefault();

        const grid = parseClipboard(text);
        if (grid.length === 0) return;

        setDraft(prev => {
            const updated = [...prev];
            const startCol = field === 'displayName' ? 0 : 1;

            while (updated.length < startIndex + grid.length) {
                updated.push({ accountId: '', displayName: '', emailAddress: '' });
            }

            grid.forEach((rowCells, rowOffset) => {
                const targetIndex = startIndex + rowOffset;
                const existing = updated[targetIndex] || { accountId: '', displayName: '', emailAddress: '' };
                const nameCell = rowCells[startCol] ?? '';
                const idCell = rowCells[startCol + 1] ?? '';
                const next = {
                    ...existing,
                    displayName: nameCell.trim(),
                    accountId: idCell.trim(),
                };
                updated[targetIndex] = next;
            });

            return updated;
        });
    };

    const handleAdd = () => {
        setDraft(prev => [
            ...prev,
            { accountId: '', displayName: '', emailAddress: '' }
        ]);
    };

    const handleRemove = (index: number) => {
        setDraft(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        const sanitized = draft
            .map(u => ({
                accountId: u.accountId.trim(),
                displayName: u.displayName.trim(),
                emailAddress: ''
            }))
            .filter(u => u.accountId && u.displayName);
        const { unique, dropped } = dedupeUsers(sanitized);
        setCache({ users: unique });
        if (dropped > 0) {
            setWarning(`Removed ${dropped} duplicate entr${dropped === 1 ? 'y' : 'ies'}.`);
            return;
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>User Management</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">Name / JiraID</div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadJson('jbc-users.json', { version: 1, users: draft })}
                            >
                                Export
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    try {
                                        const data = await pickJsonFile();
                                        const imported =
                                            typeof data === 'object' && data !== null && 'users' in data && Array.isArray((data as { users: unknown[] }).users)
                                                ? (data as { users: unknown[] }).users
                                                : Array.isArray(data)
                                                    ? data
                                                    : [];
                                        setDraft(imported.map((u) => {
                                            const obj = typeof u === 'object' && u !== null ? (u as Record<string, unknown>) : {};
                                            return {
                                                accountId: String(obj.accountId ?? ''),
                                                displayName: String(obj.displayName ?? ''),
                                                emailAddress: '',
                                            };
                                        }));
                                    } catch (err: unknown) {
                                        const message = err instanceof Error ? err.message : String(err);
                                        alert(`Import failed: ${message}`);
                                    }
                                }}
                            >
                                Import
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleAdd}>
                                <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                        </div>
                    </div>

                    <div
                        className="border rounded-md overflow-hidden"
                        onPaste={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
                            handlePaste(0, 'displayName')(e);
                        }}
                    >
                        <div className="grid grid-cols-[1fr_1fr_40px] bg-slate-50 text-xs text-muted-foreground border-b">
                            <div className="p-2">Name</div>
                            <div className="p-2">Jira ID</div>
                            <div className="p-2"></div>
                        </div>
                        {draft.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground">No users yet.</div>
                        ) : (
                            draft.map((user, index) => (
                                <div key={index} className="grid grid-cols-[1fr_1fr_40px] border-b last:border-b-0">
                                    <div className="p-2">
                                        <Input
                                            value={user.displayName}
                                            onChange={(e) => handleChange(index, 'displayName', e.target.value)}
                                            onPaste={handlePaste(index, 'displayName')}
                                            placeholder="Name"
                                        />
                                    </div>
                                    <div className="p-2">
                                        <Input
                                            value={user.accountId}
                                            onChange={(e) => handleChange(index, 'accountId', e.target.value)}
                                            onPaste={handlePaste(index, 'accountId')}
                                            placeholder="Jira ID"
                                        />
                                    </div>
                                    <div className="p-2 flex items-center justify-center">
                                        <Button variant="ghost" size="icon" onClick={() => handleRemove(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {warning && (
                        <div className="text-sm text-amber-600">{warning}</div>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
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

function dedupeUsers(users: JiraUser[]) {
    const seenId = new Set<string>();
    const seenName = new Set<string>();
    const unique: JiraUser[] = [];
    let dropped = 0;

    for (const user of users) {
        const idKey = user.accountId.toLowerCase();
        const nameKey = user.displayName.toLowerCase();
        if (seenId.has(idKey) || seenName.has(nameKey)) {
            dropped++;
            continue;
        }
        seenId.add(idKey);
        seenName.add(nameKey);
        unique.push(user);
    }

    return { unique, dropped };
}
