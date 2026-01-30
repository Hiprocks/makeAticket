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
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <Tabs defaultValue="connection" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-4">
                            <TabsTrigger value="connection">Connection</TabsTrigger>
                            <TabsTrigger value="defaults">Defaults</TabsTrigger>
                            <TabsTrigger value="data">Data</TabsTrigger>
                        </TabsList>

                        {/* Jira Connection Tab */}
                        <TabsContent value="connection" className="space-y-4">
                            <div className="space-y-4 border p-4 rounded-md">
                                <Label>Connection type</Label>
                                <RadioGroup
                                    defaultValue={connectionType}
                                    onValueChange={(val: string) => setValue('connectionType', val as 'jira-api' | 'claude-mcp')}
                                    className="flex space-x-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="jira-api" id="r-api" />
                                        <Label htmlFor="r-api">Jira API</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="claude-mcp" id="r-mcp" />
                                        <Label htmlFor="r-mcp">Claude MCP</Label>
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
                                            <Label htmlFor="projectKey">Project key</Label>
                                            <Input id="projectKey" placeholder="AEGIS" {...register('projectKey')} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" placeholder="user@company.com" {...register('email')} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="apiToken">API Token</Label>
                                        <Input id="apiToken" type="password" placeholder="••••••••" {...register('apiToken')} />
                                        <p className="text-xs text-muted-foreground">
                                            <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer" className="underline">
                                                Generate token
                                            </a>
                                        </p>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button type="button" variant="outline" onClick={() => alert('Not implemented')}>
                                            Test connection
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {connectionType === 'claude-mcp' && (
                                <div className="p-4 bg-muted rounded-md text-sm">
                                    Configure Claude MCP and Atlassian connection in your MCP settings.
                                    <div className="mt-2 space-y-2">
                                        <Label htmlFor="projectKeyMcp">Project key</Label>
                                        <Input id="projectKeyMcp" placeholder="AEGIS" {...register('projectKey')} />
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Defaults Tab */}
                        <TabsContent value="defaults" className="space-y-4">
                            <div className="space-y-2">
                                <Label>Default issue type</Label>
                                <Select
                                    onValueChange={(val: 'Epic' | 'Task') => setValue('defaultType', val)}
                                    defaultValue={settings.defaultType}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Task">Task</SelectItem>
                                        <SelectItem value="Epic">Epic</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Default sprint</Label>
                                <Select
                                    onValueChange={(val: string) => setValue('defaultSprintId', val)}
                                    defaultValue={settings.defaultSprintId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Active sprint (auto)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Active sprint (auto)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </TabsContent>

                        {/* Data Tab */}
                        <TabsContent value="data" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Button type="button" variant="outline" onClick={() => alert('Not implemented')}>
                                    Load users
                                </Button>
                                <Button type="button" variant="outline" onClick={() => alert('Not implemented')}>
                                    Load sprints
                                </Button>
                            </div>
                            <div className="border-t pt-4 mt-4">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => {
                                        if (confirm('Reset all settings?')) {
                                            settings.resetSettings();
                                            onOpenChange(false);
                                        }
                                    }}
                                >
                                    Reset settings
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="mt-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
