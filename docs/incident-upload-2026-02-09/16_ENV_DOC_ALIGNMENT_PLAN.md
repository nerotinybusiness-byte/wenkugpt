# Env/Docs Alignment Plan

Date: 2026-02-09
Status: done

## Goal
Remove env/docs drift around `ALLOW_HEADERLESS_AUTH` and close remaining UI polish item.

## Scope
- `src/components/chat/ChatPanel.tsx`: fix typo `truncat` -> `truncate`.
- `.env.example`: remove obsolete `ALLOW_HEADERLESS_AUTH`.
- `README.md` and `docs/api.md`: explicitly document that `ALLOW_HEADERLESS_AUTH` is not used.
- Incident docs: record closure evidence for risk #3.

## Steps
1. Apply UI class fix.
2. Remove obsolete env key from template.
3. Align user-facing docs.
4. Update incident risk and live log.
5. Validate lint + grep checks.

## Validation
- `npm run lint`
- `rg -n "ALLOW_HEADERLESS_AUTH" .`
