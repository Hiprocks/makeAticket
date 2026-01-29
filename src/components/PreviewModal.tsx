import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TicketRow } from '@/types';
import { AlertTriangle } from 'lucide-react';

interface PreviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rows: TicketRow[];
    onConfirm: () => void;
}

export function PreviewModal({ open, onOpenChange, rows, onConfirm }: PreviewModalProps) {
    const selectedRows = rows.filter(r => r.selected);
    const epicCount = selectedRows.filter(r => r.type === 'Epic').length;
    const taskCount = selectedRows.filter(r => r.type === 'Task').length;

    // Simple validation
    const invalidRows = selectedRows.filter(r => !r.summary);
    const hasErrors = invalidRows.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>생성 예정 티켓 미리보기</DialogTitle>
                </DialogHeader>

                <div className="py-2 flex-1 overflow-y-auto">
                    <div className="flex items-center justify-between mb-4 bg-muted p-3 rounded-md text-sm">
                        <span>총 <strong>{selectedRows.length}</strong>개 티켓 생성 예정</span>
                        <div className="space-x-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">Epic: {epicCount}</span>
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Task: {taskCount}</span>
                        </div>
                    </div>

                    <div className="border rounded-md">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="p-2 font-medium text-muted-foreground w-12 text-center">#</th>
                                    <th className="p-2 font-medium text-muted-foreground w-16">유형</th>
                                    <th className="p-2 font-medium text-muted-foreground">제목</th>
                                    <th className="p-2 font-medium text-muted-foreground w-24">담당자</th>
                                    <th className="p-2 font-medium text-muted-foreground w-24">상위업무</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedRows.map((row, i) => (
                                    <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
                                        <td className="p-2 text-center text-muted-foreground">{i + 1}</td>
                                        <td className="p-2">
                                            <span className={`px-2 py-0.5 rounded text-xs ${row.type === 'Epic' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td className={`p-2 ${!row.summary ? 'text-red-500 font-medium' : ''}`}>
                                            {row.summary || '(제목 없음)'}
                                        </td>
                                        <td className="p-2 text-muted-foreground">{row.assignee === 'none' || !row.assignee ? '-' : row.assignee}</td>
                                        <td className="p-2 text-muted-foreground">{row.parentKey || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {hasErrors && (
                        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md flex items-center text-sm">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            <span>제목이 없는 티켓이 {invalidRows.length}건 있습니다. 생성 전 확인해주세요.</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>수정하기</Button>
                    <Button onClick={onConfirm} disabled={hasErrors}>생성 확정</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
