interface SectionEyebrowProps {
  children: string;
}

export const SectionEyebrow = ({ children }: SectionEyebrowProps) => (
  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#3E7C77]">
    {children}
  </p>
);

export default SectionEyebrow;
