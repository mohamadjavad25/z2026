import { useCallback, useState } from "react";

export function useAppNavigation(initialTab = "profile") {
  const [activeTab, setActiveTab] = useState(initialTab);

  const goToTab = useCallback((tab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.location.hash = tab;
    }
  }, []);

  return { activeTab, setActiveTab, goToTab };
}
