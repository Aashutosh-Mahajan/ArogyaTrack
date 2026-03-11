'use client';

import React from 'react';

interface Props {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  accentColor?: string; // tailwind bg class or hex
}

export default function ChipSelect({ options, selected, onChange, accentColor = 'bg-teal-600' }: Props) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              isActive
                ? `${accentColor} text-white border-transparent`
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
