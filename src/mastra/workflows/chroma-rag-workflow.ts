import { createStep, createWorkflow } from "@mastra/core/workflows"
import { z } from "zod"
import { openrouter } from "@openrouter/ai-sdk-provider"
import { embed, generateText } from "ai"
import { CloudClient } from "chromadb"

const CHROMA_COLLECTION = "doc_ingestion"

const model = openrouter("mistralai/mistral-small-3.2-24b-instruct")
const embeddingModel = openrouter.textEmbeddingModel("mistralai/mistral-embed-2312")

function createChromaClient() {
  return new CloudClient({
    apiKey: process.env.CHROMA_API_KEY!,
    tenant: "9a1d7711-7825-4f60-a83c-152bc2f1039c",
    database: "mastra-mars-2026",
  })
}

const docSchema = z.object({
  source: z.string(),
  content: z.string(),
})
type Doc = z.infer<typeof docSchema>

const userQuestionSchema = z.object({
  question: z.string(),
})
const augmentedQuerySchema = userQuestionSchema.extend({
  documents: z.array(docSchema),
})
const resultSchema = augmentedQuerySchema.extend({
  answer: z.string(),
})

async function fetchRelevantDocuments(question: string): Promise<Array<Doc>> {
  const client = createChromaClient()
  const collection = await client.getCollection({ name: CHROMA_COLLECTION })
  const { embedding } = await embed({ model: embeddingModel, value: question })
  const { documents, metadatas } = await collection.query({
    queryEmbeddings: [embedding],
    nResults: 3,
  })
  return documents[0].map((d, i) => ({
    source: (metadatas?.[0]?.[i]?.source as string) ?? "unknown",
    content: d ?? "<empty document>",
  }))
}

const retrieval = createStep({
  id: "retrieval",
  description: "Embeds the question and retrieves relevant chunks from ChromaDB Cloud",
  inputSchema: userQuestionSchema,
  outputSchema: augmentedQuerySchema,
  execute: async ({ inputData }) => {
    const documents = await fetchRelevantDocuments(inputData.question)
    return { ...inputData, documents }
  },
})

const augmentedGeneration = createStep({
  id: "augmented-generation",
  description: "Generates an answer grounded in the retrieved documents",
  inputSchema: augmentedQuerySchema,
  outputSchema: resultSchema,
  execute: async ({ inputData }) => {
    const prompt = `
User asked the following question:
<user_question>
${inputData.question}
</user_question>
We found the following relevant documents:
<relevant_documents>
${
  inputData.documents.length
    ? inputData.documents.map((d) => JSON.stringify(d, null, 2)).join("\n\n")
    : "No document matched the question."
}
</relevant_documents>
Answer the user question based on the relevant documents.
`
    const { text } = await generateText({ model, prompt })
    return { ...inputData, answer: text }
  },
})

export const chromaRagWorkflow = createWorkflow({
  id: "chroma-rag",
  description: "Answers questions using documents ingested from URLs via the doc-ingestion workflow.",
  inputSchema: userQuestionSchema,
  outputSchema: resultSchema,
})
  .then(retrieval)
  .then(augmentedGeneration)
  .commit()
