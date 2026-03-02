# 🌿 BloomSuite Design System Reference

> Use this document when building new features to ensure visual and tonal consistency.

---

## 1. Brand Identity

**Product:** BloomSuite — a marketing automation platform for garden centers and green industry businesses.

**Aesthetic:** Clean, botanical-inspired, Apple-influenced minimalism with a "garden expert" warmth. No harsh neons. Yellow, amber, purple, pink, and fuchsia are actively suppressed to neutral slate/gray.

---

## 2. Color System

### Primary Colors

| Token | Value | Usage |
|---|---|---|
| `--primary` | `hsl(193 81% 20%)` / `#06495d` (Dark Teal) | Primary actions, main CTA backgrounds |
| `--secondary` | `hsl(184 55% 41%)` / `#2c9da3` (Bright Teal) | Secondary actions, CTA buttons |
| `--brand-teal` | `#68BEB9` | Default button bg, focus rings, success indicators |
| `--brand-navy` | `#30506E` / `#3E5A6B` (Steel Blue) | Text headings, ghost button text |

### Accent & Semantic Colors

| Token | Value | Usage |
|---|---|---|
| `--accent` | `#2f3a75` (Deep Indigo) | Accent/depth, foreground text |
| `--destructive` | `#DC2626` | Destructive actions only |
| `--success` / `mint-600` | `#1FA87B` | Success text/badges |
| `--mint-100` | `#E7FAF7` | Success backgrounds |
| `--cta` | `#2c9da3` (Bright Teal) | Call-to-action buttons |

### Surface & Background

| Token | Value | Usage |
|---|---|---|
| `--background` | `hsl(120 25% 98%)` / `#fbfdfa` (Off-White) | Page background |
| `--card` | `#fbfdfa` | Card backgrounds |
| `--sand-50` | `#FBF9F4` | Alternate warm background |
| `--muted` | `hsl(210 40% 96%)` | Muted sections |

### Suppressed Colors

Yellow, amber, orange, purple, pink, fuchsia — **all neutralized** to slate-500 (`#64748B`) scale throughout Tailwind config, CSS overrides, and runtime utilities.

---

## 3. Typography

| Property | Value |
|---|---|
| **Primary Font** | `Quicksand` (body, UI) |
| **Display Font** | `Inter` (display headings) |
| **Fallbacks** | `system-ui, sans-serif` |
| **Body Size** | `1rem` / 16px, line-height `1.5rem` |
| **H1** | `2.25rem` / 36px, weight `800` |
| **H2** | `1.5rem` / 24px, weight `700` |
| **H3** | `1.25rem` / 20px, weight `600` |
| **Small** | `0.875rem` / 14px |
| **XS** | `0.75rem` / 12px |
| **Font Smoothing** | `-webkit-font-smoothing: antialiased` |

---

## 4. Button Variants

| Variant | Style |
|---|---|
| **default** | `bg-brand-teal text-white`, hover: `brightness(0.95)` |
| **outline** | `border-brand-teal text-brand-teal`, hover fills teal |
| **secondary** | `bg-gray-100 text-brand-navy`, hover: `bg-gray-200` |
| **ghost** | `text-brand-navy`, hover: `bg-gray-100` |
| **cta** | `bg-cta text-white rounded-2xl shadow-lg`, hover: scale+shadow |
| **destructive** | `bg-destructive text-white` |
| **success** | `bg-green-600 text-white` |
| **link** | `text-brand-teal underline` |

**Sizes:** `sm` (h-9), `default` (h-10), `lg` (h-11), `icon` (h-10 w-10), `pill` (h-9), `cta` (px-8 py-4 text-lg)

**Micro-interaction:** `active:scale-[0.98]` on all buttons.

---

## 5. Card Styles

| Property | Value |
|---|---|
| **Base** | `rounded-lg border bg-card text-card-foreground shadow-sm` |
| **Padding** | Header/Content/Footer: `p-6` |
| **Interactive** | `.card-interactive` — hover: `shadow-lg -translate-y-0.5 border-gray-300` |
| **Botanical Gradients** | `.botanical-gradient-sage/mint/forest/earth` — subtle brand-tinted gradients |
| **Accent Strip** | `::before` 3px gradient bar on top of cards |

---

## 6. Border Radius & Spacing

| Token | Value |
|---|---|
| `--radius` | `0.5rem` (8px) default |
| **Radius scale** | xs: 4px, sm: 6px, md: 8px, lg: 12px, xl: 16px, 2xl: 20px |
| **Spacing scale** | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 80 / 96px |
| **Grid gap** | `24px` (1.5rem) |
| **Container** | max-width `1400px`, padding `2rem`, centered |

---

## 7. Shadows & Effects

| Level | Value |
|---|---|
| `sm` | `0 1px 2px rgba(0,0,0,0.05)` |
| `md` | `0 4px 6px -1px rgba(0,0,0,0.1)` |
| `lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` |
| **Transition** | `150ms ease` (fast), `300ms ease` (medium), `500ms ease` (slow) |
| **Easing** | `cubic-bezier(0.25, 0.1, 0.25, 1)` (apple) |
| **Focus ring** | `ring-2 ring-brand-teal ring-offset-2` |

---

## 8. Icon Style

- **Library:** `lucide-react` (v0.462)
- **Default size:** `16px` (`[&_svg]:size-4` on buttons)
- **Style:** Outline/stroke icons, clean minimal aesthetic

---

## 9. Voice & Tone

| Attribute | Value |
|---|---|
| **Tone** | Friendly but expert; confident, clear, not salesy |
| **Traits** | Humble, Trustworthy, Locally rooted, Helpful |
| **Contractions** | Yes (`you're`, `it's`, `we'll`) |
| **Expertise** | "Local garden center expert" |
| **CTA style** | Clear, action-oriented, warm |
| **Emojis** | None in generated content (configurable) |
| **Writing pattern** | Hook-first; agitate-before-educate |

---

## 10. Status Chip System

| Status | Color |
|---|---|
| Draft | `#9CA3AF` (gray) |
| Generated | `#3B82F6` (blue) |
| Approved | `#68BEB9` (brand teal) |
| Scheduled | `#3B82F6` (blue) |
| Posted | `#68BEB9` (brand teal) |

All chips: `rounded-full px-2.5 py-0.5 text-xs font-semibold text-white`

---

## 11. Component Patterns (for new features)

When building new features like **"The 5 Minute Marketing Report"**, use:

- **Page background:** `bg-background` (off-white)
- **Section cards:** `<Card>` with `.botanical-gradient-*` and `.botanical-accent-*::before` top strip
- **Headings:** `font-quicksand font-bold text-foreground` (deep indigo)
- **Metric numbers:** `text-3xl font-bold text-primary` (dark teal)
- **CTA button:** `<Button variant="cta" size="cta">` (bright teal, rounded-2xl, shadow-lg)
- **Status indicators:** `mint-100`/`mint-600` for positive, `destructive` for negative
- **Data labels:** `text-sm text-muted-foreground`
- **Dividers:** `border-t border-border`
- **Icons:** `lucide-react`, 16–20px, stroke style
- **Animations:** `framer-motion` for entrance, `.micro-bounce` for interactive elements

---

## 12. Key Files

| File | Purpose |
|---|---|
| `src/index.css` | CSS variables, semantic tokens, utility classes |
| `src/styles/design-system.css` | Component-level styles, status badges, button overrides |
| `src/config/tailwind/colors.ts` | Full Tailwind color config |
| `src/config/tailwind/typography.ts` | Font family, size, weight |
| `src/config/tailwind/spacing.ts` | Spacing & border radius scale |
| `src/config/tailwind/effects.ts` | Shadows, transitions |
| `src/components/ui/button.tsx` | Button component with variants |
| `src/components/ui/card.tsx` | Card component |
| `tailwind.config.ts` | Master Tailwind config |
