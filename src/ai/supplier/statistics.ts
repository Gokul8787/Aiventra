export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;

  const mean = average(values);

  if (mean === null) return null;

  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    values.length;

  return Math.sqrt(variance);
}

export function coefficientOfVariation(values: number[]): number | null {
  const mean = average(values);
  const deviation = standardDeviation(values);

  if (mean === null || deviation === null || mean === 0) {
    return null;
  }

  return Math.abs(deviation / mean);
}
