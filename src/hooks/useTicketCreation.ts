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
    const { projectKey } = useSettingsStore();

    const [isCreating, setIsCreating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
    const [result, setResult] = useState<CreationRecord | null>(null);

    const startCreation = async () => {
        const selectedRows = rows.filter(r => r.selected);
        if (selectedRows.length === 0) return;

        setIsCreating(true);
        setProgress({ current: 0, total: selectedRows.length, message: '생성 준비 중...' });

        const createdTickets: CreatedTicket[] = [];
        let successDate = 0;
        let failCount = 0;

        // Map rowId to created Jira Key for parent linking
        const rowIdToKey = new Map<string, string>();

        try {
            for (let i = 0; i < selectedRows.length; i++) {
                const row = selectedRows[i];
                setProgress({
                    current: i + 1,
                    total: selectedRows.length,
                    message: `${row.type} 생성 중: ${row.summary}`
                });

                try {
                    // Resolve Parent Key
                    if (row.parentRowId && rowIdToKey.has(row.parentRowId)) {
                        row.parentKey = rowIdToKey.get(row.parentRowId)!;
                    }

                    let key = '';
                    if (row.type === 'Epic') {
                        key = await jiraService.createEpic(row);
                        rowIdToKey.set(row.id, key);
                    } else {
                        key = await jiraService.createTask(row);
                    }

                    createdTickets.push({
                        rowId: row.id,
                        type: row.type,
                        summary: row.summary,
                        assignee: row.assignee,
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

            // Save Record
            const record: CreationRecord = {
                id: uuidv4(),
                createdAt: new Date().toISOString(),
                projectKey: projectKey, // Should use real project key
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
