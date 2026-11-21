# Adding pages

Start from a template in `templates/`. Templates are outside `src/pages/`, so they are never built.
Pick a slug: lowercase, words joined by `-`, not starting with `_` (Astro skips those). It becomes the URL, `/<slug>/`.

## Templates

### Article

Prose page with a contents rail, diagrams, callouts and headline numbers.

```bash
cp -r templates/article src/pages/my-slug
```

- Edit the frontmatter in `index.mdx`: `title`, `description`, `updated` (`YYYY-MM-DD`), optional `eyebrow` and `links`.
- Replace the body. Edit or delete `_flow.diagram.ts`.
- Listed on the home page and in search automatically, from the frontmatter. The build fails if `title`, `description` or `updated` is missing.

### Diagram page

Article built around diagrams: a stepped graph and a sequence.

```bash
cp -r templates/diagram-page src/pages/my-slug
```

- Same frontmatter as an article. Edit `_pipeline.diagram.ts` (graph) and `_handshake.diagram.ts` (sequence).
- Each `<Step>` focuses ids (`a`, `a -> b`) or plays a `path`. Unknown ids fail the build.
- Diagram lint rules: `README.md`, section "Diagrams". Layout advice: `src/diagrams/GUIDELINES.md`. Fix the spec; do not add `allow*` bypasses to get a green build.
- Listed like an article.

### Standalone app

Self-contained static page with its own markup, styles and script. No backend: everything runs in the browser.

```bash
cp -r templates/standalone-app src/pages/my-app
```

- Edit the title, the markup, the `<style>` and the `<script>` in `index.astro`.
- Keep `BaseLayout`, so the header, footer and theme still apply.
- Write untrusted text with `textContent`, never `innerHTML`.
- Not listed on the home page or in search. Link to it from another page.

### Simple page

Plain Markdown page, one column.

```bash
cp -r templates/simple src/pages/my-page
```

- Edit `title`, `description` and the body in `index.md`.
- Not listed on the home page or in search (both read `index.mdx` only). Link to it from another page.

### Learn topic

Topic page joined into the learn graph by frontmatter.

```bash
cp -r templates/learn src/pages/learn/my-topic
```

- Required frontmatter: `title`, `short` (max 32 characters), `description`, `updated`, `track` (an `id` from `TRACKS` in `src/config/learn.ts`), `requires` (slugs of learn pages it builds on; `[]` for none), `hub` (`true` for an overview page that ties its `requires` together), `order` (position in its track).
- Listed on `/learn/` and in search automatically. The build fails on an unknown track, an unknown slug in `requires`, or a cycle.

## Files next to a page

Name helper files with a leading `_` (`_flow.diagram.ts`, `_Widget.astro`). Without it, Astro treats a `.ts` file in `src/pages/` as a route.

## Preview

```bash
bun install --frozen-lockfile
bun run dev        # http://localhost:4321
bun run build      # full build with all lint checks
```

## Publish

Commit and push to `main`. GitHub Actions builds the site and deploys it to GitHub Pages.
