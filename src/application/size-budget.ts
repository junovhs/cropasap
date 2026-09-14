/** A measured encoding. Only a blob actually within the limit counts as a fit. */
export interface BudgetEncoding {
  readonly blob: Blob;
  readonly quality: number;
  readonly met: boolean;
}

export const MIN_CONVERT_QUALITY = 0.1;
const SEARCH_STEPS = 8;

/**
 * Search a lossy encoder without changing dimensions. At most ten encodes:
 * the two endpoints and eight refinements. Return the highest-quality fit
 * measured, or the smallest endpoint when the quality range cannot meet it.
 */
export async function searchSizeBudget(
  encodeAtQuality: (quality: number) => Promise<Blob>,
  maxBytes: number,
  onProgress?: (fraction: number) => void,
): Promise<BudgetEncoding> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Choose a positive whole-byte file size limit');
  }
  let passes = 0;
  const measure = async (quality: number): Promise<BudgetEncoding> => {
    const blob = await encodeAtQuality(quality);
    onProgress?.(++passes / (SEARCH_STEPS + 2));
    return { blob, quality, met: blob.size <= maxBytes };
  };
  const best = await measure(1);
  if (best.met) { onProgress?.(1); return best; }
  let fit = await measure(MIN_CONVERT_QUALITY);
  if (!fit.met) {
    onProgress?.(1);
    return fit.blob.size <= best.blob.size ? fit : best;
  }
  let lower = MIN_CONVERT_QUALITY;
  let upper = 1;
  for (let step = 0; step < SEARCH_STEPS; step++) {
    const candidate = await measure((lower + upper) / 2);
    if (candidate.met) { fit = candidate; lower = candidate.quality; }
    else upper = candidate.quality;
  }
  return fit;
}
