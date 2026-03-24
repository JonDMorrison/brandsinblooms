import type { ReactNode } from "react";

interface DocShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function DocShell({ sidebar, children }: DocShellProps) {
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      <div className="grid grid-cols-1 gap-8 min-[900px]:grid-cols-[240px_minmax(0,1fr)] min-[900px]:gap-12">
        {sidebar}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
