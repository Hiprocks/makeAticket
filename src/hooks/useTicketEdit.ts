import { useState } from 'react';
import { jiraService } from '@/services/jiraService';
import type { EditRecord, EditRow, EditedTicket } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function useTicketEdit() {
    const [isUpdating, setIsUpdating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
    const [result, setResult] = useState<EditRecord | null>(null);

    const startUpdate = async (rows: EditRow[]) => {
        if (rows.length === 0) return;
        setIsUpdating(true);
        setProgress({ current: 0, total: rows.length, message: 'Preparing...' });

        const updatedTickets: EditedTicket[] = [];
        let successCount = 0;
        let failCount = 0;

        try {
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                setProgress({
                    current: i + 1,
                    total: rows.length,
                    message: `Updating ${row.key}`
                });

                const payload: { summary?: string; description?: string } = {};
                if (row.summary !== row.originalSummary) payload.summary = row.summary;
                if (row.description !== row.originalDescription) payload.description = row.description;

                try {
                    if (!row.key) throw new Error('Jira key is missing');
                    if (payload.summary === undefined && payload.description === undefined) {
                        throw new Error('No changes to update');
                    }
                    await jiraService.updateIssue(row.key, payload);
                    updatedTickets.push({
                        rowId: row.id,
                        jiraKey: row.key,
                        summary: row.summary,
                        description: row.description,
                        status: 'success',
                        errorMessage: null
                    });
                    successCount++;
                } catch (error: any) {
                    updatedTickets.push({
                        rowId: row.id,
                        jiraKey: row.key,
                        summary: row.summary,
                        description: row.description,
                        status: 'failed',
                        errorMessage: error.message || 'Unknown error'
                    });
                    failCount++;
                }
            }

            const record: EditRecord = {
                id: uuidv4(),
                updatedAt: new Date().toISOString(),
                successCount,
                failCount,
                tickets: updatedTickets
            };
            setResult(record);
        } finally {
            setIsUpdating(false);
        }
    };

    const resetUpdate = () => {
        setResult(null);
        setProgress({ current: 0, total: 0, message: '' });
    };

    return {
        isUpdating,
        progress,
        result,
        startUpdate,
        resetUpdate,
    };
}
