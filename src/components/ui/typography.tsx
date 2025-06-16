
import React from 'react';
import { cn } from '@/lib/utils';

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
}

// Display Typography - For large headings and hero text
export const DisplayLarge = ({ children, className, as: Component = 'h1' }: TypographyProps) => (
  <Component className={cn('text-5xl font-bold text-text-primary leading-tight tracking-tight', className)}>
    {children}
  </Component>
);

export const DisplayMedium = ({ children, className, as: Component = 'h1' }: TypographyProps) => (
  <Component className={cn('text-4xl font-bold text-text-primary leading-tight tracking-tight', className)}>
    {children}
  </Component>
);

export const DisplaySmall = ({ children, className, as: Component = 'h2' }: TypographyProps) => (
  <Component className={cn('text-3xl font-bold text-text-primary leading-tight', className)}>
    {children}
  </Component>
);

// Headline Typography - For section headers
export const HeadlineLarge = ({ children, className, as: Component = 'h2' }: TypographyProps) => (
  <Component className={cn('text-2xl font-semibold text-text-primary leading-tight', className)}>
    {children}
  </Component>
);

export const HeadlineMedium = ({ children, className, as: Component = 'h3' }: TypographyProps) => (
  <Component className={cn('text-xl font-semibold text-text-primary leading-normal', className)}>
    {children}
  </Component>
);

export const HeadlineSmall = ({ children, className, as: Component = 'h4' }: TypographyProps) => (
  <Component className={cn('text-lg font-medium text-text-primary leading-normal', className)}>
    {children}
  </Component>
);

// Body Typography - For main content
export const BodyLarge = ({ children, className, as: Component = 'p' }: TypographyProps) => (
  <Component className={cn('text-base font-normal text-text-primary leading-relaxed', className)}>
    {children}
  </Component>
);

export const BodyMedium = ({ children, className, as: Component = 'p' }: TypographyProps) => (
  <Component className={cn('text-sm font-normal text-text-primary leading-relaxed', className)}>
    {children}
  </Component>
);

export const BodySmall = ({ children, className, as: Component = 'p' }: TypographyProps) => (
  <Component className={cn('text-xs font-normal text-text-secondary leading-normal', className)}>
    {children}
  </Component>
);

// Label Typography - For UI labels and captions
export const LabelLarge = ({ children, className, as: Component = 'span' }: TypographyProps) => (
  <Component className={cn('text-sm font-medium text-text-primary leading-normal', className)}>
    {children}
  </Component>
);

export const LabelMedium = ({ children, className, as: Component = 'span' }: TypographyProps) => (
  <Component className={cn('text-xs font-medium text-text-secondary leading-normal uppercase tracking-wide', className)}>
    {children}
  </Component>
);

export const LabelSmall = ({ children, className, as: Component = 'span' }: TypographyProps) => (
  <Component className={cn('text-xs font-normal text-text-tertiary leading-normal', className)}>
    {children}
  </Component>
);

// Caption Typography - For small text and metadata
export const CaptionLarge = ({ children, className, as: Component = 'span' }: TypographyProps) => (
  <Component className={cn('text-sm font-normal text-text-secondary leading-normal', className)}>
    {children}
  </Component>
);

export const CaptionMedium = ({ children, className, as: Component = 'span' }: TypographyProps) => (
  <Component className={cn('text-xs font-normal text-text-secondary leading-normal', className)}>
    {children}
  </Component>
);

export const CaptionSmall = ({ children, className, as: Component = 'span' }: TypographyProps) => (
  <Component className={cn('text-xs font-normal text-text-tertiary leading-tight', className)}>
    {children}
  </Component>
);
