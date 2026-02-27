/**
 * Step 2: DoD Review (v2.0)
 * Plan v1.2 기준: 파트별 DoD 검토 + Task 선택
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useDoDStore } from '../../store/useDoDStore';
import { toast } from 'sonner';

export function Step2_DoDReview() {
  const {
    extraction,
    selectedTasks,
    toggleTask,
    selectAllTasks,
    deselectAllTasks,
    setCurrentStep,
  } = useDoDStore();

  // 초기값을 모든 파트로 설정 (모두 열기 상태)
  const [expandedParts, setExpandedParts] = useState<Set<string>>(() => {
    if (!extraction) return new Set();
    const visibleParts = extraction.parts.filter((p) => p.checked || p.detected);
    return new Set(visibleParts.map(p => p.prefix));
  });

  console.log('📋 [Step2] 렌더링 - extraction:', extraction ? '있음' : '없음');
  if (extraction) {
    console.log('📋 [Step2] extraction.parts:', extraction.parts.length);
    console.log('📋 [Step2] extraction.plannedTasks:', extraction.plannedTasks.length);
  }

  if (!extraction) {
    console.log('⚠️ [Step2] extraction이 없습니다!');
    return (
      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertDescription>
          먼저 Step 1에서 Confluence 페이지를 불러오고 DoD를 추출하세요.
        </AlertDescription>
      </Alert>
    );
  }

  const handleToggleExpand = (prefix: string) => {
    setExpandedParts((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) {
        next.delete(prefix);
      } else {
        next.add(prefix);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const visibleParts = extraction?.parts.filter((p) => p.checked || p.detected) || [];
    setExpandedParts(new Set(visibleParts.map(p => p.prefix)));
    toast.success('✅ 모두 열기');
  };

  const handleCollapseAll = () => {
    setExpandedParts(new Set());
    toast.success('✅ 모두 닫기');
  };


  const handleProceed = () => {
    const actualTaskCount = getActualTaskCount();
    if (actualTaskCount === 0) {
      toast.error('❌ 생성할 Task를 선택하세요');
      return;
    }

    setCurrentStep(3);
    toast.info(`🚀 Step 3: ${actualTaskCount}개 티켓 생성 단계로 이동합니다...`);
  };

  // 실제 생성 가능한 Task 수 계산 (Issue #1 수정)
  const getActualTaskCount = () => {
    if (!extraction) return 0;
    return extraction.plannedTasks.filter((task) =>
      selectedTasks.has(task.prefix)
    ).length;
  };

  const handleBack = () => {
    if (
      confirm(
        'Step 1으로 돌아가면 현재 선택 내용이 초기화됩니다. 계속하시겠습니까?'
      )
    ) {
      setCurrentStep(1);
    }
  };

  // 협업 체크 또는 키워드 탐지된 파트만 표시
  const visibleParts = extraction.parts.filter((p) => p.checked || p.detected);
  const checkedParts = extraction.parts.filter((p) => p.checked);
  const reviewParts = extraction.parts.filter((p) => p.status === 'review');

  console.log('📋 [Step2] visibleParts:', visibleParts.length);
  console.log('📋 [Step2] checkedParts:', checkedParts.length);
  console.log('📋 [Step2] reviewParts:', reviewParts.length);

  // plannedTasks를 prefix 기준으로 매핑
  const plannedTasksMap = new Map(
    extraction.plannedTasks.map((task) => [task.prefix, task])
  );

  // 생성 예정 vs 기존 존재 구분
  const newTasks = visibleParts.filter(
    (part) => !extraction.existingTasks.some((t) => t.prefix === part.prefix)
  );
  const existingTasksWithParts = visibleParts.filter((part) =>
    extraction.existingTasks.some((t) => t.prefix === part.prefix)
  );

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Step 2: DoD 검토 및 Task 선택</h2>
          <p className="text-gray-600">
            추출된 파트를 검토하고 생성할 Task를 선택하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBack}>
            ← 이전 단계
          </Button>
          <Button
            onClick={handleProceed}
            disabled={getActualTaskCount() === 0}
          >
            다음 단계: 티켓 생성 ({getActualTaskCount()}개) →
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-600">탐지된 파트</p>
          <p className="text-2xl font-bold">{visibleParts.length}</p>
        </div>
        <div className="border rounded-lg p-4 bg-blue-50">
          <p className="text-sm text-gray-600">생성 예정</p>
          <p className="text-2xl font-bold text-blue-600">{newTasks.length}</p>
        </div>
        <div className="border rounded-lg p-4 bg-gray-50">
          <p className="text-sm text-gray-600">기존 존재</p>
          <p className="text-2xl font-bold text-gray-600">{existingTasksWithParts.length}</p>
        </div>
        <div className="border rounded-lg p-4 bg-green-50">
          <p className="text-sm text-gray-600">선택됨</p>
          <p className="text-2xl font-bold text-green-600">{getActualTaskCount()}</p>
        </div>
      </div>

      {/* Validation Results (FR-10) */}
      {checkedParts.length === 0 && visibleParts.length > 0 && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700">
            <strong>⚠️ 협업 체크 테이블 없음</strong>
            <p className="mt-2">
              Confluence 페이지에서 협업 체크 테이블을 찾지 못했습니다.
              키워드 탐지로 {visibleParts.length}개 파트를 발견했으며,
              모두 "추가 검토" 상태입니다. 내용을 확인하고 필요한 Task를 선택하세요.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {!extraction.validation.passed && (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            <strong>DoD 검증 실패:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {extraction.validation.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {extraction.validation.passed && checkedParts.length > 0 && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            <strong>✅ DoD 검증 통과</strong> (협업 체크 반영, 키워드 탐지, 언더스코어
            필터, 로직 분리, 추가 검토 표시)
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Actions */}
      <div className="flex items-center justify-between border rounded-lg p-4 bg-gray-50">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAllTasks}>
            전체 선택
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAllTasks}>
            전체 해제
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExpandAll}>
            모두 열기
          </Button>
          <Button variant="outline" size="sm" onClick={handleCollapseAll}>
            모두 닫기
          </Button>
        </div>
      </div>


      {/* 생성 예정 티켓 */}
      {newTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">생성 예정 티켓 ({newTasks.length}개)</h3>
            <Badge variant="default">선택 가능</Badge>
            {checkedParts.length === 0 && (
              <Badge variant="secondary" className="bg-yellow-100">
                키워드 탐지만 (협업 체크 없음)
              </Badge>
            )}
          </div>
        {newTasks.map((part, index) => {
          const isExpanded = expandedParts.has(part.prefix);
          const isSelected = selectedTasks.has(part.prefix);
          const plannedTask = plannedTasksMap.get(part.prefix);

          return (
            <div
              key={`${part.prefix}-${index}`}
              className={`border rounded-lg p-4 ${
                part.status === 'review' ? 'bg-yellow-50 border-yellow-300' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Checkbox
                    id={`task-${part.prefix}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleTask(part.prefix)}
                  />
                  <label
                    htmlFor={`task-${part.prefix}`}
                    className="font-medium cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-gray-500 text-sm">#{index + 1}</span>
                    {plannedTask?.title || `${part.prefix} ${extraction.title}`}
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  {part.status === 'normal' && (
                    <Badge variant="default">자동 감지</Badge>
                  )}
                  {part.status === 'review' && (
                    <Badge variant="secondary" className="bg-yellow-100">
                      추가 검토
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    생성 필요
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleExpand(part.prefix)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Task Content Preview (Collapsible) */}
              {isExpanded && plannedTask && (
                <div className="mt-4 border-t pt-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      📋 생성될 Jira 티켓 내용 미리보기
                    </h4>
                    <div className="bg-gray-50 p-3 rounded border text-sm whitespace-pre-wrap">
                      {plannedTask.description}
                    </div>
                  </div>

                  {plannedTask.blockers.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">
                        🔗 <strong>Blocker (선행 작업):</strong>
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        {plannedTask.blockers.map((blocker, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {blocker}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {part.tasks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">DoD 테이블 (상세)</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border p-2 text-left">작업 항목</th>
                              <th className="border p-2 text-left">상세 내용</th>
                              <th className="border p-2 text-left">리소스</th>
                              <th className="border p-2 text-left">의존성</th>
                            </tr>
                          </thead>
                          <tbody>
                            {part.tasks.map((task, i) => (
                              <tr key={i}>
                                <td className="border p-2">{task.title}</td>
                                <td className="border p-2">{task.description}</td>
                                <td className="border p-2">{task.resource}</td>
                                <td className="border p-2">{task.dependency}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {part.keywords.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      <span className="text-xs text-gray-600">키워드:</span>
                      {part.keywords.map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* No Planned Task */}
              {isExpanded && !plannedTask && (
                <div className="mt-4 border-t pt-4 text-gray-500 text-sm">
                  (티켓 생성 정보 없음 - 데이터 확인 필요)
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}

      {/* 기존 존재 티켓 */}
      {existingTasksWithParts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">기존 존재 티켓 ({existingTasksWithParts.length}개)</h3>
            <Badge variant="secondary">참고용</Badge>
          </div>
          {existingTasksWithParts.map((part, index) => {
            const isExpanded = expandedParts.has(part.prefix);
            const plannedTask = plannedTasksMap.get(part.prefix);
            const existingTask = extraction.existingTasks.find(
              (t) => t.prefix === part.prefix
            );

            return (
              <div
                key={`existing-${part.prefix}-${index}`}
                className="border rounded-lg p-4 bg-gray-50"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      id={`existing-${part.prefix}`}
                      checked={false}
                      disabled={true}
                    />
                    <label
                      htmlFor={`existing-${part.prefix}`}
                      className="font-medium flex items-center gap-2 text-gray-500"
                    >
                      <span className="text-gray-400 text-sm">#{index + 1}</span>
                      {plannedTask?.title || `${part.prefix} ${extraction.title}`}
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      기존 존재 ({existingTask?.key})
                    </Badge>
                    {existingTask?.key && (
                      <a
                        href={`${extraction.confluenceUrl?.replace('/wiki', '')}/browse/${existingTask.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Badge variant="outline" className="text-xs">
                          Jira에서 보기
                        </Badge>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleExpand(part.prefix)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Task Content Preview (Collapsible) */}
                {isExpanded && plannedTask && (
                  <div className="mt-4 border-t pt-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold mb-2">
                        📋 티켓 내용 (참고용)
                      </h4>
                      <div className="bg-white p-3 rounded border text-sm whitespace-pre-wrap">
                        {plannedTask.description}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleBack}>
          ← 이전 단계
        </Button>
        <Button
          onClick={handleProceed}
          disabled={getActualTaskCount() === 0}
        >
          다음 단계: 티켓 생성 ({getActualTaskCount()}개) →
        </Button>
      </div>

      {/* Help */}
      <Alert>
        <AlertDescription>
          <strong>도움말:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>
              <strong>자동 감지:</strong> 협업 체크 테이블 또는 키워드로 자동 감지된
              파트
            </li>
            <li>
              <strong>추가 검토:</strong> 기준 미달 (서버+클라 분리 필요 등)
            </li>
            <li>
              <strong>중복:</strong> 같은 말머리를 가진 Task가 이미 Epic에 존재
            </li>
            <li>
              <strong>번호 선택:</strong> "1, 3, 5-7" 형식으로 여러 Task 한 번에 선택
              가능
            </li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
