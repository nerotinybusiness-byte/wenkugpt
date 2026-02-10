# Validation Checklist

## Core SPA behavior
- [ ] Clicking `Manage Files` in chat opens modal and does not navigate to `/files`.
- [ ] URL remains `/` while modal is open.
- [ ] Modal can be closed with close button, `Esc`, and outside click.

## Files functionality parity
- [ ] Upload PDF/TXT works from modal.
- [ ] File list refreshes after successful upload.
- [ ] Single delete works from modal list.
- [ ] Bulk delete works from modal list.
- [ ] Document preview opens and closes correctly in modal flow.

## Legacy route fallback
- [ ] Direct visit to `/files` still renders Knowledge Base UI.
- [ ] Upload/list/delete/preview still works on `/files`.

## Regression checks
- [ ] Chat history/state is preserved after opening and closing Manage Files modal.
- [ ] Settings dialog still works as before.
- [ ] Mobile layout has no horizontal overflow and remains usable.

## Automated checks
- [x] `npx tsc --noEmit --incremental false`
- [x] `npm run lint`
- [x] `npm run test:run`
- [x] `npm run build`
