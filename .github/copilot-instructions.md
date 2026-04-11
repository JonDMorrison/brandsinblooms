Prefer MCP tools first whenever they can complete the task safely and directly.

Rules:

- For database inspection, queries, migrations, advisors, and Edge Function management, use Supabase MCP before terminal commands or manual code inspection when the MCP tool supports the task.
- For git, PR, issue, and review operations, use GitKraken/GitLens MCP before raw git CLI when the MCP tool supports the task.
- Use terminal or other tools only when MCP does not support the task, fails, or would be less safe.
- If falling back from MCP, state briefly why MCP was not used.
- Do not use database dump commands unless explicitly requested.
