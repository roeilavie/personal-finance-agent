import { generateText, ModelMessage, TypedToolCall } from 'ai';
import type { JSONValue } from '@ai-sdk/provider';
import { google } from '@ai-sdk/google';
import { Expense } from './types';
import { buildAnomalySet, executeTool, ToolContext, tools } from '../tools';
import { appendTurn, compactToolResult } from '../utils/memory-helpers';
import { SYSTEM_PROMPT } from './system-prompt';

// ModelMessage validation rejects `undefined` inside JSON values (e.g. appliedFilters.startDate).
// A JSON round-trip drops those keys and guarantees a valid JSONValue.
const toJsonValue = (value: unknown): JSONValue => JSON.parse(JSON.stringify(value ?? null));

export class FinanceAgent {
  // The full dataset lives only here, never in the messages sent to the model.
  private toolContext: ToolContext;

  // Only past questions and final answers, never tool results or expenses.
  // One shared agent means every user shares this history (fine for a local, single-user exercise).
  private history: ModelMessage[] = [];

  constructor(expenses: Expense[]) {
    this.toolContext = {
      expenses,
      anomalies: buildAnomalySet(expenses),
    };
  }

  // Runs one tool call requested by the model and returns its result.
  private runTool(call: TypedToolCall<typeof tools>): unknown {
    return executeTool(call.toolName, call.input, this.toolContext);
  }

  async run(query: string): Promise<string> {
    // A copy, so the tool messages pushed below never leak into this.history.
    const messages: ModelMessage[] = [...this.history, { role: 'user', content: query }];
    const MAX_ITERATIONS = 10;

    const options = { model: google('gemini-3.5-flash-lite'), system: SYSTEM_PROMPT, tools };

    let result = await generateText({ ...options, messages });

    // If the LLM decides it wants to run tools, the finishReason is 'tool-calls'.
    for (let i = 0; i < MAX_ITERATIONS && result.finishReason === 'tool-calls'; i++) {
      // Keep the assistant's tool-call message in the history.
      messages.push(...result.response.messages);

      // Run every requested tool and send the results back as a tool message.
      messages.push({
        role: 'tool',
        content: result.toolCalls.map((call) => ({
          type: 'tool-result' as const,
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          output: { type: 'json' as const, value: toJsonValue(compactToolResult(call.toolName, this.runTool(call))) },
        })),
      });

      result = await generateText({ ...options, messages });
    }

    // Save the turn only after it finished, so a failed run leaves no half-finished tool calls in memory.
    if (result.text) this.history = appendTurn(this.history, query, result.text);

    return result.text;
  }
}
