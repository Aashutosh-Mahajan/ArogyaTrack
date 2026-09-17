'use client';

import React from 'react';
import { FiCheck } from 'react-icons/fi';

interface Props {
  steps: string[];
  current: number; // 0-based
}

export default function MultiStepProgress({ steps, current }: Props) {
  return (
    <div className="flex items-center gap-0 w-full mb-10">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done
                    ? 'bg-primary text-white'
                    : active
                    ? 'bg-primary text-white ring-4 ring-teal-600/20'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <FiCheck className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${active || done ? 'text-primary' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${i < current ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
