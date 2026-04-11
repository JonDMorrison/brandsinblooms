/**
 * Emergency cleanup utility to remove blocking inert attributes
 * Call this when page becomes unclickable
 */

export const removeAllInertAttributes = () => {
  // Remove inert from all elements
  const allElements = document.querySelectorAll("[inert]");
  allElements.forEach((el) => {
    el.removeAttribute("inert");
  });

  // Ensure body scrolling is enabled
  document.body.style.overflow = "";
  document.body.classList.remove("overflow-hidden");

  // Remove any pointer-events blocks
  document.body.style.pointerEvents = "";
};

// Auto-run cleanup on import
if (typeof window !== "undefined") {
  removeAllInertAttributes();
}
