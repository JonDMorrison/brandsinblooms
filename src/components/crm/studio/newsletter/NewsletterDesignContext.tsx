import { createContext, useContext } from "react";
import type { NewsletterSettings } from "@/types/newsletterDesign";
export const NewsletterDesignContext = createContext<{
  settings?: NewsletterSettings;
  onChange?: (settings: NewsletterSettings) => void;
}>({});
export const useNewsletterDesign = () => useContext(NewsletterDesignContext);
