/**
 * Step 2: DoD Review
 * User reviews and edits extracted DoD items before creating Jira tickets
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Trash2, Edit2, Save, X } from 'lucide-react';
import { useDoDStore } from '../../store/useDoDStore';
import type { DoDItem } from '../../types';
import { toast } from 'sonner';

export function Step2_DoDReview() {
  const {
    extractionResult,
    reviewedItems,
    updateReviewedItem,
    deleteReviewedItem,
    setCurrentStep,
    startCreation,
  } = useDoDStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DoDItem>>({});

  if (!extractionResult) {
    return (
      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertDescription>
          먼저 Step 1에서 Confluence 페이지를 불러오세요.
        </AlertDescription>
      </Alert>
    );
  }

  const handleStartEdit = (item: DoDItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;

    updateReviewedItem(editingId, editForm);
    setEditingId(null);
    setEditForm({});
    toast.success('✅ 항목 수정 완료');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = (id: string) => {
    if (confirm('이 항목을 삭제하시겠습니까?')) {
      deleteReviewedItem(id);
      toast.success('🗑️ 항목 삭제 완료');
    }
  };

  const handleToggleBlocker = (id: string, currentValue: boolean) => {
    updateReviewedItem(id, { isBlocker: !currentValue });
  };

  const handleProceedToCreation = () => {
    if (reviewedItems.length === 0) {
      toast.error('❌ 생성할 항목이 없습니다.');
      return;
    }

    startCreation(reviewedItems.length);
    toast.info('🚀 티켓 생성을 시작합니다...');
  };

  const handleBackToStep1 = () => {
    if (confirm('Step 1으로 돌아가면 현재 수정 내용이 초기화됩니다. 계속하시겠습니까?')) {
      setCurrentStep(1);
    }
  };

  // Group items by Epic
  const itemsByEpic = reviewedItems.reduce((acc, item) => {
    if (!acc[item.epicName]) {
      acc[item.epicName] = [];
    }
    acc[item.epicName].push(item);
    return acc;
  }, {} as Record<string, DoDItem[]>);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Step 2: DoD 항목 검토 및 수정</h2>
        <p className="text-gray-600">
          추출된 DoD 항목을 검토하고 필요시 수정하세요. Blocker 설정도 가능합니다.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-600">Epic 개수</p>
          <p className="text-2xl font-bold">{extractionResult.epicCount}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-600">Task 개수</p>
          <p className="text-2xl font-bold">{reviewedItems.length}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-600">Blocker 개수</p>
          <p className="text-2xl font-bold">
            {reviewedItems.filter((item) => item.isBlocker).length}
          </p>
        </div>
      </div>

      {/* Warnings */}
      {extractionResult.warnings.length > 0 && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertDescription>
            <strong>경고:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {extractionResult.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Items by Epic */}
      <div className="space-y-6">
        {Object.entries(itemsByEpic).map(([epicName, items]) => (
          <div key={epicName} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{epicName}</h3>
              <Badge variant="outline">{items.length}개 Task</Badge>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border rounded p-3 space-y-2 hover:bg-gray-50"
                >
                  {editingId === item.id ? (
                    // Edit mode
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Summary</label>
                        <Input
                          value={editForm.summary || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, summary: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                          value={editForm.description || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, description: e.target.value })
                          }
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Part</label>
                        <Input
                          value={editForm.part || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, part: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveEdit} size="sm">
                          <Save className="mr-1 h-3 w-3" />
                          저장
                        </Button>
                        <Button onClick={handleCancelEdit} variant="outline" size="sm">
                          <X className="mr-1 h-3 w-3" />
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.summary}</p>
                            <Badge variant="secondary">{item.part}</Badge>
                            {item.isBlocker && (
                              <Badge variant="destructive">Blocker</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(item)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`blocker-${item.id}`}
                          checked={item.isBlocker}
                          onCheckedChange={() =>
                            handleToggleBlocker(item.id, item.isBlocker)
                          }
                        />
                        <label
                          htmlFor={`blocker-${item.id}`}
                          className="text-sm text-gray-600 cursor-pointer"
                        >
                          이 Task가 Epic을 Blocker로 설정
                        </label>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleBackToStep1}>
          이전 단계
        </Button>
        <Button
          onClick={handleProceedToCreation}
          disabled={reviewedItems.length === 0}
          className="flex-1"
        >
          Jira 티켓 생성 ({reviewedItems.length}개)
        </Button>
      </div>
    </div>
  );
}
