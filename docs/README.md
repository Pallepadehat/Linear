# Docs

Start here. Every agent session should know where the truth lives.

| Doc                            | What it answers                                                                   | Update when…                           |
| ------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------- |
| [`../AGENTS.md`](../AGENTS.md) | How to work in this repo: commands, layout, hard rules                            | Conventions or commands change         |
| [`prd.md`](prd.md)             | What we build, scope (P0/P1/P2), acceptance tests, tech                           | Scope or requirements change           |
| [`design.md`](design.md)       | Visual system: tokens, themes, components                                         | A token or component spec changes      |
| [`domain.md`](domain.md)       | Glossary and exact business rules (identifiers, statuses, PR linking, automation) | A rule is clarified or changed         |
| [`roadmap.md`](roadmap.md)     | Task list per milestone, what's next, what's done                                 | A task starts or finishes              |
| [`workflow.md`](workflow.md)   | How a task goes from idea to merged (plan, branch, verify, PR)                    | The process changes                    |
| [`testing.md`](testing.md)     | Test strategy, where tests live, how to run them                                  | Test setup changes                     |
| [`decisions/`](decisions/)     | Architecture Decision Records (why we chose X)                                    | A significant technical choice is made |

## Source-of-truth order

When documents disagree: `domain.md` (business rules) → `prd.md` (scope, requirements) → `decisions/` (technical choices) → `AGENTS.md` (conventions) → code. Fix the doc that is wrong in the same change — never leave them inconsistent.
