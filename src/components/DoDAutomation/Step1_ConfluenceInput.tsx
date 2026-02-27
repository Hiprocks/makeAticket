/**
 * Step 1: Confluence Input (v2.0)
 * Plan v1.2 기준: Confluence 조회 → HTML 파싱 → Epic 조회 → DoD 추출
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useDoDStore } from '../../store/useDoDStore';
import {
  fetchConfluencePage,
  extractPageIdFromUrl,
  isValidPageId,
  testConfluenceConnection,
} from '../../services/confluenceService';
import {
  parseConfluenceHtml,
  extractDoD,
} from '../../services/dodExtractionService';
import {
  queryEpic,
  generatePlannedTasks,
} from '../../services/jiraAutomationService';
import { toast } from 'sonner';

export function Step1_ConfluenceInput() {
  const { confluenceUrl, setConfluenceUrl, setConfluenceData, setExtraction, setEpicSummary } = useDoDStore();

  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [input, setInput] = useState(confluenceUrl); // Initialize from store

  // Sync input with store
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    setConfluenceUrl(value); // Save to store
  };

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const result = await testConfluenceConnection();
      if (result.ok) {
        setTestStatus('success');
        toast.success('✅ Confluence 연결 성공');
      } else {
        setTestStatus('failed');
        toast.error(`❌ Confluence 연결 실패 (${result.status})`);
      }
    } catch (error) {
      setTestStatus('failed');
      toast.error(`❌ 연결 실패: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMockTest = () => {
    console.log('🧪 [Step1] handleMockTest 시작');

    // 임시 데이터로 테스트
    const mockExtraction = {
      confluencePageId: '12345',
      confluenceUrl: 'https://example.atlassian.net/wiki/pages/12345',
      title: '테스트 기능 기획서',
      epicKey: 'TEST-100',
      parts: [
        {
          partName: '인게임 기획',
          prefix: '[기획]',
          checked: true,
          detected: false,
          status: 'normal' as const,
          keywords: [],
          tasks: [
            {
              title: '플레이어 이동 기능 구현',
              description: '캐릭터가 WASD 키로 이동할 수 있어야 함. 속도 5m/s',
              resource: '기획팀 1명',
              dependency: '-'
            },
            {
              title: '점프 기능 추가',
              description: '스페이스바로 점프 가능. 최대 높이 2m',
              resource: '기획팀 1명',
              dependency: '플레이어 이동 기능'
            }
          ]
        },
        {
          partName: 'UI 파트',
          prefix: '[UI]',
          checked: true,
          detected: true,
          status: 'normal' as const,
          keywords: ['UI', '버튼', 'HUD'],
          tasks: [
            {
              title: 'UI 메뉴 구현',
              description: '메인 메뉴 화면 구현 3종 (시작, 설정, 종료)',
              resource: 'UI팀 2명',
              dependency: '[기획]'
            },
            {
              title: 'HUD 체력바 표시',
              description: '화면 좌측 상단에 체력바 표시',
              resource: 'UI팀 1명',
              dependency: '-'
            }
          ]
        },
        {
          partName: '서버 파트',
          prefix: '[서버]',
          checked: true,
          detected: false,
          status: 'normal' as const,
          keywords: [],
          tasks: [
            {
              title: '플레이어 위치 동기화',
              description: '서버에서 플레이어 위치 동기화 처리',
              resource: '서버팀 1명',
              dependency: '[기획]'
            }
          ]
        },
        {
          partName: 'VFX 파트',
          prefix: '[VFX]',
          checked: false,
          detected: true,
          status: 'review' as const,
          keywords: ['이펙트', 'FX'],
          tasks: [
            {
              title: '점프 이펙트 제작',
              description: '점프 시 파티클 이펙트 제작 1종',
              resource: 'VFX팀 1명',
              dependency: '[기획]'
            }
          ]
        }
      ],
      validation: {
        passed: true,
        issues: []
      },
      plannedTasks: [
        {
          prefix: '[기획]',
          title: '[기획] 테스트 기능 기획서',
          description: `📋 DoD 작업 항목

1. 플레이어 이동 기능 구현
   - 캐릭터가 WASD 키로 이동할 수 있어야 함. 속도 5m/s
   - 리소스: 기획팀 1명

2. 점프 기능 추가
   - 스페이스바로 점프 가능. 최대 높이 2m
   - 리소스: 기획팀 1명
   - 의존성: 플레이어 이동 기능

🔗 Confluence: https://example.atlassian.net/wiki/pages/12345`,
          parentKey: 'TEST-100',
          blockers: [],
          blockedBy: []
        },
        {
          prefix: '[UI]',
          title: '[UI] 테스트 기능 기획서',
          description: `📋 DoD 작업 항목

1. UI 메뉴 구현
   - 메인 메뉴 화면 구현 3종 (시작, 설정, 종료)
   - 리소스: UI팀 2명
   - 의존성: [기획]

2. HUD 체력바 표시
   - 화면 좌측 상단에 체력바 표시
   - 리소스: UI팀 1명

🔗 Confluence: https://example.atlassian.net/wiki/pages/12345

🏷️ 키워드: UI, 버튼, HUD`,
          parentKey: 'TEST-100',
          blockers: ['[기획]'],
          blockedBy: []
        },
        {
          prefix: '[서버]',
          title: '[서버] 테스트 기능 기획서',
          description: `📋 DoD 작업 항목

1. 플레이어 위치 동기화
   - 서버에서 플레이어 위치 동기화 처리
   - 리소스: 서버팀 1명
   - 의존성: [기획]

🔗 Confluence: https://example.atlassian.net/wiki/pages/12345`,
          parentKey: 'TEST-100',
          blockers: ['[기획]'],
          blockedBy: []
        }
      ],
      existingTasks: []
    };

    // Confluence 데이터도 설정
    console.log('🧪 [Step1] Confluence 데이터 설정 중...');
    setConfluenceData({
      pageId: '12345',
      title: '테스트 기능 기획서',
      url: 'https://example.atlassian.net/wiki/pages/12345',
      htmlContent: '<html><body><h1>테스트 기능 기획서</h1></body></html>',
      epicLink: 'TEST-100'
    });

    // Extraction 데이터 설정 및 Step 2로 이동
    console.log('🧪 [Step1] Extraction 데이터 설정 중...');
    console.log('🧪 [Step1] mockExtraction:', mockExtraction);
    setExtraction(mockExtraction);

    console.log('🧪 [Step1] setExtraction 완료 - Step 2로 전환됨');

    toast.success('✅ 임시 데이터 로드 완료! Step 2로 이동합니다.');
  };

  const handleAIAnalysis = async () => {
    if (!input.trim()) {
      toast.error('❌ Confluence URL 또는 페이지 ID를 입력하세요');
      return;
    }

    setLoading(true);

    try {
      // 1. Extract page ID
      let extractedPageId: string | null = null;

      if (input.startsWith('http')) {
        extractedPageId = extractPageIdFromUrl(input);
        if (!extractedPageId) {
          throw new Error('URL에서 페이지 ID를 찾을 수 없습니다.');
        }
      } else if (isValidPageId(input)) {
        extractedPageId = input.trim();
      } else {
        throw new Error('올바른 Confluence URL 또는 페이지 ID를 입력하세요.');
      }

      // 2. Fetch Confluence page
      toast.info('🤖 AI 분석 시작: Confluence 페이지 조회 중...');
      const page = await fetchConfluencePage(extractedPageId);

      // 3. Parse HTML for Epic link only
      const parsed = parseConfluenceHtml(page.body);

      // 4. Call AI analysis API
      toast.info('🤖 Claude AI가 기획서를 분석하고 있습니다...');
      const aiResponse = await fetch('/api/confluence/analyze-dod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: page.title,
          content: page.body,
        }),
      });

      if (!aiResponse.ok) {
        const errorData = await aiResponse.json();
        if (errorData.fallback) {
          throw new Error('AI 분석을 사용할 수 없습니다. 수동 분석을 사용하세요.');
        }
        throw new Error(errorData.error || 'AI 분석 실패');
      }

      const aiResult = await aiResponse.json();
      console.log('🤖 [AI Analysis] Result:', aiResult);

      // 5. Convert AI result to DoDExtraction format
      const parts = aiResult.parts.map((aiPart: any) => ({
        partName: aiPart.partName,
        prefix: aiPart.prefix,
        checked: true, // AI가 선택한 파트는 모두 checked
        detected: false,
        status: 'normal' as const,
        keywords: [],
        tasks: aiPart.tasks || [],
      }));

      // 6. Query Epic if exists
      const confluenceUrl = input.startsWith('http') ? input : '';
      let finalEpicKey = parsed.epicKey || '';
      let existingTasks = [];
      let epicSummary = '';

      if (finalEpicKey) {
        toast.info(`🔍 Epic 조회 중: ${finalEpicKey}...`);
        const epicData = await queryEpic(finalEpicKey);
        existingTasks = epicData.existingTasks;
        epicSummary = epicData.summary;
        setEpicSummary(epicSummary);
        toast.success(`✅ Epic 조회 완료: "${epicSummary}"`);
      }

      // 7. Save Confluence data
      setConfluenceData({
        pageId: extractedPageId,
        title: page.title,
        url: confluenceUrl,
        htmlContent: page.body,
        epicLink: finalEpicKey,
      });

      // 8. Create extraction with AI result
      const extraction = {
        confluencePageId: extractedPageId,
        confluenceUrl,
        title: page.title,
        epicKey: finalEpicKey,
        parts,
        validation: {
          passed: true,
          issues: [],
        },
        plannedTasks: [],
        existingTasks,
      };

      // Generate planned tasks
      const blockerRules: Record<string, string[]> = {};
      extraction.plannedTasks = generatePlannedTasks(
        extraction.parts,
        extraction.epicKey,
        epicSummary || extraction.title,
        confluenceUrl,
        blockerRules,
        existingTasks
      );

      console.log('AI Planned Tasks Count:', extraction.plannedTasks.length);

      // 9. Save and move to Step 2
      setExtraction(extraction);

      toast.success(
        `✅ AI 분석 완료: ${parts.length}개 파트, ${extraction.plannedTasks.length}개 Task 예정`
      );
    } catch (error) {
      toast.error(`❌ AI 분석 실패: ${(error as Error).message}`);
      console.error('AI analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchPage = async () => {
    if (!input.trim()) {
      toast.error('❌ Confluence URL 또는 페이지 ID를 입력하세요');
      return;
    }

    setLoading(true);

    try {
      // 1. Extract page ID from input
      let extractedPageId: string | null = null;

      if (input.startsWith('http')) {
        extractedPageId = extractPageIdFromUrl(input);
        if (!extractedPageId) {
          throw new Error('URL에서 페이지 ID를 찾을 수 없습니다. URL 형식을 확인하세요.');
        }
      } else if (isValidPageId(input)) {
        extractedPageId = input.trim();
      } else {
        throw new Error('올바른 Confluence URL 또는 페이지 ID를 입력하세요.');
      }

      // 2. Fetch Confluence page (FR-1)
      toast.info('📄 Confluence 페이지 조회 중...');
      const page = await fetchConfluencePage(extractedPageId);

      // 3. Parse HTML (FR-2, FR-5)
      toast.info('🔍 HTML 파싱 중 (협업 체크 테이블, Epic 링크)...');
      const parsed = parseConfluenceHtml(page.body);

      // 4. Determine Epic Key (optional)
      let finalEpicKey: string | null = null;

      if (parsed.epicKey) {
        // Auto-extracted from Confluence
        finalEpicKey = parsed.epicKey;
        toast.success(`✅ Epic 링크 자동 감지: ${finalEpicKey}`);
      } else {
        toast.info('ℹ️ Epic 링크 없음 - Epic 없이 진행합니다');
      }

      // 5. Save Confluence data to Store
      const confluenceUrl = input.startsWith('http') ? input : '';
      setConfluenceData({
        pageId: extractedPageId,
        title: parsed.title,
        url: confluenceUrl,
        htmlContent: page.body,
        epicLink: finalEpicKey,
      });

      // 6. Query Epic and existing tasks (FR-5) - only if Epic exists
      let existingTasks = [];
      let epicSummary = '';
      if (finalEpicKey) {
        toast.info(`🔍 Epic 조회 중: ${finalEpicKey}...`);
        const epicData = await queryEpic(finalEpicKey);
        existingTasks = epicData.existingTasks;
        epicSummary = epicData.summary;

        // Save Epic summary to store
        setEpicSummary(epicSummary);
        toast.success(`✅ Epic 조회 완료: "${epicSummary}"`);
      }

      // 7. Extract DoD (FR-2, FR-3, FR-4)
      toast.info('🔍 DoD 추출 중 (협업 체크 + 키워드 탐지)...');
      const extraction = extractDoD(
        page.body,
        extractedPageId,
        confluenceUrl,
        page.title // Confluence API에서 제공한 정확한 제목 전달
      );

      // Debug: extraction 결과 확인
      console.log('=== DoD Extraction Result ===');
      console.log('Title:', extraction.title);
      console.log('Parts Count:', extraction.parts.length);
      console.log('Checked Parts:', extraction.parts.filter(p => p.checked).length);
      console.log('Parts:', extraction.parts);
      console.log('Validation:', extraction.validation);

      // DEBUG: HTML 다운로드 (문제 분석용)
      if (extraction.parts.length === 0) {
        console.warn('⚠️ Parts가 0개입니다! HTML을 다운로드하여 구조를 확인하세요.');
        const blob = new Blob([page.body], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `confluence-${extractedPageId}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast.warning('⚠️ DoD 파트가 없습니다. HTML 파일을 다운로드했으니 구조를 확인하세요.');
      }

      // Update extraction with Epic key and existing tasks
      extraction.epicKey = finalEpicKey || '';
      extraction.existingTasks = existingTasks;

      // Generate planned tasks (FR-7 준비)
      const blockerRules: Record<string, string[]> = {}; // Blocker 규칙은 나중에 설정
      extraction.plannedTasks = generatePlannedTasks(
        extraction.parts,
        extraction.epicKey,
        epicSummary || extraction.title, // Use Epic summary if available, fallback to page title
        confluenceUrl,
        blockerRules,
        existingTasks // Pass existing tasks for filtering
      );

      console.log('Planned Tasks Count:', extraction.plannedTasks.length);

      // 8. Show validation warnings (FR-10)
      if (!extraction.validation.passed) {
        toast.warning('⚠️ DoD 검증 실패');
        extraction.validation.issues.forEach((issue) => {
          toast.warning(`⚠️ ${issue}`);
        });
      } else {
        toast.success('✅ DoD 검증 통과');
      }

      // 9. Save extraction to Store and move to Step 2
      setExtraction(extraction);

      toast.success(
        `✅ DoD 추출 완료: ${extraction.parts.filter((p) => p.checked).length}개 파트, ${extraction.plannedTasks.length}개 Task 예정`
      );
    } catch (error) {
      toast.error(`❌ 오류: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Step 1: Confluence 페이지 입력</h2>
        <p className="text-gray-600">
          DoD가 작성된 Confluence 페이지 URL 또는 페이지 ID를 입력하세요.
        </p>
      </div>

      {/* Connection Test */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Confluence 연결 테스트</h3>
            <p className="text-sm text-gray-600">
              먼저 Confluence 연결 상태를 확인하세요.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  테스트 중...
                </>
              ) : (
                '연결 테스트'
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={handleMockTest}
              disabled={loading}
            >
              🧪 임시 데이터 테스트
            </Button>
          </div>
        </div>

        {testStatus === 'success' && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              Confluence 연결 성공! 페이지를 불러올 수 있습니다.
            </AlertDescription>
          </Alert>
        )}

        {testStatus === 'failed' && (
          <Alert className="bg-red-50 border-red-200">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              Confluence 연결 실패. 설정을 확인하세요. (Settings 탭)
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Page Input */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pageInput">Confluence URL 또는 페이지 ID</Label>
          <Input
            id="pageInput"
            type="text"
            placeholder="https://krafton.atlassian.net/wiki/spaces/SPACE/pages/12345/Title"
            value={input}
            onChange={handleInputChange}
            disabled={loading}
          />
          <p className="text-xs text-gray-500">
            예시: https://krafton.atlassian.net/wiki/pages/12345 또는 12345
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleAIAnalysis}
            disabled={loading || !input.trim()}
            className="flex-1"
            variant="default"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                AI 분석 중...
              </>
            ) : (
              '🤖 AI 자동 분석 (권장)'
            )}
          </Button>
          <Button
            onClick={handleFetchPage}
            disabled={loading || !input.trim()}
            className="flex-1"
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                수동 분석 중...
              </>
            ) : (
              '수동 분석 (키워드)'
            )}
          </Button>
        </div>
      </div>

      {/* Help */}
      <Alert>
        <AlertDescription>
          <strong>Plan v1.2 워크플로우:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>
              <strong>FR-1:</strong> Confluence 페이지 조회 (Confluence API v2)
            </li>
            <li>
              <strong>FR-2:</strong> 협업 체크 테이블 파싱 (체크된 파트만 추출)
            </li>
            <li>
              <strong>FR-3:</strong> 키워드 탐지 (VFX, Sound, UI, Animation 등)
            </li>
            <li>
              <strong>FR-4:</strong> DoD 통합 (1직군 1티켓 원칙)
            </li>
            <li>
              <strong>FR-5:</strong> Epic 조회 + 기존 Task 중복 확인 (Epic 있는 경우만)
            </li>
            <li>
              <strong>FR-10:</strong> DoD 검증 (5가지 자동 체크)
            </li>
          </ul>
          <p className="mt-3 text-sm font-semibold text-blue-600">
            💡 Confluence 연결 없이 바로 테스트하려면 "🧪 임시 데이터 테스트" 버튼을 클릭하세요!
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
