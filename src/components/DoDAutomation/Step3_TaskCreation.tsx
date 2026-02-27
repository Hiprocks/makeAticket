/**
 * Step 3: Task Creation (v2.0)
 * Plan v1.2 기준: 선택된 Task 일괄 생성 + Blocker 링크
 */

import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { useDoDStore } from '../../store/useDoDStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import {
  createDoDTasks,
  createBlockerLinks,
} from '../../services/jiraAutomationService';
import { toast } from 'sonner';

export function Step3_TaskCreation() {
  const {
    extraction,
    selectedTasks,
    creationResults,
    isCreating,
    setIsCreating,
    setCreationResults,
    setCurrentStep,
    reset,
    resetKeepingUrl,
  } = useDoDStore();

  const { jiraUrl } = useSettingsStore();

  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<'tasks' | 'blockers' | 'done'>(
    'tasks'
  );

  useEffect(() => {
    // Auto-start creation when entering Step 3
    if (extraction && selectedTasks.size > 0 && creationResults.length === 0) {
      handleCreateTasks();
    }
  }, []);

  const handleCreateTasks = async () => {
    if (!extraction) {
      toast.error('❌ DoD 추출 결과가 없습니다. Step 1부터 다시 시작하세요.');
      return;
    }

    if (selectedTasks.size === 0) {
      toast.error('❌ 선택된 Task가 없습니다.');
      return;
    }

    setIsCreating(true);
    setProgress(0);
    setCurrentPhase('tasks');

    try {
      // 1. Filter selected tasks
      const tasksToCreate = extraction.plannedTasks.filter((task) =>
        selectedTasks.has(task.prefix)
      );

      if (tasksToCreate.length === 0) {
        throw new Error('생성할 Task가 없습니다.');
      }

      // 2. Create Tasks (FR-7)
      toast.info(`🚀 Task 생성 시작: ${tasksToCreate.length}개`);
      const results = await createDoDTasks(tasksToCreate);

      setProgress(50);

      // 3. Save results
      setCreationResults(results);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (successCount > 0) {
        toast.success(`✅ Task 생성 성공: ${successCount}개`);
      }
      if (failCount > 0) {
        toast.warning(`⚠️ Task 생성 실패: ${failCount}개`);
      }

      // 4. Create Blocker links if any (FR-8)
      setCurrentPhase('blockers');

      // Extract blocker rules from plannedTasks
      const blockerRules: Record<string, string[]> = {};
      for (const task of tasksToCreate) {
        if (task.blockers && task.blockers.length > 0) {
          blockerRules[task.prefix] = task.blockers;
        }
      }

      if (Object.keys(blockerRules).length > 0) {
        toast.info('🔗 Blocker 링크 생성 중...');
        const blockerResults = await createBlockerLinks(results, blockerRules);

        const blockerSuccessCount = blockerResults.results.filter(
          (r) => r.success
        ).length;

        if (blockerSuccessCount > 0) {
          toast.success(`✅ Blocker 링크 생성 완료: ${blockerSuccessCount}개`);
        }
      }

      setProgress(100);
      setCurrentPhase('done');

      toast.success('🎉 모든 작업 완료!');
    } catch (error) {
      toast.error(`❌ 오류 발생: ${(error as Error).message}`);
      console.error('Task creation error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleReset = () => {
    if (
      confirm(
        '새로운 DoD 추출을 시작하시겠습니까? 현재 결과는 초기화됩니다.'
      )
    ) {
      resetKeepingUrl(); // Keep URL input, reset everything else
      toast.success('✅ 초기화 완료. Step 1부터 다시 시작하세요.');
    }
  };

  const handleBack = () => {
    setCurrentStep(2);
  };

  if (!extraction) {
    return (
      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertDescription>
          먼저 Step 1에서 Confluence 페이지를 불러오고 DoD를 추출하세요.
        </AlertDescription>
      </Alert>
    );
  }

  // Epic이 없는 경우
  const hasNoEpic = !extraction.epicKey;

  const successCount = creationResults.filter((r) => r.success).length;
  const failCount = creationResults.filter((r) => !r.success).length;
  // Issue #1 수정: 실제 생성 가능한 Task 수 계산
  const totalTasks = extraction?.plannedTasks.filter((task) =>
    selectedTasks.has(task.prefix)
  ).length || 0;

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Step 3: Jira 티켓 생성</h2>
          <p className="text-gray-600">선택된 {totalTasks}개 Task를 Jira에 생성합니다.</p>
        </div>
        <div className="flex gap-2">
          {!isCreating && creationResults.length === 0 && (
            <Button variant="outline" onClick={handleBack}>
              ← 이전 단계
            </Button>
          )}
          {!isCreating && creationResults.length > 0 && (
            <Button variant="outline" onClick={handleReset}>
              🏠 초기 화면으로
            </Button>
          )}
        </div>
      </div>

      {/* Epic 없음 안내 */}
      {hasNoEpic && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription>
            <strong>ℹ️ Epic 없음</strong>
            <p className="mt-2">
              Confluence 페이지에 Epic 링크가 없습니다. Epic 없이 Task만 생성됩니다.
              나중에 Jira에서 수동으로 Epic에 연결할 수 있습니다.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Progress */}
      {isCreating && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {currentPhase === 'tasks' && '📋 Task 생성 중...'}
              {currentPhase === 'blockers' && '🔗 Blocker 링크 생성 중...'}
              {currentPhase === 'done' && '✅ 완료'}
            </span>
            <Badge variant={isCreating ? 'secondary' : 'default'}>
              {isCreating ? '진행 중' : '완료'}
            </Badge>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-600">선택된 Task</p>
          <p className="text-2xl font-bold">{totalTasks}</p>
        </div>
        <div className="border rounded-lg p-4 bg-green-50">
          <p className="text-sm text-gray-600">생성 성공</p>
          <p className="text-2xl font-bold text-green-600">{successCount}</p>
        </div>
        <div className="border rounded-lg p-4 bg-red-50">
          <p className="text-sm text-gray-600">생성 실패</p>
          <p className="text-2xl font-bold text-red-600">{failCount}</p>
        </div>
      </div>

      {/* Results */}
      {creationResults.length > 0 && (
        <div className="border rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto">
          <h3 className="font-semibold mb-3">생성 결과</h3>
          {creationResults.map((result, index) => (
            <div
              key={result.prefix}
              className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 flex-1">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{result.title}</p>
                  {result.error && (
                    <p className="text-xs text-red-600 mt-1">{result.error}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {result.key && (
                  <a
                    href={result.url || `${jiraUrl}/browse/${result.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Badge variant="outline">{result.key}</Badge>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Blocker Info */}
      {extraction && extraction.plannedTasks.some((t) => t.blockers.length > 0) && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription>
            <strong>Blocker 정보:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              {extraction.plannedTasks
                .filter((t) => selectedTasks.has(t.prefix) && t.blockers.length > 0)
                .map((task) => (
                  <li key={task.prefix}>
                    {task.prefix} → blocks: {task.blockers.join(', ')}
                  </li>
                ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Bottom Actions */}
      <div className="flex gap-3 justify-end">
        {!isCreating && creationResults.length > 0 && (
          <>
            <Button variant="outline" onClick={handleReset}>
              새로운 DoD 추출 시작
            </Button>
            {failCount > 0 && (
              <Button onClick={handleCreateTasks}>
                실패한 항목 재시도 ({failCount}개)
              </Button>
            )}
          </>
        )}
        {isCreating && (
          <Alert className="flex-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              티켓 생성 중입니다. 잠시만 기다려 주세요...
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Help */}
      {creationResults.length > 0 && (
        <Alert>
          <AlertDescription>
            <strong>완료:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>
                <strong>FR-7:</strong> DoD Task 일괄 생성 (순차 처리로 Rate Limit 방지)
              </li>
              <li>
                <strong>FR-8:</strong> Blocker 링크 자동 설정 (말머리 기준)
              </li>
              <li>
                성공한 티켓은 Jira에서 확인 가능 (Badge 클릭 → Jira 페이지 이동)
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
