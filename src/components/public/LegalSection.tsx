import { ReactNode } from 'react';

/** One numbered section of a public legal page, matching PrivacyPage/TermsPage styling. */
export const LegalSection = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) => (
  <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
    <h2 id={`${id}-heading`} className="text-xl font-semibold text-foreground mb-4">
      {title}
    </h2>
    <div className="text-muted-foreground leading-relaxed space-y-4">{children}</div>
  </section>
);

export const LegalList = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc pl-5 space-y-2">
    {items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
);

/** Table of contents with in-page anchors, so reviewers can jump to a section. */
export const LegalContents = ({ sections }: { sections: Array<{ id: string; title: string }> }) => (
  <nav aria-label="On this page" className="mb-10 rounded-lg border border-border bg-muted/30 p-6">
    <p className="text-sm font-semibold text-foreground mb-3">On this page</p>
    <ol className="list-decimal pl-5 space-y-1 text-sm">
      {sections.map((section) => (
        <li key={section.id}>
          <a href={`#${section.id}`} className="text-primary underline hover:text-primary/80">
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  </nav>
);
