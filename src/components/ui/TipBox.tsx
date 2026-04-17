import React, { useState } from "react";

interface TipBoxProps {
  children: React.ReactNode;
}

export const TipBox: React.FC<TipBoxProps> = ({ children }) => {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-amber-600 hover:text-amber-700 font-medium"
      >
        {open ? "hide tip" : "tip"}
      </button>
      {open && (
        <div className="mt-1 flex items-start gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5">
          <span className="text-[11px] leading-none mt-px">💡</span>
          <p className="text-[11px] italic text-amber-800 leading-relaxed m-0">
            {children}
          </p>
        </div>
      )}
    </div>
  );
};
