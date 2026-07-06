"use client";
import { useNavData } from "@/hooks/useNavData";

export const NavIsland = () => {
  const { data: navData } = useNavData();
  
  if (!navData) return null;

  // Render hier NIETS dat je pagina's forceert te re-renderen
  // Dit is alleen voor je Header/Nav UI
  return (
    <div id="nav-island-hidden" className="hidden">
      {/* Eventuele globale nav UI elementen */}
    </div>
  );
};