import type { ReactNode } from "react";

interface DocShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function DocShell({ sidebar, children }: DocShellProps) {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 xl:gap-12">
        {sidebar}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
