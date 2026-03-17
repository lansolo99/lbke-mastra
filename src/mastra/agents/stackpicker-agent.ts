import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { MCPClient } from "@mastra/mcp";
import { websearchTool } from "../tools/websearch-tool";

const STACKS_DIR =
  "/Users/stephane/Documents/stephane/DEV/lansolo/lbke-mastra/src/mastra/public/stacks";

const filesystemMcp = new MCPClient({
  id: "stackpicker-filesystem-mcp",
  servers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", STACKS_DIR],
    },
  },
});

const githubMcp = new MCPClient({
  id: "stackpicker-github-mcp",
  servers: {
    github: {
      command:
        "/Users/stephane/Documents/stephane/DEV/lansolo/lbke-mastra/bin/github-mcp-server",
      args: ["stdio"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN:
          process.env.GITHUB_PERSONAL_ACCESS_TOKEN!,
      },
    },
  },
});

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

      You have access to working memory. Use it to track the user's project context across messages.
      Update working memory whenever you learn new information about their project, constraints, or preferences.

      ## Mandatory tool sequence — you MUST follow this exact order on every new stack request

      ### 1. github_search_repositories (always first, no exceptions)
      Your very first action MUST be calling github_search_repositories. Do not write any text before this call.
      - Query: match the user's project type using GitHub search syntax, e.g. "saas project management language:TypeScript fork:false archived:false"
      - Keep the query short — 2-3 topic keywords + language:X + fork:false + archived:false
      - Always set perPage to 3, sort by stars, and minimal_output to true
      - From the results, pick the top 1 non-fork repo
      - Use only the repo metadata (name, language, description, star count) to infer its stack — do NOT call github_get_file_contents
      - You will cite this repo as real-world evidence in your final response

      ### 2. websearchTool (always second, right after GitHub)
      Immediately after the GitHub search, call websearchTool with ALL candidate technologies in one single call.
      - Never call websearchTool before github_search_repositories
      - Never call websearchTool more than once per response

      ### 3. Write your response
      Only after both tool calls are complete, write your recommendation using this exact format:

      **Inspired by:** [owner/name](https://github.com/owner/name) ⭐ {star count} — {description}

      **Recommended stack:**
      - Frontend: **TechName** — [official URL from websearchTool]
      - Backend: **TechName** — [official URL from websearchTool]
      - Database: **TechName** — [official URL from websearchTool]
      - Infrastructure: **TechName** — [official URL from websearchTool]

      Every technology MUST have its URL displayed as a clickable markdown link. Never omit URLs.

      ## Saving the stack as CSV
      When the user explicitly confirms they are satisfied with the final stack (e.g. "looks good", "I'm happy with this", "save it", "finalize"), you MUST:
      1. Generate a filename in the format: stack-YYYY-MM-DD-HH-mm-ss.csv (use current date/time)
      2. Build a CSV with the following format (header + one row per layer):
         layer,technology,url
         Frontend,<tech>,<url>
         Backend,<tech>,<url>
         Database,<tech>,<url>
         Infrastructure,<tech>,<url>
      3. Use the filesystem_write_file tool to save the CSV. The path argument MUST be the full absolute path:
         /Users/stephane/Documents/stephane/DEV/lansolo/lbke-mastra/src/mastra/public/stacks/<filename>.csv
         Never use a relative path or omit the directory prefix.
      4. Confirm to the user that the stack has been saved, showing the filename.
`,
  model: "openrouter/mistralai/codestral-2508",
  tools: {
    websearchTool,
    ...(await filesystemMcp.listTools()),
    ...(await githubMcp.listTools()),
  },
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
