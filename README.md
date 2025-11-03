# GS Benchmark

GS Benchmark provides a unified interface for inspecting multiple experiment outputs. It combines metric tables with side-by-side image comparisons so you can quickly understand how different training runs perform.

## Features

- **Directory-based ingestion** – add any number of local model output folders; the tool reads `results.json` and `test/ours_*/renders` assets automatically.
- **Metrics overview** – sortable table of iterations with customizable `exp_name` labels, selection checkboxes, and row re-order controls.
- **Image gallery** – horizontal comparison rows grouped by image name, including a synthetic `gt` reference where available.
- **GT handling** – first directory automatically contributes a ground-truth row for easy visual baselines.
- **Dark mode aware** – UI respects system color scheme for comfortable inspection in different lighting conditions.

## Prerequisites

Ensure the following are installed:

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/)

```bash
npm install -g pnpm
```

## Getting Started

Clone the repository and install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Usage Workflow

1. Open the home page and click **Go to Evaluation** (or visit `/eval` directly).
2. Use the **Model Paths Selector** to add one or more directories containing training outputs.
3. Inspect the **Metrics Overview** table:
   - Rename `exp_name` labels to friendly names.
   - Reorder rows with the ↑/↓ controls.
   - Select rows to compare.
4. Scroll to the **Image Comparisons** gallery to review aligned images across the selected experiments and iterations.

## Build & Deploy

Create a production build and serve it locally:

```bash
pnpm build
pnpm start
```

You can deploy the generated `.next` build output to any Node.js-capable hosting provider.

## Project Structure

```
app/
├── eval/            # Evaluation dashboard (directory selector, metrics, gallery)
├── api/             # Local API routes for reading results and images
├── layout.tsx       # Root layout metadata
└── page.tsx         # Landing page with navigation into /eval
components/
├── DirectorySelector.tsx  # Model path input & list management
├── MetricsOverview.tsx    # Metrics table with selection & reordering
├── ImageGallery.tsx       # Aggregated image comparisons
├── ImageCompare.tsx       # Single-row comparison component
└── ImageCard.tsx          # Image + metrics card display
```

## Key Scripts

- `pnpm lint` – run linting (if configured in package).
- `pnpm dev` – start the development server with hot reload.
- `pnpm build` – produce a production build.
- `pnpm start` – run the production server from the compiled build.

## Contributing

Issues and pull requests are welcome. Please ensure new features include appropriate documentation updates and maintain the existing coding style.
