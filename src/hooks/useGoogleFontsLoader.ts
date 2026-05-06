import * as React from "react";

export function useGoogleFontsLoader(fontUrls: string[]) {
  const normalizedFontUrls = React.useMemo(
    () => Array.from(new Set(fontUrls.filter(Boolean))),
    [fontUrls],
  );

  React.useEffect(() => {
    const createdLinks: HTMLLinkElement[] = [];

    normalizedFontUrls.forEach((fontUrl) => {
      const linkId = `studio-google-font-${encodeURIComponent(fontUrl)}`;
      const existingLink = document.head.querySelector<HTMLLinkElement>(
        `link[data-studio-google-font="${linkId}"]`,
      );

      if (existingLink) {
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = fontUrl;
      link.dataset.studioGoogleFont = linkId;
      document.head.appendChild(link);
      createdLinks.push(link);
    });

    return () => {
      createdLinks.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [normalizedFontUrls]);
}
