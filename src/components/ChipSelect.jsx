import React from 'react';

const ChipSelect = ({ options, selected, onChange, multi = false }) => {
  const toggleSelection = (opt) => {
    if (multi) {
      if (selected.includes(opt)) {
        onChange(selected.filter(item => item !== opt));
      } else {
        onChange([...selected, opt]);
      }
    } else {
      onChange(opt);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt, i) => {
        const isSelected = multi ? selected.includes(opt) : selected === opt;
        
        return (
          <button
            key={i}
            type="button"
            onClick={() => toggleSelection(opt)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-['DM_Sans'] transition-colors duration-200 border cursor-pointer
              ${isSelected 
                ? 'bg-[#1F6F6A] text-white border-[#1F6F6A]' 
                : 'bg-[#EEF3F2] text-[#1F6F6A] border-[#D9E5E3] hover:bg-[#DEEEED]'
              }
            `}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
};

export default ChipSelect;
