import { useState } from 'react';
import { useTicketStore } from '@/store/useTicketStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { jiraService } from '@/services/jiraService';
import type { CreationRecord, CreatedTicket } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function useTicketCreation() {
    const { rows } = useTicketStore();
    const { addRecord } = useHistoryStore();
    const { projectKey, jiraUrl, users } = useSettingsStore();

    const [isCreating, setIsCreating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
    const [result, setResult] = useState<CreationRecord | null>(null);

    const startCreation = async () => {
        const selectedRows = rows.filter(r => r.selected);
        if (selectedRows.length === 0) return;

        setIsCreating(true);
        setProgress({ current: 0, total: selectedRows.length, message: 'Preparing...' });

        const createdTickets: CreatedTicket[] = [];
        let successDate = 0;
        let failCount = 0;

        const rowIdToKey = new Map<string, string>();

        try {
            for (let i = 0; i < selectedRows.length; i++) {
                const row = selectedRows[i];
                setProgress({
                    current: i + 1,
                    total: selectedRows.length,
                    message: `${row.type} creating: ${row.summary}`
                });

                try {
                    if (!row.summary.trim()) {
                        throw new Error('Summary is required');
                    }

                    if (row.parentRowId && rowIdToKey.has(row.parentRowId)) {
                        row.parentKey = rowIdToKey.get(row.parentRowId)!;
                    }

                    const resolvedAssignee = resolveAssignee(row.assignee, users);
                    const ticket = { ...row, assignee: resolvedAssignee };

                    let key = '';
                    if (row.type === 'Epic') {
                        key = await jiraService.createEpic(ticket);
                        rowIdToKey.set(row.id, key);
                    } else {
                        key = await jiraService.createTask(ticket);
                    }

                    createdTickets.push({
                        rowId: row.id,
                        type: row.type,
                        summary: row.summary,
                        assignee: resolvedAssignee,
                        parentKey: row.parentKey,
                        jiraKey: key,
                        status: 'success',
                        errorMessage: null
                    });
                    successDate++;
                } catch (error: any) {
                    console.error('Creation failed', error);
                    failCount++;
                    createdTickets.push({
                        rowId: row.id,
                        type: row.type,
                        summary: row.summary,
                        assignee: row.assignee,
                        parentKey: row.parentKey,
                        jiraKey: null,
                        status: 'failed',
                        errorMessage: error.message || 'Unknown error'
                    });
                }
            }

            const record: CreationRecord = {
                id: uuidv4(),
                createdAt: new Date().toISOString(),
                projectKey: projectKey,
                jiraUrl: jiraUrl,
                epicCount: selectedRows.filter(r => r.type === 'Epic').length,
                taskCount: selectedRows.filter(r => r.type === 'Task').length,
                successCount: successDate,
                failCount: failCount,
                tickets: createdTickets
            };
            addRecord(record);
            setResult(record);
        } finally {
            setIsCreating(false);
        }
    };

    const resetCreation = () => {
        setResult(null);
        setProgress({ current: 0, total: 0, message: '' });
    };

    return {
        isCreating,
        progress,
        result,
        startCreation,
        resetCreation
    };
}

function resolveAssignee(
    value: string,
    users: { accountId: string; displayName: string; emailAddress: string }[]
) {
    if (!value) return '';
    const direct = users.find(u => u.accountId === value);
    if (direct) return direct.accountId;
    const byName = users.find(u => u.displayName.toLowerCase() === value.toLowerCase());
    if (byName) return byName.accountId;
    const byEmail = users.find(u => u.emailAddress && u.emailAddress.toLowerCase() === value.toLowerCase());
    if (byEmail) return byEmail.accountId;
    return value;
}
