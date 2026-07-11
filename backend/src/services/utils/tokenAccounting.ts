export class TokenAccountingService {
  // GPT-4.1 Mini Pricing (July 2026 standard model pricing)
  private readonly PROMPT_COST_PER_1M = 0.15;     // $0.15 per 1M prompt tokens
  private readonly COMPLETION_COST_PER_1M = 0.60; // $0.60 per 1M completion tokens

  public calculateMetrics(promptTokens: number, completionTokens: number): { costUsd: number } {
    const promptCost = (promptTokens / 1_000_000) * this.PROMPT_COST_PER_1M;
    const completionCost = (completionTokens / 1_000_000) * this.COMPLETION_COST_PER_1M;
    const totalCost = Number((promptCost + completionCost).toFixed(6));

    return { costUsd: totalCost };
  }
}
