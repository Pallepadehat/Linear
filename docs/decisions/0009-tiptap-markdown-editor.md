# 0009 — Tiptap for markdown issue descriptions

- **Status:** Accepted
- **Date:** 2026-10-30

## Context

Issue descriptions (and later comments) need a Linear-like editor: markdown shortcuts as you type, a `/` block menu, a formatting toolbar on selection and task lists, while storing plain markdown so the API, GitHub links and search stay text-based.

## Decision

Use Tiptap 3 (`@tiptap/vue-3`, `starter-kit`, `extension-list` for task lists, `extensions` for the placeholder, `suggestion` for the `/` menu, the bubble menu) with the official `@tiptap/markdown` extension. The editor loads and emits markdown (`contentType: 'markdown'`, `getMarkdown()`); the database stores that string. It lives in `apps/app/src/components/common/editor` so the issue detail page and comments reuse it. Versions are pinned exactly because Tiptap packages must move in lockstep.

## Consequences

- Descriptions stay portable markdown; no HTML is stored or rendered from user input without going through the editor schema.
- The create dialog loads the editor lazily with the dialog chunk, so the issue list doesn't pay for it.
- Tiptap upgrades must bump every `@tiptap/*` package together.

## Alternatives considered

- **Plain textarea + markdown preview** — no inline formatting or `/` menu; far from Linear.
- **Milkdown** — markdown-first, but a smaller Vue ecosystem and heavier theming.
- **Lexical / ProseMirror directly** — no first-class Vue bindings, or a lot of plumbing Tiptap already provides.
