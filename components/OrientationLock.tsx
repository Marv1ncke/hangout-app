"use client";

import { useEffect } from "react";

export default function OrientationLock() {
  useEffect(() => {
    const apply = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobileWidth = Math.min(window.innerWidth, window.innerHeight) <= 932;

      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in window.navigator &&
          (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

      const shouldFakePortrait = isLandscape && isMobileWidth && isStandalone;

      document.documentElement.classList.toggle("fake-portrait", shouldFakePortrait);
    };

    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return null;
}