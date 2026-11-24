import { z } from 'zod';
import { Expense } from '../agent/types';
import { isBetween } from '../utils/date-helpers';
import { groupBy } from '../utils/array-helpers';
import { detectAnomalies } from '../utils/anomaly-helper';

export const CATEGORIES = [
  'utilities',
  'health',
  'subscriptions',
  'transportation',
  'shopping',
  'dining',
  'groceries',
  'entertainment',
] as const;

// An expense is an anomaly when it is more than k standard deviations
// above the mean of its own category.
export const ANOMALY_THRESHOLD = 2;

// Shared by all three tools, so each one is self-contained.
export const filterParamsSchema = z.object({
  startDate: z
    .string()
    .optional()
    .describe('Inclusive start date in YYYY-MM-DD format'),
  endDate: z
    .string()
    .optional()
    .describe('Inclusive end date in YYYY-MM-DD format'),
  category: z
    .enum(CATEGORIES)
    .optional()
    .describe('Only include expenses in this category'),
  minAmount: z
    .number()
    .optional()
    .describe('Only include expenses with amount >= this value'),
  maxAmount: z
    .number()
    .optional()
    .describe('Only include expenses with amount <= this value'),
  excludeAnomalies: z
    .boolean()
    .optional()
    .describe('Drop unusually large one-off expenses (statistical outliers)'),
});

export type FilterParams = z.infer<typeof filterParamsSchema>;

export interface ToolContext {
  expenses: Expense[];
  anomalies: Set<Expense>;
}

// Computed once per agent. Detection runs per category and the result is
// stored by object identity, so it does not change with the query's filters.
export const buildAnomalySet = (expenses: Expense[]): Set<Expense> => {
  const byCategory = groupBy(expenses, (e) => e.category ?? 'uncategorized');
  const anomalies = new Set<Expense>();

  for (const group of Object.values(byCategory)) {
    for (const expense of detectAnomalies(group, ANOMALY_THRESHOLD)) {
      anomalies.add(expense);
    }
  }

  return anomalies;
};

export const applyFilters = (
  expenses: Expense[],
  params: FilterParams,
  anomalies: Set<Expense>
): Expense[] => {
  return expenses.filter((e) => {
    if (params.category && e.category !== params.category) return false;
    if (!isBetween(e.date, params.startDate, params.endDate)) return false;
    if (params.minAmount !== undefined && e.amount < params.minAmount) return false;
    if (params.maxAmount !== undefined && e.amount > params.maxAmount) return false;
    if (params.excludeAnomalies && anomalies.has(e)) return false;
    return true;
  });
};

// Echoes back only the filters that were actually used, so the model can
// reuse them in follow-up questions.
export const pickFilters = (params: FilterParams): FilterParams => ({
  startDate: params.startDate,
  endDate: params.endDate,
  category: params.category,
  minAmount: params.minAmount,
  maxAmount: params.maxAmount,
  excludeAnomalies: params.excludeAnomalies,
});

export const round2 = (n: number): number => Math.round(n * 100) / 100;
