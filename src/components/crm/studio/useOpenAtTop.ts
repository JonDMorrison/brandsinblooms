import * as React from "react";

/** How long after opening a scroll the person did not make is undone. */
export const OPEN_AT_TOP_SETTLE_MS = 1500;

const USER_SCROLL_EVENTS = ["wheel", "pointerdown", "touchstart", "keydown"] as const;

/**
 * Studio opens at the top of the email.
 *
 * The page before Studio can leave the window scrolled, and while the email
 * settles (photos load, blocks measure themselves) the canvas could be moved
 * down without the person touching it. It opened about 619px down. For a
 * short time after opening, any scroll the person did not make is put back
 * to the top. Once they scroll, click or press a key, Studio leaves the
 * scroll position to them.
 */
export function useOpenAtTop(ref: React.RefObject<HTMLElement | null>) {
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    node.scrollTop = 0;
    if (typeof window.scrollTo === "function" && window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }

    let personMoved = false;
    let timer = 0;
    const onPersonInput = () => {
      personMoved = true;
      stop();
    };
    const onScroll = () => {
      if (!personMoved && node.scrollTop !== 0) node.scrollTop = 0;
    };
    const stop = () => {
      window.clearTimeout(timer);
      node.removeEventListener("scroll", onScroll);
      USER_SCROLL_EVENTS.forEach((type) =>
        window.removeEventListener(type, onPersonInput, true),
      );
    };

    node.addEventListener("scroll", onScroll);
    USER_SCROLL_EVENTS.forEach((type) =>
      window.addEventListener(type, onPersonInput, true),
    );
    timer = window.setTimeout(stop, OPEN_AT_TOP_SETTLE_MS);

    return stop;
  }, [ref]);
}
