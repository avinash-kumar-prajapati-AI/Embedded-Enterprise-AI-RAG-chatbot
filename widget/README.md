# widget

Embeddable chat widget (Phase 7) — a standalone bundle (Vite/esbuild) built
and deployed separately from the main Next.js app, injected via shadow DOM
into host pages with `<script src=".../widget.js" data-site-key="...">`.

Not part of the main Next.js build; has its own `package.json` when scaffolded.
