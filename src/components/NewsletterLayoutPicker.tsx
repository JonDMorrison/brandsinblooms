import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type LayoutKey = 'classic' | 'one-column';

interface CardProps {
  layout: LayoutKey;
  selected: LayoutKey | null;
  onSelect: (l: LayoutKey) => void;
}

const THUMBS: Record<LayoutKey, JSX.Element> = {
  /** ⬤ header  ▭ image-text blocks ▭ footer */
  classic: (
    <div className="h-full w-full rounded-md bg-white shadow-inner flex flex-col p-2 gap-1">
      <div className="h-6 rounded bg-gradient-to-b from-sky-200 to-sky-300" />
      
      {/* Image-text block 1 */}
      <div className="flex gap-2 items-start p-1">
        <div className="w-1/2 h-8 rounded bg-slate-300 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="h-1 rounded bg-slate-200" />
          <div className="h-1 rounded bg-slate-200 w-3/4" />
        </div>
      </div>
      
      {/* Image-text block 2 */}
      <div className="flex gap-2 items-start p-1">
        <div className="w-1/2 h-8 rounded bg-slate-300 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="h-1 rounded bg-slate-200" />
          <div className="h-1 rounded bg-slate-200 w-2/3" />
        </div>
      </div>
      
      <div className="h-4 rounded bg-gradient-to-r from-slate-200 to-slate-100 mt-auto" />
    </div>
  ),

  /** single column blocks */
  'one-column': (
    <div className="h-full w-full rounded-md bg-white shadow-inner flex flex-col p-2 gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded',
            i === 0
              ? 'h-6 bg-gradient-to-b from-sky-200 to-sky-300'
              : 'h-4 bg-slate-100'
          )}
        />
      ))}
    </div>
  ),
};

const Card = ({ layout, selected, onSelect }: CardProps) => {
  const isActive = selected === layout;
  return (
    <button
      onClick={() => onSelect(layout)}
      className={cn(
        'group relative flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border p-4 transition',
        isActive
          ? 'border-primary ring-2 ring-primary/20 shadow-lg'
          : 'border-border hover:ring-2 hover:ring-muted-foreground/20'
      )}
    >
      <div className="h-40 w-full">{THUMBS[layout]}</div>

      {isActive && (
        <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 text-primary" />
      )}

      <h3 className="text-lg font-semibold capitalize">
        {layout === 'one-column' ? 'One Column' : layout}
      </h3>
      <p className="text-sm text-muted-foreground text-center">
        {layout === 'classic' &&
          'Traditional header, multiple blocks, footer'}
        {layout === 'one-column' && 'Clean and minimal single column'}
      </p>
    </button>
  );
};

export function NewsletterLayoutPicker({
  value,
  onChange,
}: {
  value: LayoutKey | null;
  onChange: (v: LayoutKey) => void;
}) {
  return (
    <section className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2">
      {(['classic', 'one-column'] as LayoutKey[]).map((k) => (
        <Card key={k} layout={k} selected={value} onSelect={onChange} />
      ))}
    </section>
  );
}