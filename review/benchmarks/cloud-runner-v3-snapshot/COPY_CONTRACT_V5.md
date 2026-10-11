# Copy contract v5 rerun

Root-authored generation schema binds reference IDs, decision action, null question selection, and text limits to existing runtime admission. Runtime validation and independent semantic review are unchanged. Eleven focused tests and independent mock invalid-response settlement checks passed. Live provider acceptance is untested.

The run.ts entrypoint now targets a NEW run, 3a11bffe-775d-4a96-8a96-00a2bbb93d95, with the unchanged dataset. The earlier README describes the preserved original run. Never reset it or reuse its claims. New run creation must enforce the same 15-call/$0.10 cap and a two-hour expiry.

Use NODE_USE_ENV_PROXY=1 with Node 24 so requests use the environment's configured network-secret proxy. Keep normal TLS certificate validation. Never print keys or proxy credentials.
