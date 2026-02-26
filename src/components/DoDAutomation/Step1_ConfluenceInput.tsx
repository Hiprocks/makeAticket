/**
 * Step 1: Confluence Input
 * User inputs Confluence page URL or page ID
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useDoDStore } from '../../store/useDoDStore';
import {
  fetchConfluencePage,
  extractPageIdFromUrl,
  isValidPageId,
  testConfluenceConnection,
} from '../../services/confluenceService';
import { extractDoDFromHtml } from '../../services/dodExtractionService';
import { toast } from 'sonner';

export function Step1_ConfluenceInput() {
  const {
    pageUrl,
    pageId,
    setPageUrl,
    setPageId,
    setPageData,
    setExtractionResult,
  } = useDoDStore();

  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [input, setInput] = useState(pageUrl || pageId || '');

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

  const handleFetchPage = async () => {
    if (!input.trim()) {
      toast.error('❌ Confluence URL 또는 페이지 ID를 입력하세요');
      return;
    }

    setLoading(true);

    try {
      // Extract page ID from input
      let extractedPageId: string | null = null;

      // Check if input is a URL
      if (input.startsWith('http')) {
        extractedPageId = extractPageIdFromUrl(input);
        if (!extractedPageId) {
          throw new Error('URL에서 페이지 ID를 찾을 수 없습니다. URL 형식을 확인하세요.');
        }
        setPageUrl(input);
      } else if (isValidPageId(input)) {
        // Input is a direct page ID
        extractedPageId = input.trim();
        setPageUrl('');
      } else {
        throw new Error('올바른 Confluence URL 또는 페이지 ID를 입력하세요.');
      }

      setPageId(extractedPageId);

      // Fetch page from Confluence
      toast.info('📄 Confluence 페이지 조회 중...');
      const page = await fetchConfluencePage(extractedPageId);

      // Save page data
      setPageData(page.title, page.body);

      // Extract DoD items from HTML
      toast.info('🔍 DoD 항목 추출 중...');
      const extractionResult = extractDoDFromHtml(page.body, page.title);

      // Show warnings if any
      if (extractionResult.warnings.length > 0) {
        extractionResult.warnings.forEach((warning) => {
          toast.warning(`⚠️ ${warning}`);
        });
      }

      // Save extraction result and move to Step 2
      setExtractionResult(extractionResult);

      toast.success(
        `✅ DoD 추출 완료: ${extractionResult.epicCount}개 Epic, ${extractionResult.totalTasks}개 Task`
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
            placeholder="https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/12345/Page+Title"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-gray-500">
            예시: https://your-domain.atlassian.net/wiki/pages/12345 또는 12345
          </p>
        </div>

        <Button
          onClick={handleFetchPage}
          disabled={loading || !input.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              페이지 불러오는 중...
            </>
          ) : (
            'DoD 추출 시작'
          )}
        </Button>
      </div>

      {/* Help */}
      <Alert>
        <AlertDescription>
          <strong>도움말:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Confluence 페이지는 Epic과 Task 목록 구조로 작성되어야 합니다.</li>
            <li>제목(h1-h3)은 Epic 이름으로 감지됩니다.</li>
            <li>목록(ul/ol)은 Task로 감지됩니다.</li>
            <li>VFX, Sound, UI, Animation 키워드는 자동으로 Part로 분류됩니다.</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
