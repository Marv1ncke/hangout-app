"use client";
import { useEffect } from "react";

export default function ThemeListener() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      if ((localStorage.getItem("app-theme") || "system") === "system") {
        document.documentElement.classList.toggle("dark", mq.matches);
        document.documentElement.classList.toggle("light", !mq.matches);
      }
    };
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return null;
}