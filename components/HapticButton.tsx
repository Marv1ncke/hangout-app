"use client";

import React from "react";
import { triggerHaptic } from "@/lib/haptics";

interface HapticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  duration?: number;
}

export default function HapticButton({ children, onClick, duration = 15, ...props }: HapticButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    triggerHaptic(duration); // Eerst trillen
    if (onClick) onClick(e); // Daarna de originele actie uitvoeren
  };

  return (
    <button onClick={handleClick} {...props}>
      {children}
    </button>
  );
}