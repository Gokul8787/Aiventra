export function createTimer() {
  const start = performance.now();

  return {
    elapsedMs() {
      return Math.round(performance.now() - start);
    },
  };
}
