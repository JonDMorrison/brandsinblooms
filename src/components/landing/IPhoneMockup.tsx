import React from 'react';

interface IPhoneMockupProps {
  children: React.ReactNode;
}

export const IPhoneMockup = ({ children }: IPhoneMockupProps) => {
  return (
    <div className="flex justify-center lg:justify-end">
      <div className="relative w-full max-w-[300px] lg:max-w-[350px]">
        {/* iPhone Frame */}
        <div className="relative bg-black rounded-[3rem] p-3 shadow-2xl ring-8 ring-gray-800">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-black rounded-b-3xl z-10" />
          
          {/* Screen */}
          <div className="relative bg-white dark:bg-gray-900 rounded-[2.5rem] overflow-hidden aspect-[9/19.5]">
            {children}
          </div>
          
          {/* Home Indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full" />
        </div>

        {/* Glow Effect */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#68BEB9]/20 to-[#3E5A6B]/20 blur-3xl rounded-full" />
      </div>
    </div>
  );
};
