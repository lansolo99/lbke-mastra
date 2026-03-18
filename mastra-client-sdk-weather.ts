import { MastraClient } from "@mastra/client-js";

const mastraClient = new MastraClient({
  baseUrl: process.env.MASTRA_API_URL || "https://loud-raspy-insect.mastra.cloud",
});

const agent = mastraClient.getAgent("weather-agent");

const response = await agent.stream([
  { role: "user", content: "what weather in Stockholm?" },
]);

await response.processDataStream({
  onChunk: async (chunk) => {
    if (chunk.type === "tool-call") {
      console.log("I'm calling a tool!!!");
      console.log(
        `\n[tool-call] ${chunk.payload.toolName}`,
        chunk.payload.args,
      );
    } else if (chunk.type === "tool-result") {
      console.log(
        `[tool-result] ${chunk.payload.toolName}`,
        chunk.payload.result,
      );
    } else if (chunk.type === "text-delta") {
      process.stdout.write(chunk.payload.text);
    }
  },
});

console.log();
