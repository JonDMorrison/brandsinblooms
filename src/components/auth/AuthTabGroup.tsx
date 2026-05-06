import type { CSSProperties, KeyboardEvent } from "react";

export interface AuthTabOption<TValue extends string> {
  value: TValue;
  label: string;
}

interface AuthTabGroupProps<TValue extends string> {
  value: TValue;
  options: AuthTabOption<TValue>[];
  onValueChange: (value: TValue) => void;
  ariaLabel: string;
}

export const AuthTabGroup = <TValue extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
}: AuthTabGroupProps<TValue>) => {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = options.findIndex(
      (option) => option.value === event.currentTarget.dataset.value,
    );

    if (currentIndex < 0) {
      return;
    }

    const focusOption = (index: number) => {
      const nextOption = options[index];

      if (!nextOption) {
        return;
      }

      onValueChange(nextOption.value);
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>(
            `[data-auth-tab-value="${nextOption.value}"]`,
          )
          ?.focus();
      });
    };

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusOption((currentIndex + 1) % options.length);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption((currentIndex - 1 + options.length) % options.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusOption(options.length - 1);
    }
  };

  return (
    <div
      className="auth-tab-group"
      role="tablist"
      aria-label={ariaLabel}
      style={
        {
          "--auth-tab-count": options.length,
          "--auth-tab-index": activeIndex,
        } as CSSProperties
      }
    >
      <span className="auth-tab-group__pill" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="auth-tab-group__button"
          data-auth-tab-value={option.value}
          data-value={option.value}
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onValueChange(option.value)}
          onKeyDown={handleKeyDown}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
