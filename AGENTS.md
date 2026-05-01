# AI Coding Agent Instructions

## Code Modification Rules
- When the user requests changes to existing code, do NOT regenerate the entire file.
- Use surgical edits (`edit_file` or `multi_edit_file`) to only modify the necessary lines.
- Always aim to show exactly what was added or changed through targeted tool calls.
