import { MastraClient } from "@mastra/client-js";

const mastraClient = new MastraClient({
  baseUrl: process.env.MASTRA_API_URL || "https://loud-raspy-insect.mastra.cloud",
});

const agents = await mastraClient.listAgents();
console.log("Available agents:", agents);
