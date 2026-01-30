import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CreationRecord } from '@/types';
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useSettingsStore } from '@/store/useSettingsStore';

interface HistoryDetailModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record: CreationRecord | null;
}

export function HistoryDetailModal({ open, onOpenChange, record }: HistoryDetailModalProps) {
    if (!record) return null;
    const { jiraUrl: settingsJiraUrl } = useSettingsStore();
    const baseUrl = (record.jiraUrl || settingsJiraUrl || '').replace(/\/+$/, '');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        생성 상세 내역 ({format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm')})
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 flex-1 overflow-y-auto space-y-6">
                    {/* Summary */}
                    <div className="grid grid-cols-4 gap-4 text-center text-sm">
                        <div className="bg-slate-50 p-2 rounded border">
                            <span className="block text-muted-foreground text-xs">프로젝트</span>
                            <span className="font-medium">{record.projectKey}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border">
                            <span className="block text-muted-foreground text-xs">Epic / Task</span>
                            <span className="font-medium">{record.epicCount} / {record.taskCount}</span>
                        </div>
                        <div className="bg-green-50 p-2 rounded border border-green-100 text-green-700">
                            <span className="block text-xs opacity-80">성공</span>
                            <span className="font-bold">{record.successCount}</span>
                        </div>
                        <div className="bg-red-50 p-2 rounded border border-red-100 text-red-700">
                            <span className="block text-xs opacity-80">실패</span>
                            <span className="font-bold">{record.failCount}</span>
                        </div>
                    </div>

                    {/* Ticket List */}
                    <div className="border rounded-md">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="p-2 w-16 text-center">상태</th>
                                    <th className="p-2 w-16">유형</th>
                                    <th className="p-2">제목</th>
                                    <th className="p-2 w-32">Jira Key</th>
                                </tr>
                            </thead>
                            <tbody>
                                {record.tickets.map((ticket, i) => (
                                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                        <td className="p-2 text-center">
                                            {ticket.status === 'success' ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-600 inline" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-red-600 inline" />
                                            )}
                                        </td>
                                        <td className="p-2 text-xs">{ticket.type}</td>
                                        <td className="p-2">
                                            <div className={ticket.status === 'failed' ? 'text-red-700' : ''}>
                                                {ticket.summary}
                                            </div>
                                            {ticket.status === 'failed' && (
                                                <div className="text-xs text-red-500 mt-1">{ticket.errorMessage}</div>
                                            )}
                                        </td>
                                        <td className="p-2 text-sm font-mono">
                                            {ticket.jiraKey ? (
                                                baseUrl ? (
                                                    <a
                                                        href={`${baseUrl}/browse/${ticket.jiraKey}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center text-blue-600 hover:underline"
                                                    >
                                                        {ticket.jiraKey} <ExternalLink className="w-3 h-3 ml-1" />
                                                    </a>
                                                ) : (
                                                    <span>{ticket.jiraKey}</span>
                                                )
                                            ) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={() => onOpenChange(false)}>닫기</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
