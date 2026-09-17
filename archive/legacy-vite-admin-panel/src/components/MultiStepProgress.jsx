import React from 'react';

const MultiStepProgress = ({ steps, currentStep }) => {
  return (
    <div className="flex items-center justify-between w-full max-w-lg mx-auto mb-12">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        const isLastStep = index === steps.length - 1;

        return (
          <React.Fragment key={index}>
            <div className="flex flex-col items-center relative z-10">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors duration-300
                  ${isActive ? 'bg-[#1F6F6A] border-[#1F6F6A] text-white' : 
                    isCompleted ? 'bg-[#1F6F6A] border-[#1F6F6A] text-white' : 
                    'bg-[#EEF3F2] border-[#D9E5E3] text-[#9CA8A8]'}`}
              >
                {isCompleted ? (
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ) : (
                   index + 1
                )}
              </div>
              <span className={`absolute -bottom-6 text-[11px] whitespace-nowrap font-medium ${isActive || isCompleted ? 'text-[#1F6F6A]' : 'text-[#9CA8A8]'}`}>
                {step}
              </span>
            </div>
            
            {!isLastStep && (
              <div className={`flex-1 h-[2px] mx-2 transition-colors duration-300 ${isCompleted ? 'bg-[#1F6F6A]' : 'bg-[#D9E5E3]'}`}></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default MultiStepProgress;
