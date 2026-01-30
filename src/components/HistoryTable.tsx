import { useState } from 'react';
import { useHistoryStore } from '@/store/useHistoryStore';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { HistoryDetailModal } from './HistoryDetailModal';
import type { CreationRecord } from '@/types';
import { downloadJson, pickJsonFile } from '@/lib/fileStorage';

export function HistoryTable() {
    const { records, clearHistory, replaceRecordsFromImport } = useHistoryStore();
    const [selectedRecord, setSelectedRecord] = useState<CreationRecord | null>(null);

    return (
        <div className="flex flex-col h-full bg-white">
            <HistoryDetailModal
                open={!!selectedRecord}
                onOpenChange={(open) => !open && setSelectedRecord(null)}
                record={selectedRecord}
            />

            <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-medium">Creation history ({records.length})</h3>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadJson('jbc-history.json', { version: 1, records })}
                    >
                        Export
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                            try {
                                const data = await pickJsonFile();
                                const imported = Array.isArray((data as any)?.records) ? (data as any).records : data;
                                replaceRecordsFromImport(Array.isArray(imported) ? imported : []);
                            } catch (err: any) {
                                alert(`Import failed: ${err.message || err}`);
                            }
                        }}
                    >
                        Import
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (confirm('Clear all history?')) clearHistory();
                        }}
                    >
                        Clear history
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b sticky top-0">
                        <tr>
                            <th className="p-3 font-medium text-muted-foreground w-40">Created</th>
                            <th className="p-3 font-medium text-muted-foreground">Project</th>
                            <th className="p-3 font-medium text-muted-foreground text-center">Epic</th>
                            <th className="p-3 font-medium text-muted-foreground text-center">Task</th>
                            <th className="p-3 font-medium text-muted-foreground text-center">Success</th>
                            <th className="p-3 font-medium text-muted-foreground text-center">Failed</th>
                            <th className="p-3 font-medium text-muted-foreground text-right">Detail</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                    No history yet.
                                </td>
                            </tr>
                        ) : (
                            records.map(record => (
                                <tr key={record.id} className="border-b hover:bg-slate-50">
                                    <td className="p-3 text-muted-foreground">
                                        {format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm')}
                                    </td>
                                    <td className="p-3">{record.projectKey}</td>
                                    <td className="p-3 text-center">{record.epicCount}</td>
                                    <td className="p-3 text-center">{record.taskCount}</td>
                                    <td className="p-3 text-center text-green-600 font-medium">{record.successCount}</td>
                                    <td className="p-3 text-center text-red-600 font-medium">
                                        {record.failCount > 0 ? record.failCount : '-'}
                                    </td>
                                    <td className="p-3 text-right">
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(record)}>
                                            View
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
