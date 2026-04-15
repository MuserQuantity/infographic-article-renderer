# Frontend Development & Testing

## Running the Frontend Dev Server

```bash
cd frontend
# To use production API data for testing:
VITE_API_BASE_URL=https://infographic.muserquantity.cn npx vite --port 3000 --host 0.0.0.0
```

Test a specific article by navigating to `http://localhost:3000/?id=<article_id>`.

## Key Component Architecture

- `frontend/components/ArticleRenderer.tsx` — Main file containing all block renderers
- Block types: `StatsBlock`, `LegacyStatsBlock`, `TimelineBlock`, `ComparisonBlock`, `GridBlock`, `DefinitionBlock`, etc.
- `LegacyStatsBlock` is the CSS/Tailwind fallback renderer for stat blocks
- `StatsBlock` uses `@antv/infographic` for visualization (preferred when available)
- The renderer picks legacy vs modern path based on component availability

## Testing Visual Changes

1. Start dev server with production API proxy (see above)
2. Navigate to an article with the relevant block type
3. Compare production (`https://infographic.muserquantity.cn/?id=<id>`) vs local side-by-side
4. Check responsive behavior — Tailwind breakpoints: `sm:` (640px), `md:` (768px)

## Build

```bash
cd frontend && npm run build
```

No lint or test scripts are configured yet.
