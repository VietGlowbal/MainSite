import rawCostReferences from '../data/cost-references.v1.json';
import rawFxRates from '../data/fx-rates.v1.json';
import {
  createCostReferenceProvider,
  parseCostReferenceDataset,
  type CostReferenceProvider,
} from '../domain/cost-reference';
import {
  createFxReferenceProvider,
  parseFxReferenceDataset,
  type FxReferenceProvider,
} from '../domain/fx-reference';

const costReferenceDataset = parseCostReferenceDataset(rawCostReferences);
const fxReferenceDataset = parseFxReferenceDataset(rawFxRates);

/** Validated metadata for the file-backed cost dataset. */
export const FILE_COST_REFERENCE_DATASET = costReferenceDataset;

/** Validated metadata for the file-backed FX dataset. */
export const FILE_FX_REFERENCE_DATASET = fxReferenceDataset;

/**
 * Build a deterministic provider from the versioned cost file. The file is
 * deliberately empty until authoritative references are curated.
 */
export function getFileCostReferenceProvider(): CostReferenceProvider {
  return createCostReferenceProvider(costReferenceDataset);
}

/**
 * Build a deterministic FX provider from the versioned FX file. `asOf` is
 * supplied by the caller so freshness decisions never depend on wall-clock
 * time hidden inside the provider.
 */
export function getFileFxReferenceProvider(options: {
  asOf: string;
  maxAgeDays?: number | null;
}): FxReferenceProvider {
  return createFxReferenceProvider(fxReferenceDataset, options);
}
