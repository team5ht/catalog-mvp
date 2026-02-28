# Documentation Index

Этот файл задает карту документации и порядок чтения.

## Read Order (default)

1. `README.md` - продуктовый и runtime-контракт.
2. `docs/INDEX.md` - карта документации.
3. `docs/live/*` - актуальные операционные и технические документы.
4. `docs/adr/*` - архитектурные решения и их история.
5. `docs/archive/*` - только при расследовании регрессий/истории.

## Folders and Purpose

- `docs/live/`
  - Живые документы, которые должны отражать текущее поведение системы.
  - Пример: `docs/live/IMAGE-WORKFLOW-CHEATSHEET.md`.
- `docs/adr/`
  - ADR и эволюция архитектурных решений.
  - Исторический источник решений, не оперативная инструкция.
- `docs/archive/`
  - Исторические аудиты, snapshots, отчеты фиксированных дат.
  - Примеры:
    - `docs/archive/auth-flow-audit-2026-02-20.md`
    - `docs/archive/codebase-state-2026-02-26.md`
    - `docs/archive/navigation-lifecycle-audit-2026-02-18.md`

## Source of Truth Rules

- Runtime/API/UI-контракты: `README.md` + релевантные документы в `docs/live/`.
- Architectural decision rationale: `docs/adr/`.
- Historical evidence and previous states: `docs/archive/`.

## Contribution Rules

- Перед созданием нового документа проверить, нет ли уже живого канонического файла на тему.
- Если документ устарел, не удалять: перенести в `docs/archive/` и обновить ссылки.
- Для новых правил ведения документации использовать `docs/DOCS-GOVERNANCE.md`.
