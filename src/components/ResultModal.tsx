import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import type { CreationRecord } from '@/types';
import { useSettingsStore } from '@/store/useSettingsStore';

interface ResultModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isCreating: boolean;
    progress: { current: number; total: number; message: string };
    result: CreationRecord | null;
    onClose: () => void;
}

export function ResultModal({ open, onOpenChange, isCreating, progress, result, onClose }: ResultModalProps) {
    const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    const { jiraUrl: settingsJiraUrl } = useSettingsStore();
    const baseUrl = (result?.jiraUrl || settingsJiraUrl || '').replace(/\/+$/, '');

    return (
        <Dialog open={open} onOpenChange={(val) => !isCreating && onOpenChange(val)}>
            <DialogContent className="max-w-2xl" onInteractOutside={(e) => isCreating && e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>
                        {isCreating ? 'Creating tickets...' : 'Creation result'}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    {isCreating ? (
                        <div className="space-y-4">
                            <Progress value={percentage} className="w-full" />
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span className="flex items-center">
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {progress.message}
                                </span>
                                <span>{progress.current} / {progress.total}</span>
                            </div>
                        </div>
                    ) : result ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="bg-slate-50 p-3 rounded-lg border">
                                    <div className="text-2xl font-bold">{result.tickets.length}</div>
                                    <div className="text-xs text-muted-foreground uppercase">Total</div>
                                </div>
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-green-700">
                                    <div className="text-2xl font-bold flex items-center justify-center gap-2">
                                        <CheckCircle2 className="w-5 h-5" />
                                        {result.successCount}
                                    </div>
                                    <div className="text-xs opacity-80 uppercase">Success</div>
                                </div>
                                <div className={`p-3 rounded-lg border ${result.failCount > 0 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-slate-50 opacity-50'}`}>
                                    <div className="text-2xl font-bold flex items-center justify-center gap-2">
                                        {result.failCount > 0 && <XCircle className="w-5 h-5" />}
                                        {result.failCount}
                                    </div>
                                    <div className="text-xs opacity-80 uppercase">Failed</div>
                                </div>
                            </div>

                            {result.failCount > 0 && (
                                <div className="border rounded-md bg-red-50/50">
                                    <div className="p-2 border-b text-sm font-medium text-red-700 flex items-center">
                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                        Failed items ({result.failCount})
                                    </div>
                                    <div className="max-h-40 overflow-y-auto p-2 space-y-2">
                                        {result.tickets.filter(t => t.status === 'failed').map((ticket, i) => (
                                            <div key={i} className="text-sm flex items-start gap-2 text-red-600 bg-white p-2 rounded border border-red-100">
                                                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <div className="font-medium">{ticket.summary}</div>
                                                    <div className="text-xs opacity-80">{ticket.errorMessage}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {result.successCount > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Recent created (up to 5)</h4>
                                    <div className="text-sm space-y-1">
                                        {result.tickets.filter(t => t.status === 'success').slice(0, 5).map((ticket, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                                                <span className="truncate flex-1 mr-2">{ticket.summary}</span>
                                                {baseUrl ? (
                                                    <a
                                                        href={`${baseUrl}/browse/${ticket.jiraKey}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center text-blue-600 hover:underline text-xs"
                                                    >
                                                        {ticket.jiraKey} <ExternalLink className="w-3 h-3 ml-1" />
                                                    </a>
                                                ) : (
                                                    <span className="text-xs">{ticket.jiraKey}</span>
                                                )}
                                            </div>
                                        ))}
                                        {result.successCount > 5 && (
                                            <div className="text-xs text-center text-muted-foreground">
                                                ... and {result.successCount - 5} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                <DialogFooter>
                    {isCreating ? (
                        <Button disabled>Creating...</Button>
                    ) : (
                        <Button onClick={onClose}>Close</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
