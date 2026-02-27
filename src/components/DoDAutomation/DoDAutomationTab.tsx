/**
 * DoD Automation Tab
 * Main tab component for DoD extraction and Jira automation workflow
 */

import { useDoDStore } from '../../store/useDoDStore';
import { Step1_ConfluenceInput } from './Step1_ConfluenceInput';
import { Step2_DoDReview } from './Step2_DoDReview';
import { Step3_TaskCreation } from './Step3_TaskCreation';
import { Badge } from '../ui/badge';

export function DoDAutomationTab() {
  const { currentStep, extraction } = useDoDStore();

  console.log('🎯 [DoDAutomationTab] 렌더링 - currentStep:', currentStep);
  console.log('🎯 [DoDAutomationTab] extraction:', extraction ? '있음' : '없음');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <StepIndicator step={1} label="Confluence 입력" active={currentStep === 1} />
        <div className="h-0.5 w-12 bg-gray-300" />
        <StepIndicator step={2} label="DoD 검토" active={currentStep === 2} />
        <div className="h-0.5 w-12 bg-gray-300" />
        <StepIndicator step={3} label="티켓 생성" active={currentStep === 3} />
      </div>

      {/* Step Content */}
      <div className="bg-white border rounded-lg p-6">
        {currentStep === 1 && <Step1_ConfluenceInput />}
        {currentStep === 2 && <Step2_DoDReview />}
        {currentStep === 3 && <Step3_TaskCreation />}
      </div>
    </div>
  );
}

function StepIndicator({
  step,
  label,
  active,
}: {
  step: number;
  label: string;
  active: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center font-bold
          ${active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}
        `}
      >
        {step}
      </div>
      <span className={`text-sm ${active ? 'font-semibold' : 'text-gray-600'}`}>
        {label}
      </span>
    </div>
  );
}
