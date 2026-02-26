/**
 * Step 3: Task Creation
 * Creates Jira Epics and Tasks based on reviewed DoD items
 */

import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { useDoDStore } from '../../store/useDoDStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import type { DoDItem, DoDCreatedTicket } from '../../types';
import { toast } from 'sonner';

export function Step3_TaskCreation() {
  const {
    reviewedItems,
    creationProgress,
    createdTickets,
    updateCreationProgress,
    completeCreation,
    failCreation,
    addCreatedTicket,
    saveRecord,
    resetWorkflow,
  } = useDoDStore();

  const { projectKey, jiraUrl } = useSettingsStore();

  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Auto-start creation when entering Step 3
    if (creationProgress.status === 'creating' && !isCreating) {
      handleCreateTickets();
    }
  }, []);

  const handleCreateTickets = async () => {
    if (!projectKey) {
      toast.error('❌ 프로젝트 키가 설정되지 않았습니다. Settings 탭에서 설정하세요.');
      failCreation();
      return;
    }

    setIsCreating(true);

    try {
      // Group items by Epic
      const itemsByEpic = reviewedItems.reduce((acc, item) => {
        if (!acc[item.epicName]) {
          acc[item.epicName] = [];
        }
        acc[item.epicName].push(item);
        return acc;
      }, {} as Record<string, DoDItem[]>);

      let processedCount = 0;

      // Process each Epic and its Tasks
      for (const [epicName, items] of Object.entries(itemsByEpic)) {
        try {
          // Step 1: Create or find Epic
          const epicResult = await createOrFindEpic(epicName, projectKey);
          const epicKey = epicResult.key;

          toast.success(`✅ Epic 생성/조회 완료: ${epicKey}`);

          // Step 2: Create Tasks for this Epic
          for (const item of items) {
            try {
              const taskKey = await createTask(item, epicKey, projectKey);

              addCreatedTicket({
                itemId: item.id,
                epicKey,
                taskKey,
                status: 'success',
                errorMessage: null,
              });

              processedCount++;
              updateCreationProgress(processedCount);

              toast.success(`✅ Task 생성 완료: ${taskKey}`);

              // If this task is a blocker, link it to the Epic
              if (item.isBlocker) {
                await linkTaskAsBlocker(taskKey, epicKey);
                toast.info(`🔗 ${taskKey}를 ${epicKey}의 Blocker로 설정`);
              }
            } catch (error) {
              addCreatedTicket({
                itemId: item.id,
                epicKey,
                taskKey: null,
                status: 'failed',
                errorMessage: (error as Error).message,
              });

              processedCount++;
              updateCreationProgress(processedCount);

              toast.error(`❌ Task 생성 실패: ${item.summary}`);
            }
          }
        } catch (error) {
          // Epic creation failed - mark all tasks as failed
          items.forEach((item) => {
            addCreatedTicket({
              itemId: item.id,
              epicKey: null,
              taskKey: null,
              status: 'failed',
              errorMessage: `Epic 생성 실패: ${(error as Error).message}`,
            });

            processedCount++;
            updateCreationProgress(processedCount);
          });

          toast.error(`❌ Epic 생성 실패: ${epicName}`);
        }
      }

      completeCreation();
      saveRecord();
      toast.success('🎉 모든 티켓 생성 완료!');
    } catch (error) {
      failCreation();
      toast.error(`❌ 오류 발생: ${(error as Error).message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRetry = () => {
    if (confirm('실패한 항목만 다시 시도하시겠습니까?')) {
      // TODO: Implement retry logic for failed items only
      toast.info('재시도 기능은 추후 구현 예정입니다.');
    }
  };

  const handleReset = () => {
    if (confirm('새로운 DoD 추출을 시작하시겠습니까? 현재 결과는 History에 저장됩니다.')) {
      resetWorkflow();
      toast.success('✅ 초기화 완료. Step 1부터 다시 시작하세요.');
    }
  };

  const progressPercent =
    creationProgress.total > 0
      ? (creationProgress.current / creationProgress.total) * 100
      : 0;

  const successCount = createdTickets.filter((t) => t.status === 'success').length;
  const failCount = createdTickets.filter((t) => t.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Step 3: Jira 티켓 생성</h2>
        <p className="text-gray-600">DoD 항목을 Jira Epic과 Task로 생성합니다.</p>
      </div>

      {/* Progress */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">
            진행률: {creationProgress.current} / {creationProgress.total}
          </span>
          <Badge
            variant={
              creationProgress.status === 'completed'
                ? 'default'
                : creationProgress.status === 'failed'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {creationProgress.status === 'creating' && '생성 중'}
            {creationProgress.status === 'completed' && '완료'}
            {creationProgress.status === 'failed' && '실패'}
            {creationProgress.status === 'idle' && '대기'}
          </Badge>
        </div>
        <Progress value={progressPercent} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-600">전체</p>
          <p className="text-2xl font-bold">{creationProgress.total}</p>
        </div>
        <div className="border rounded-lg p-4 bg-green-50">
          <p className="text-sm text-gray-600">성공</p>
          <p className="text-2xl font-bold text-green-600">{successCount}</p>
        </div>
        <div className="border rounded-lg p-4 bg-red-50">
          <p className="text-sm text-gray-600">실패</p>
          <p className="text-2xl font-bold text-red-600">{failCount}</p>
        </div>
      </div>

      {/* Results */}
      {createdTickets.length > 0 && (
        <div className="border rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto">
          <h3 className="font-semibold mb-3">생성 결과</h3>
          {createdTickets.map((ticket, index) => {
            const item = reviewedItems.find((i) => i.id === ticket.itemId);
            return (
              <div
                key={ticket.itemId}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div className="flex items-center gap-2 flex-1">
                  {ticket.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm">
                    {item?.summary || `Item ${index + 1}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {ticket.epicKey && (
                    <Badge variant="outline">{ticket.epicKey}</Badge>
                  )}
                  {ticket.taskKey && (
                    <a
                      href={`${jiraUrl}/browse/${ticket.taskKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {ticket.taskKey}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {ticket.status === 'failed' && (
                    <span className="text-xs text-red-600">
                      {ticket.errorMessage}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {creationProgress.status === 'completed' && failCount > 0 && (
          <Button variant="outline" onClick={handleRetry}>
            실패한 항목 재시도
          </Button>
        )}
        {creationProgress.status === 'completed' && (
          <Button onClick={handleReset} className="flex-1">
            새로운 DoD 추출 시작
          </Button>
        )}
        {creationProgress.status === 'creating' && (
          <Alert className="flex-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              티켓 생성 중입니다. 잠시만 기다려 주세요...
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

// ============================================
// Helper Functions (Jira API Calls)
// ============================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5174';

/**
 * Create or find existing Epic
 */
async function createOrFindEpic(
  epicName: string,
  projectKey: string
): Promise<{ key: string; isNew: boolean }> {
  // TODO: First, search for existing Epic with same name
  // For now, always create new Epic

  const response = await fetch(`${API_BASE}/api/jira/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary: epicName,
        issuetype: { name: 'Epic' },
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: `Epic: ${epicName}` }],
            },
          ],
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Epic 생성 실패 (${response.status})`);
  }

  const data = await response.json();
  return { key: data.key, isNew: true };
}

/**
 * Create Task under Epic
 */
async function createTask(
  item: DoDItem,
  epicKey: string,
  projectKey: string
): Promise<string> {
  const response = await fetch(`${API_BASE}/api/jira/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary: item.summary,
        issuetype: { name: 'Task' },
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: item.description }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: `Part: ${item.part}` }],
            },
          ],
        },
        parent: { key: epicKey }, // Link to Epic
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Task 생성 실패 (${response.status})`);
  }

  const data = await response.json();
  return data.key;
}

/**
 * Link Task as Blocker to Epic
 */
async function linkTaskAsBlocker(
  taskKey: string,
  epicKey: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/jira/issue/${epicKey}/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: { name: 'Blocks' },
      inwardIssue: { key: taskKey },
      outwardIssue: { key: epicKey },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Blocker 링크 실패 (${response.status})`);
  }
}
