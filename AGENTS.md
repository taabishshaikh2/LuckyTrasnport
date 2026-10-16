# Project collaboration rules

- Maintain `decision.md` for every meaningful code change. Record the problem, decision, reason, alternatives, accepted tradeoffs, affected files, verification and approval status. Explain library additions or replacements. Do not invent historical rationale; label observations separately.
- Maintain `flow.md` when entry points, calls, data movement or execution order change. Use actual file/function names and distinguish branches from sequential calls.
- Before treating any change as accepted, quiz the user briefly on its behaviour and tradeoff. Prepare and verify the reviewable change first, then ask 1-3 plain-language questions and wait for their answers. Explain misunderstandings and resolve them before recording acceptance. Silence is not acceptance. Do not commit, push or deploy pending changes until the quiz is resolved and the relevant action is authorized. An explicit user instruction waiving or modifying the quiz takes precedence.
- Preserve unrelated local changes. Never put credentials, reset tokens or customer data in these documents.
