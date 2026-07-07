# baoyu-skills

Article illustration skills for Claude Code.

## Skills

### baoyu-article-illustrator

Analyzes article structure, identifies positions requiring visual aids, generates illustrations with **Type × Style × Palette** three-dimension approach.

**Triggers**: "illustrate article", "add images", "generate images for article", "为文章配图"

## Configuration

### First-Time Setup

The first time you use `baoyu-article-illustrator`, it will prompt you to configure preferences. Alternatively, create an `EXTEND.md` file manually:

| Scope | Path |
|-------|------|
| Project | `.baoyu-skills/baoyu-article-illustrator/EXTEND.md` |
| User | `~/.baoyu-skills/baoyu-article-illustrator/EXTEND.md` |

### Quick Start

1. Copy the example config:
   ```bash
   cp plugins/baoyu-skills/baoyu-article-illustrator/EXTEND.md.example .baoyu-skills/baoyu-article-illustrator/EXTEND.md
   ```

2. Edit `EXTEND.md` to set your preferred style, watermark, and output directory.

3. Use the skill:
   ```
   /baoyu-article-illustrator
   ```

### Key Settings

| Field | Default | Description |
|-------|---------|-------------|
| `preferred_style.name` | `null` | Default style: `sketch-notes`, `notion`, `warm`, `minimal`, etc. |
| `watermark.enabled` | `false` | Enable watermark on generated images |
| `watermark.content` | `""` | Watermark text (e.g., `@username`) |
| `default_output_dir` | `imgs-subdir` | Where to save images: `imgs-subdir`, `same-dir`, `illustrations-subdir`, `independent` |
| `preferred_image_backend` | `auto` | Image backend: `auto`, `codex-imagegen`, `baoyu-image-gen`, `ask` |
| `generation_batch_size` | `4` | Batch size for parallel generation (1-8) |
| `language` | `null` | Output language: `zh`, `en`, `auto` |

## Styles

| Style | Description |
|-------|-------------|
| `sketch-notes` | Warm cream paper, black hand-drawn lines, soft pastel blocks |
| `notion` | Minimalist hand-drawn line art |
| `warm` | Friendly, approachable, personal |
| `minimal` | Clean, minimal, modern |
| `editorial` | Magazine-style, bold typography |
| `blueprint` | Technical blueprint, engineering feel |
| `watercolor` | Soft watercolor, artistic |
| `pixel-art` | Retro pixel art style |
| `vintage` | Retro vintage illustration |
| `flat` | Flat design, geometric |

## Palettes

| Palette | Description |
|---------|-------------|
| `macaron` | Soft pastel colors |
| `warm` | Warm earth tones |
| `neon` | Vibrant neon colors |
| `mono-ink` | Monochrome ink |

## Source

- GitHub: https://github.com/JimLiu/baoyu-skills
