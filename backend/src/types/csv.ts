/**
 * Raw row extracted from the CSV via client-side parsing.
 * - Every CSV cell is represented as a string.
 * - Empty cells are represented as "".
 * - Values are never null or undefined.
 * - This matches CSV parser (e.g., PapaParse) behaviour.
 */
export type CSVRow = Record<string, string>;
