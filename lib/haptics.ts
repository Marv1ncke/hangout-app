export const triggerHaptic = (duration = 15) => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  };