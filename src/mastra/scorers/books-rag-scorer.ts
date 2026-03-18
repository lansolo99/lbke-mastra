import { z } from 'zod';
import { createScorer } from '@mastra/core/evals';
import {
  getAssistantMessageFromRunOutput,
  getUserMessageFromRunInput,
} from '@mastra/evals/scorers/utils';

// LLM-as-a-judge scorer: evaluates if the answer is grounded in book content
export const booksContextualRelevancyScorer = createScorer({
  id: 'books-contextual-relevancy',
  name: 'Books Contextual Relevancy',
  description:
    'Evaluates whether the assistant response is grounded in and relevant to the book content, not hallucinated',
  type: 'agent',
  judge: {
    model: 'openrouter/mistralai/mistral-nemo',
    instructions:
      'You are an expert evaluator for RAG (retrieval-augmented generation) systems. ' +
      'Your job is to assess whether an assistant response is grounded in the retrieved book context, ' +
      'and whether it actually answers the user question. ' +
      'Return only the structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const userQuestion = getUserMessageFromRunInput(run.input) || '';
    const assistantAnswer = getAssistantMessageFromRunOutput(run.output) || '';
    return { userQuestion, assistantAnswer };
  })
  .analyze({
    description: 'Assess relevancy and groundedness of the answer',
    outputSchema: z.object({
      answersQuestion: z.boolean(),
      grounded: z.boolean(),
      hallucinated: z.boolean(),
      confidence: z.number().min(0).max(1).default(1),
      explanation: z.string().default(''),
    }),
    createPrompt: ({ results }) => `
You are evaluating a RAG assistant that answers questions based on book content.

User question:
"""
${results.preprocessStepResult.userQuestion}
"""

Assistant answer:
"""
${results.preprocessStepResult.assistantAnswer}
"""

Tasks:
1) Does the assistant answer actually address the user's question? (answersQuestion)
2) Does the answer appear to be grounded in book content (not generic or invented)? (grounded)
3) Does the answer contain statements that seem fabricated or not supported by any plausible book content? (hallucinated)
4) Rate your confidence in this evaluation (0-1).
5) Briefly explain your reasoning.

Return JSON with fields:
{
  "answersQuestion": boolean,
  "grounded": boolean,
  "hallucinated": boolean,
  "confidence": number,
  "explanation": string
}
    `,
  })
  .generateScore({
    description: 'Compute a 0-1 score based on groundedness, relevancy and hallucination',
    outputSchema: z.object({
      score: z.number().min(0).max(1),
      rationale: z.string(),
    }),
    createPrompt: ({ results }) => {
      const r = results.analyzeStepResult;
      return `
Based on the following analysis of a RAG assistant response, compute a final score between 0 and 1.

Analysis:
- answersQuestion: ${r.answersQuestion}
- grounded: ${r.grounded}
- hallucinated: ${r.hallucinated}
- confidence: ${r.confidence}
- explanation: ${r.explanation}

Scoring rules:
- If hallucinated is true → score must be 0
- If answersQuestion is false → score must be 0.1
- If grounded and answersQuestion are both true → score = 0.7 + (0.3 * confidence), clamped to [0, 1]
- Otherwise → score = 0.4

Return JSON:
{
  "score": number,
  "rationale": string
}
      `;
    },
    calculateScore: ({ analyzeStepResult }) => {
      const r = analyzeStepResult as { score: number };
      return Math.max(0, Math.min(1, r.score ?? 0));
    },
  })
  .generateReason({
    description: 'Explain the contextual relevancy score in plain language',
    createPrompt: ({ results, score }) => {
      const analyze = results.analyzeStepResult;
      const scoreResult = results.generateScoreStepResult as { rationale?: string } | undefined;
      return `
Write a concise 1-2 sentence explanation for why a RAG assistant response received a contextual relevancy score of ${score}.

Analysis:
- Answers the question: ${analyze.answersQuestion}
- Grounded in book content: ${analyze.grounded}
- Contains hallucinations: ${analyze.hallucinated}
- Confidence: ${analyze.confidence}
- LLM explanation: ${analyze.explanation}
- Score rationale: ${scoreResult?.rationale ?? ''}

Return a plain string (no JSON).
      `;
    },
  });

export const booksScorers = {
  booksContextualRelevancyScorer,
};
