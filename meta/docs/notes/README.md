# Notes index

- [gitignore negation must match at file level not directory level](gitignore-negation-must-match-at-file-level-not-directory-le.md) — To ignore secret.yml everywhere but allow it inside example-secrets/, the negation must be file-level: '**/se… `git,gitignore,patterns,gotcha`
- [Go: duplicate package declaration from editor formatter breaks build](go-duplicate-package-declaration-from-editor-formatter-break.md) — When creating a new .go file, some editors/formatters silently insert a duplicate package declaration (two co… `go,gotcha,ci,formatter`
- [Go TUI CLI: Bubble Tea stack and ldflags versioning](go-tui-cli-bubble-tea-stack-and-ldflags-versioning.md) — Standard stack: github.com/charmbracelet/bubbletea + bubbles/textinput + lipgloss. `go,tui,bubbletea,cli,github-actions`
- [SQLAlchemy text() IN clause with tuple fails on PostgreSQL — use expanding bindparam](sqlalchemy-text-in-clause-with-tuple-fails-on-postgresql-use.md) — When using sqlalchemy.text() with an IN clause, passing a Python tuple as a bound param does NOT expand to IN… `sqlalchemy,postgresql,psycopg2,gotcha`
- [uszipcode 1.x breaks SearchEngine — pin to <1.0](uszipcode-1-x-breaks-searchengine-pin-to-1-0.md) — uszipcode 1.0+ depends on sqlalchemy_mate 2.0.0.3, which dropped ExtendedBase, causing AttributeError on impo… `uszipcode,python,gotcha,dependency`
