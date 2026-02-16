# Known Issues & Fixes

## Memory Embedding API Key (CRITICAL — Fixed 2026-02-15)

**Problem**: The `memorySearch.remote.apiKey` in `openclaw.json` was set to the literal string `"OPENAI_API_KEY"` instead of the actual key. This caused ALL memory indexing and search to fail silently with 401 errors. Scotty-5 had no long-term memory for an entire day. Research work (AIOS V2) was lost from memory.

**Symptom**: If you (Scotty-5) ever find yourself unable to recall previous conversations, or if a user says "you don't remember", immediately suspect this issue.

**Self-Diagnosis**: Check the gateway logs at `C:\tmp\openclaw\` for lines containing `"memory sync failed"` or `"OPENAI_A**_KEY"` or `401` errors from the embedding subsystem.

**Fix**: The apiKey at `agents.defaults.memorySearch.remote.apiKey` in `C:\Users\Shavoni\.openclaw\openclaw.json` must contain the actual OpenAI API key (starts with `sk-proj-`), NOT a placeholder or env var reference.

**Prevention**:
- Never set memorySearch.remote.apiKey to an environment variable name — OpenClaw expects the literal key value
- After any config change, verify memory is working by checking logs for successful embedding calls
- If memory stops working, alert Shavoni immediately — lost context is unrecoverable without manual backfill

## Windows curl Alias (ACTIVE)

**Problem**: PowerShell aliases `curl` to `Invoke-WebRequest`, which does NOT support `--connect-timeout` or other real curl flags. Running `curl --connect-timeout 5 http://...` fails with: "A positional parameter cannot be found that accepts argument '5'."

**Fix**: ALWAYS use `curl.exe` (not `curl`) when running HTTP requests on this Windows system. This applies to ALL exec commands — health checks, API calls, everything.

**Examples**:
- WRONG: `curl --connect-timeout 5 http://127.0.0.1:11434`
- RIGHT: `curl.exe --connect-timeout 5 http://127.0.0.1:11434`
- ALSO RIGHT: `Invoke-WebRequest -Uri http://127.0.0.1:11434 -TimeoutSec 5`

## Config Corruption (Fixed 2026-02-15)

**Problem**: Terminal output from a conversation got mixed into `openclaw.json`, corrupting the file.

**Prevention**: Never pipe terminal output near config files. Always validate JSON after editing.
