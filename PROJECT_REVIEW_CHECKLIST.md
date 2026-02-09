# WenkuGPT Project Review Checklist

> Cíl: projít projekt postupně, opravovat po malých blocích a po každém bloku mít měřitelný výsledek.

## Pravidla práce (Rule Set)

- [ ] Pracujeme po fázích, nikdy ne více než 1 fázi současně.
- [ ] Každá fáze končí validací (`lint`, `tsc`, `test`, `build` podle rozsahu).
- [ ] Každý krok má ownera, datum, stav a krátký výsledek.
- [ ] Žádné "bokem" změny mimo aktivní fázi.
- [ ] Každý fix musí mít regresní kontrolu (aspoň manuální scénář).
- [ ] Když krok selže, přidat poznámku s root cause a dalším akčním krokem.

## Stavové štítky

- [ ] `TODO` - neřešeno
- [ ] `IN_PROGRESS` - právě řešíme
- [ ] `BLOCKED` - blokováno externě/závislostí
- [ ] `DONE` - hotovo a ověřeno

## Fáze 0: Baseline a guardrails

### 0.1 Baseline snapshot
- [x] Zapsat aktuální výsledky: `npm run lint`
- [x] Zapsat aktuální výsledky: `npx tsc --noEmit --incremental false`
- [x] Zapsat aktuální výsledky: `npm run test:run`
- [x] Zapsat aktuální výsledky: `npm run build`

### 0.2 Dohoda na quality gate
- [x] Definovat minimální průchod: `lint=0 errors`, `tsc=0 errors`, `test=PASS`, `build=PASS` (bez pádu)
- [x] Definovat lint cíl: ideálně `0 warnings`; pokud warningy existují, musí být evidované s návrhem řešení
- [x] Potvrdit CI pořadí: lint -> tsc -> test -> build

## Fáze 1: Release blokery (P0)

### 1.1 Compile a query chyby
- [x] Opravit `src/app/api/documents/route.ts` (cursor + `lt(...)` použití)
- [x] Opravit `src/app/api/history/route.ts` (query builder + `where` chaining)
- [x] Opravit `src/middleware.ts` (`logWarn` signatura / volání)

### 1.2 Edge runtime kompatibilita
- [x] Opravit `src/lib/logger.ts` (odstranit Node-only `crypto` import pro edge)
- [x] Ověřit že middleware nemá Node-only import trace

### 1.3 Validace fáze
- [x] `npx tsc --noEmit --incremental false` = PASS
- [x] `npm run build` = PASS

## Fáze 2: Upload PDF a `DOMMatrix` chyba (P0)

### 2.1 Závislosti a runtime
- [x] Ujistit se, že `@napi-rs/canvas` je explicitně v `dependencies`
- [x] Ověřit `next.config.ts` (`serverExternalPackages`) dle potřeby runtime

### 2.2 Parser polyfill hardening
- [x] Zpevnit `ensurePdfNodePolyfills()` v `src/lib/ingest/parser.ts`
- [x] Přidat robustní fallback loading (`import` + `createRequire`)
- [x] Přidat srozumitelnou interní chybu/kód pro polyfill fail

### 2.3 API error ergonomie
- [x] V `src/app/api/ingest/route.ts` mapovat parser chyby na jasnou hlášku
- [x] Ve `src/components/ingest/FileUploader.tsx` zobrazit user-friendly message

### 2.4 Validace fáze
- [x] Upload PDF (reálný soubor) = PASS
- [x] Upload TXT (regrese) = PASS
- [x] Parser smoke: `parsePDF(test.pdf)` + `parseDocument(text/plain)` = PASS
- [x] Žádné `DOMMatrix is not defined` v odpovědi API

## Fáze 3: Lint a repo hygiene (P1)

### 3.1 Lint scope cleanup
- [x] Upravit `eslint.config.mjs` ignorovat build/minified/debug artefakty
- [x] Vyřadit `public/pdf.worker.min.mjs` z lintu
- [x] Vyřadit `*.backup.*` soubory z lint/TS scope

### 3.2 Struktura pomocných skriptů
- [x] Přesunout root debug/check/verify skripty do `scripts/`
- [x] Nastavit separátní pravidla (neblokovat produkční build)

### 3.3 Validace fáze
- [x] `npm run lint` = PASS (errors=0)
- [x] Warning count je evidovaný, zdůvodněný a má návrh oprav

## Fáze 4: Typová konsolidace (P1)

### 4.1 Odstranění `any`
- [x] `src/app/api/chat/route.ts` - odstranit `any` v mapování zpráv
- [x] `src/components/chat/ChatPanel.tsx` - nahradit `any` explicitními typy
- [x] `src/lib/db/schema.ts` - typovat `messages.sources` bez `any[]`

### 4.2 TS komentáře a dluh
- [x] Nahradit `@ts-ignore` za přesné typy nebo `@ts-expect-error` s důvodem
- [x] Odstranit nepoužívané importy/branches

### 4.3 Validace fáze
- [x] `npx tsc --noEmit --incremental false` = PASS
- [x] `npm run lint` = PASS

## Fáze 5: API kontrakty a auth hardening (P1)

### 5.1 Jednotný API kontrakt
- [x] Sjednotit odpovědi endpointů (`success`, `data`, `error`, `code`)
- [x] Dokumentovat kontrakty v README nebo `docs/api.md`

### 5.2 Auth bezpečnost
- [x] V produkci zakázat headerless fallback
- [x] Ověřit admin-only endpointy (`ingest`, `documents`, `debug`)

### 5.3 Validace fáze
- [x] Negativní auth testy = PASS
- [x] Endpoint smoke testy = PASS

## Fáze 6: Testy a CI (P1)

### 6.1 Rozšíření testů
- [x] Přidat testy pro ingest parser/polyfill fail path
- [x] Přidat testy pro pagination (`documents/history`)
- [x] Přidat auth testy (user vs admin)

### 6.2 CI pipeline
- [x] Pipeline: `lint -> tsc -> test -> build`
- [x] Nastavit fail-fast na `tsc` a `build`

### 6.3 Validace fáze
- [x] Všechny CI kroky zelené na čistém běhu

## Fáze 7: Produkční připravenost (P2)

### 7.1 Observability
- [x] Sjednotit strukturované logování a request ID napříč API
- [x] Omezit `console.log` v produkční cestě

### 7.2 Runtime a security
- [x] Prověřit migraci `middleware` -> `proxy` (Next 16 warning)
- [x] Ověřit CSP a rate-limit konfiguraci

### 7.3 Release checklist
- [x] `lint` PASS
- [x] `tsc` PASS
- [x] `test` PASS
- [x] `build` PASS
- [x] PDF/TXT upload PASS
- [x] Chat + citace + history PASS

## Log průchodu (průběžně doplňovat)

| Datum | Fáze | Krok | Stav | Poznámka |
|---|---|---|---|---|
| 2026-02-09 | Baseline | Audit snapshot | DONE | Build fail + DOMMatrix issue potvrzen |
| 2026-02-09 | Fáze 1 | P0 release blokery | DONE | `tsc` PASS + `build` PASS |
| 2026-02-09 | Fáze 2 | Polyfill + parser hardening | DONE | `tsc` PASS + `build` PASS + E2E `/api/ingest` PDF/TXT PASS |
| 2026-02-09 | Fáze 3 | Lint + repo hygiene | DONE | `npm run lint` PASS (0 errors, 62 warnings), `npm run lint:scripts` PASS (0 errors, 11 warnings), helper skripty přesunuty do `scripts/` |
| 2026-02-09 | Fáze 4 | Typová konsolidace (část) | DONE | `tsc` PASS, `lint` PASS, `any` odstraněno v `chat/ChatPanel/schema`, warningy sníženy `62 -> 26` |
| 2026-02-09 | Fáze 5 | API kontrakt + auth hardening | DONE | Kontrakt `success/data/error/code` sjednocen, admin-only endpointy zajištěny, headerless fallback vypnut v produkci, 5.3 validace PASS (negativní auth + endpoint smoke) |
| 2026-02-09 | Fáze 6 | Rozšíření testů (6.1) | DONE | Přidány testy pro parser polyfill fail path, pagination (`documents/history`), auth (`user` vs `admin`) + smoke (`health/ingest`), `npm run test:run` PASS (27/27), `npx tsc --noEmit --incremental false` PASS |
| 2026-02-09 | Fáze 6 | CI pipeline (6.2) | DONE | Přidán `.github/workflows/ci.yml` s pořadím `lint -> tsc -> test -> build` (krokový fail-fast), lokálně ověřeno: `lint` (0 errors), `tsc` PASS, `test` PASS, `build` PASS |
| 2026-02-09 | Fáze 6 | Validace fáze (6.3) | DONE | Čistý gate běh PASS: `npm run lint` (0 errors, 24 warnings), `npx tsc --noEmit --incremental false` PASS, `npm run test:run` PASS (8 files/27 tests), `npm run build` PASS |
| 2026-02-09 | Fáze 7 | Observability + runtime/security | DONE | API logování sjednoceno přes `logError/logWarn` + `requestId`, produkční `console.log` omezen přes `devLog`, migrace `src/middleware.ts` -> `src/proxy.ts`, build bez deprecation warningu pro middleware |
| 2026-02-09 | Fáze 7 | Release checklist (část) | DONE | `lint` PASS, `tsc` PASS, `test` PASS, `build` PASS, PDF/TXT upload PASS, `Chat + citace + history` PASS (API E2E: `postSources=1`, `hasCitationToken=true`, `chatInHistory=true`, `assistantSources=1`) |
| 2026-02-09 | Fáze 4 | 4.2 cleanup nepoužitých importů/branches | DONE | Odstraněny nepoužívané importy/proměnné v `ChatInput`, `ChatMessage`, `SettingsDialog`, `agents`; `npm run lint` = 0 errors, 12 warnings |
| 2026-02-09 | Fáze 7 | DoD finalizace | DONE | Odstraněn poslední kritický `any` (`ChatMessage` callback), dokumentace sjednocena s auth/model fallback chováním (`README`, `docs/api.md`) |
| 2026-02-09 | Fáze 7 | Lint warning cleanup (`scripts/**`) | DONE | Vyčištěno 11 warningů v helper skriptech (`@ts-ignore`, unused vars/imports); `npm run lint:scripts` PASS (0 warnings) |
| 2026-02-09 | Fáze 7 | Finální gate re-run | DONE | `npm run lint` PASS, `npm run lint:scripts` PASS, `npx tsc --noEmit --incremental false` PASS, `npm run test:run` PASS, `npm run build` PASS |

## Registr warningů (evidence + návrh řešení)

| Datum | Oblast/Soubor | Warning | Dopad | Návrh řešení | Stav |
|---|---|---|---|---|---|
| 2026-02-09 | Inicializace | Warning registry založen | Transparentní sledování | Každý warning zapsat s fix návrhem před uzavřením fáze | DONE |
| 2026-02-09 | `src/**` (lint phase gate) | 0 warnings (vyčištěno z 11) | Release quality gate čistý | Pravidla `react-hooks/*` a `react/no-unescaped-entities` respektována v kódu; `npm run lint` bez warningů | DONE |
| 2026-02-09 | `scripts/**` | 0 warnings (vyčištěno z 11) | Helper skripty už netvoří lint dluh | Nahrazeny `@ts-ignore` a odstraněny unused importy/proměnné; `npm run lint:scripts` bez warningů | DONE |

## Definice hotovo (DoD)

- [x] Žádný release blocker (build/type/runtime)
- [x] Upload dokumentů stabilní pro PDF i TXT
- [x] Kód má konzistentní typy bez kritických `any`
- [x] CI je predikovatelná a opakovatelná
- [x] Dokumentace odpovídá realitě implementace
