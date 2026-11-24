import { tool } from 'ai';
import { z } from 'zod';
import {
  applyFilters,
  filterParamsSchema,
  pickFilters,
  round2,
  ToolContext,
} from './filters';
import { max, mean, median, min, sum } from '../utils/math-helpers';

const calculateStatisticsSchema = filterParamsSchema.extend({
  metric: z
    .enum(['sum', 'avg', 'median', 'min', 'max', 'count'])
    .describe('The single statistic to calculate over the matching expenses'),
});

export type CalculateStatisticsInput = z.infer<typeof calculateStatisticsSchema>;

export const calculateStatisticsTool = tool({
  description:
    'Calculate ONE statistic (sum, avg, median, min, max or count) over the expenses ' +
    'matching the given filters. Use for "total spent on dining", "average grocery ' +
    'expense" or "median of transportation costs". All filters are optional.',
  inputSchema: calculateStatisticsSchema,
});

export const calculateStatistics = (
  input: CalculateStatisticsInput,
  ctx: ToolContext
) => {
  const amounts = applyFilters(ctx.expenses, input, ctx.anomalies).map(
    (e) => e.amount
  );
  const appliedFilters = pickFilters(input);

  if (amounts.length === 0) {
    return {
      metric: input.metric,
      value: input.metric === 'count' || input.metric === 'sum' ? 0 : null,
      count: 0,
      appliedFilters,
      note: 'No expenses matched the given filters.',
    };
  }

  let value: number;
  switch (input.metric) {
    case 'sum':
      value = sum(amounts);
      break;
    case 'avg':
      value = mean(amounts);
      break;
    case 'median':
      value = median(amounts);
      break;
    case 'min':
      value = min(amounts);
      break;
    case 'max':
      value = max(amounts);
      break;
    case 'count':
      value = amounts.length;
      break;
  }

  return {
    metric: input.metric,
    value: round2(value),
    count: amounts.length,
    appliedFilters,
  };
};
