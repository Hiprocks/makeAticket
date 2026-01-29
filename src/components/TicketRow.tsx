import { memo } from 'react';
import type { TicketRow as TicketRowType } from '@/types';
import { useTicketStore } from '@/store/useTicketStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";  // Need to install or component
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Copy, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar"; // Need to install
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TicketRowProps {
    row: TicketRowType;
    index: number;
    onAddSubtask?: () => void;
}

export const TicketRow = memo(function TicketRow({ row, index, onAddSubtask }: TicketRowProps) {
    const { updateRow, copyRow, toggleSelect } = useTicketStore();
    const { users, sprints } = useSettingsStore() as any; // Bypass TS error for build

    // Grid layout matching the header
    const gridClass = "grid grid-cols-[40px_100px_1fr_1fr_120px_100px_120px_120px_120px_80px] gap-0 border-b hover:bg-slate-50 transition-colors group items-stretch";

    // Helper for input update
    const handleChange = (field: keyof TicketRowType, value: any) => {
        updateRow(row.id, { [field]: value });
    };

    return (
        <div className={gridClass}>
            {/* Checkbox */}
            <div className="flex items-center justify-center border-r p-2 bg-white group-hover:bg-slate-50">
                <Checkbox
                    checked={row.selected}
                    onCheckedChange={() => toggleSelect(row.id)}
                />
            </div>

            {/* Type */}
            <div className="p-1 border-r">
                <Select
                    value={row.type}
                    onValueChange={(val: 'Epic' | 'Task') => handleChange('type', val)}
                >
                    <SelectTrigger className="h-full border-0 focus:ring-0 rounded-none bg-transparent">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Task">Task</SelectItem>
                        <SelectItem value="Epic">Epic</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Summary */}
            <div className="p-1 border-r">
                <Input
                    value={row.summary}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('summary', e.target.value)}
                    className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent"
                    placeholder="제목 입력"
                />
            </div>

            {/* Description */}
            <div className="p-1 border-r">
                <Textarea
                    value={row.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('description', e.target.value)}
                    className="h-full min-h-[40px] border-0 focus-visible:ring-0 rounded-none bg-transparent resize-none py-2 leading-tight"
                    placeholder="설명"
                />
            </div>

            {/* Assignee */}
            <div className="p-1 border-r">
                <Select
                    value={row.assignee}
                    onValueChange={(val: string) => handleChange('assignee', val)}
                >
                    <SelectTrigger className="h-full border-0 focus:ring-0 rounded-none bg-transparent text-xs p-2">
                        <SelectValue placeholder="담당자" />
                    </SelectTrigger>
                    <SelectContent>
                        {/* Mock Users if empty */}
                        <SelectItem value="none">미지정</SelectItem>
                        {/* We can map mock users here for now, or real ones */}
                        <SelectItem value="user1">홍길동</SelectItem>
                        <SelectItem value="user2">김철수</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Sprint */}
            <div className="p-1 border-r">
                <Select
                    value={row.sprint}
                    onValueChange={(val: string) => handleChange('sprint', val)}
                >
                    <SelectTrigger className="h-full border-0 focus:ring-0 rounded-none bg-transparent text-xs p-2">
                        <SelectValue placeholder="Sprint" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">미지정</SelectItem>
                        <SelectItem value="101">Sprint 101</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Start Date */}
            <div className="p-1 border-r flex items-center justify-center">
                <DateField
                    value={row.startDate}
                    onChange={(val) => handleChange('startDate', val)}
                />
            </div>

            {/* Due Date */}
            <div className="p-1 border-r flex items-center justify-center">
                <DateField
                    value={row.dueDate}
                    onChange={(val) => handleChange('dueDate', val)}
                />
            </div>

            {/* Parent */}
            <div className="p-1 border-r">
                <Input
                    value={row.parentKey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('parentKey', e.target.value)}
                    className="h-full border-0 focus-visible:ring-0 rounded-none bg-transparent text-xs"
                    placeholder="상위키"
                    disabled={row.type === 'Epic'} // Epic generally doesn't have parent in this context, or it's Initiatives
                />
            </div>

            {/* Actions */}
            <div className="p-1 flex items-center justify-center gap-1">
                {row.type === 'Task' ? (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyRow(row.id)} title="복사">
                        <Copy className="h-3 w-3" />
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddSubtask} title="하위 일감">
                        <Plus className="h-3 w-3" />
                    </Button>
                )}
            </div>
        </div>
    );
});

// Helper component for Date Picker to keep main component clean
function DateField({ value, onChange }: { value: string, onChange: (val: string) => void }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"ghost"}
                    className={cn(
                        "w-full h-8 justify-start text-left font-normal px-2 text-xs",
                        !value && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {value ? value : <span>Pick</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={value ? new Date(value) : undefined}
                    onSelect={(date: Date | undefined) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}
