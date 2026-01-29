import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Settings } from '@/types';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
    const settings = useSettingsStore();
    const { register, handleSubmit, setValue, watch, reset } = useForm<Settings>({
        defaultValues: settings
    });

    // Sync form with store when opening
    useEffect(() => {
        if (open) {
            reset(settings);
        }
    }, [open, settings, reset]);

    const onSubmit = (data: Settings) => {
        settings.setConnection(data);
        onOpenChange(false);
    };

    const connectionType = watch('connectionType');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>설정</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <Tabs defaultValue="connection" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-4">
                            <TabsTrigger value="connection">Jira 연결</TabsTrigger>
                            <TabsTrigger value="defaults">기본값</TabsTrigger>
                            <TabsTrigger value="data">데이터 관리</TabsTrigger>
                        </TabsList>

                        {/* Jira Connection Tab */}
                        <TabsContent value="connection" className="space-y-4">
                            <div className="space-y-4 border p-4 rounded-md">
                                <Label>연동 방식</Label>
                                <RadioGroup
                                    defaultValue={connectionType}
                                    onValueChange={(val: string) => setValue('connectionType', val as 'jira-api' | 'claude-mcp')}
                                    className="flex space-x-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="jira-api" id="r-api" />
                                        <Label htmlFor="r-api">Jira API 직접 연동 (권장)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="claude-mcp" id="r-mcp" />
                                        <Label htmlFor="r-mcp">Claude MCP 사용</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {connectionType === 'jira-api' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="jiraUrl">Jira URL</Label>
                                            <Input id="jiraUrl" placeholder="https://company.atlassian.net" {...register('jiraUrl')} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="projectKey">프로젝트 키</Label>
                                            <Input id="projectKey" placeholder="AEGIS" {...register('projectKey')} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">이메일</Label>
                                        <Input id="email" placeholder="user@company.com" {...register('email')} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="apiToken">API Token</Label>
                                        <Input id="apiToken" type="password" placeholder="••••••••••••••••••" {...register('apiToken')} />
                                        <p className="text-xs text-muted-foreground">
                                            <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer" className="underline">
                                                토큰 발급받기
                                            </a>
                                        </p>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button type="button" variant="outline" onClick={() => alert('구현 예정')}>연결 테스트</Button>
                                    </div>
                                </div>
                            )}

                            {connectionType === 'claude-mcp' && (
                                <div className="p-4 bg-muted rounded-md text-sm">
                                    Claude에서 Atlassian 연결이 필요합니다. <br />
                                    <div className="mt-2 space-y-2">
                                        <Label htmlFor="projectKeyMcp">프로젝트 키</Label>
                                        <Input id="projectKeyMcp" placeholder="AEGIS" {...register('projectKey')} />
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Defaults Tab */}
                        <TabsContent value="defaults" className="space-y-4">
                            <div className="space-y-2">
                                <Label>기본 생성 유형</Label>
                                <Select
                                    onValueChange={(val: 'Epic' | 'Task') => setValue('defaultType', val)}
                                    defaultValue={settings.defaultType}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Task">Task</SelectItem>
                                        <SelectItem value="Epic">Epic</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>기본 Sprint</Label>
                                <Select
                                    onValueChange={(val: string) => setValue('defaultSprintId', val)}
                                    defaultValue={settings.defaultSprintId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="현재 Sprint (자동)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* TODO: Load from cache */}
                                        <SelectItem value="auto">현재 Sprint (자동)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </TabsContent>

                        {/* Data Tab */}
                        <TabsContent value="data" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Button type="button" variant="outline" onClick={() => alert('새로고침')}>담당자 목록 새로고침</Button>
                                <Button type="button" variant="outline" onClick={() => alert('새로고침')}>Sprint 목록 새로고침</Button>
                            </div>
                            <div className="border-t pt-4 mt-4">
                                <Button type="button" variant="destructive" className="w-full" onClick={() => {
                                    if (confirm('모든 데이터를 초기화하시겠습니까?')) {
                                        settings.resetSettings();
                                        onOpenChange(false);
                                    }
                                }}>
                                    설정 초기화
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="mt-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                        <Button type="submit">저장</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
