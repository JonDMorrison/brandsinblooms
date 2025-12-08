import React from 'react';

interface IntegrationSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function IntegrationSection({ title, description, icon, children }: IntegrationSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </section>
  );
}
