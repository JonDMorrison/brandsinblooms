import { Badge } from "@/components/ui/badge";

import type { DocField } from "./types";

interface DocFieldTableProps {
  fields: DocField[];
}

export function DocFieldTable({ fields }: DocFieldTableProps) {
  return (
    <div className="mb-6 overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Field
            </th>
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Description
            </th>
            <th className="py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Required
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.name} className="border-b border-gray-100 align-top">
              <td className="py-3 pr-4 font-mono text-xs text-slate-800">
                {field.name}
              </td>
              <td className="py-3 pr-4 text-sm leading-6 text-muted-foreground">
                {field.description}
              </td>
              <td className="py-3">
                {field.required ? (
                  <Badge
                    variant="destructive"
                    className="text-xs font-semibold"
                  >
                    Required
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Optional
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
