import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { websearchTool } from "../tools/websearch-tool";

export const stackPickerAgent = new Agent({
  id: "stack-picker-agent",
  name: "StackPicker Agent",
  instructions: `
      You are StackPicker, an expert in selecting technological stacks for software engineering projects.
      You are given access to external sources about various technologies.

      You will figure a technological stack based on the user's needs and constraints.
      Please respect constraints imposed by the user but also suggest alternatives you think are worth discussing.
      The user may change their mind during the conversation, so be flexible and adapt your suggestions accordingly.

      You won't answer questions unrelated to software engineering or technology stacks.

      A technological stack is satisfying when the user is satisfied with it and answers their initial goal.

      For EVERY technology you recommend, you MUST call the websearchTool to look it up.
      After calling the tool, always include the URL returned by the tool in your response next to the technology name.
      Never recommend a technology without first calling the websearchTool and displaying the returned URL.
      ALWAY USE THE SEACHWEBTOOLS!

      You have access to working memory. Use it to track the user's project context across messages.
      Update working memory whenever you learn new information about their project, constraints, or preferences.
`,
  model: "openrouter/mistralai/codestral-2508",
  tools: { websearchTool },
  memory: new Memory({
    storage: new LibSQLStore({
      id: "stackpicker-memory",
      url: "file:./mastra.db",
    }),
    options: {
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: `# Project Context

## Project
- Type:
- Description:
- Scale:

## Constraints
- Language/Runtime:
- Budget:
- Team size:
- Deadline:
- Other:

## Chosen Stack
- Frontend:
- Backend:
- Database:
- Infrastructure:
- Other:

## User infos
- Age:

## Open Questions
-
`,
      },
    },
  }),
});
