/**
 * Honest, explainable scoring utilities for CultureGraph.
 *
 * Raw Qloo affinity scores are always preserved. The relative index is a
 * min-max normalization within the current result set — it is NOT a
 * calibrated probability, audience overlap percentage, or prediction.
 *
 * Do not compare relative indices across unrelated queries.
 */

/**
 * Computes a 0–100 relative index for display purposes only.
 *
 * This is a simple min-max normalization within the current candidate set.
 * It should NOT be compared across queries or interpreted as a probability.
 * When all scores are equal, all candidates receive 50.
 */
export function computeRelativeIndex(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (max === min) return scores.map(() => 50);
  return scores.map((s) => Math.round(((s - min) / (max - min)) * 100));
}

/**
 * Applies relative indices to a list of items with optional affinity scores.
 * Preserves raw affinity and adds a relativeIndex that is clearly scoped
 * to the current result set.
 */
export function applyRelativeIndices<T extends { affinity?: number }>(
  items: T[],
): (T & { relativeIndex?: number })[] {
  const affinities = items.map((i) => i.affinity ?? 0);
  const indices = computeRelativeIndex(affinities);
  return items.map((item, i) => ({
    ...item,
    relativeIndex: item.affinity !== undefined ? indices[i] : undefined,
  }));
}
