import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTicketStore } from '@/store/useTicketStore';
import type { TicketRow } from '@/types';

interface SubtaskModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parentRow: TicketRow | null;
}

const SUBTASK_TYPES = [
    '기획', '레벨', '클라', '테크', 'UI', '서버',
    '아트C-2D', '아트C-3D', '아트B-2D', '아트B-3D',
    '애니', 'VFX', 'SFX'
];

export function SubtaskModal({ open, onOpenChange, parentRow }: SubtaskModalProps) {
    const { lastSubtaskTypes, updateLastSubtaskTypes } = useSettingsStore();
    const { addSubtasks } = useTicketStore();
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

    useEffect(() => {
        if (open) {
            setSelectedTypes(lastSubtaskTypes.length > 0 ? lastSubtaskTypes : []);
        }
    }, [open, lastSubtaskTypes]);

    const handleToggle = (type: string) => {
        setSelectedTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const handleSubmit = () => {
        if (!parentRow) return;

        addSubtasks(parentRow.id, selectedTypes, parentRow.summary);
        updateLastSubtaskTypes(selectedTypes);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>하위 일감 추가</DialogTitle>
                </DialogHeader>

                <div className="py-2">
                    <p className="text-sm text-muted-foreground mb-4">
                        상위 Epic: {parentRow?.summary || '(제목 없음)'}
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                        {SUBTASK_TYPES.map(type => (
                            <div key={type} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`type-${type}`}
                                    checked={selectedTypes.includes(type)}
                                    onCheckedChange={() => handleToggle(type)}
                                />
                                <Label htmlFor={`type-${type}`} className="cursor-pointer">
                                    {type}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                    <Button onClick={handleSubmit} disabled={selectedTypes.length === 0}>추가</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
