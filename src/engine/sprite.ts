import type { Screen } from "./screen";

/**
 * A rectangular block of styled characters, stored as two flat arrays in the
 * same format the {@link Screen} uses, so drawing one is a straight copy.
 *
 * A character code of `0` means *transparent*: that cell is skipped when the
 * sprite is drawn, so the screen underneath shows through.
 *
 * @example
 * ```ts
 * const ship = spriteFromText(
 *   String.raw`
 *   /\
 *  /==\
 * /_||_\
 * `,
 *   { style: style(14) },
 * );
 *
 * drawSprite(screen, ship, player.x, player.y);
 * ```
 *
 * @remarks
 * Every cell is one terminal column wide. Wide characters (CJK, many emoji)
 * occupy two columns on screen and are not supported.
 */
export interface Sprite {
  /** Width in cells. */
  readonly w: number;
  /** Height in cells. */
  readonly h: number;
  /** Code points, row by row (`y * w + x`). `0` marks a transparent cell. */
  readonly chars: Uint32Array;
  /** Packed styles in the format produced by `style()`, same layout as {@link chars}. */
  readonly styles: Uint32Array;
}

/** Options for {@link spriteFromText}. */
export interface SpriteTextOptions {
  /** Style applied to every visible cell that has no entry in {@link colors}. Defaults to `0` (terminal default). */
  style?: number;
  /**
   * A second piece of art with the same shape as the first. Each character is a
   * key into {@link palette} and gives the style of the cell at the same position.
   * Spaces and unknown keys fall back to {@link style}.
   */
  colors?: string | string[];
  /** Maps the characters used in {@link colors} to packed styles. */
  palette?: Record<string, number>;
  /**
   * The character treated as transparent. Defaults to `" "`, so spaces in the
   * art let the background show through. Pass another character to make spaces
   * opaque, or `""` to make every character opaque.
   */
  transparent?: string;
}

/**
 * Creates an empty sprite: every cell is transparent with the default style.
 *
 * @param w - Width in cells.
 * @param h - Height in cells.
 */
export function createSprite(w: number, h: number): Sprite {
  return { w, h, chars: new Uint32Array(w * h), styles: new Uint32Array(w * h) };
}

/**
 * Splits art into lines. Strings may start right after the opening backtick (one
 * leading newline is dropped) and end with the closing backtick on its own line
 * (a trailing whitespace-only line is dropped).
 */
function toLines(art: string | string[]): string[] {
  if (Array.isArray(art)) return art;
  const lines = art.split(/\r?\n/);
  if (lines[0] === "") lines.shift();
  if (lines.at(-1)?.trim() === "") lines.pop();
  return lines;
}

/**
 * Builds a sprite from ASCII art.
 *
 * Lines can have different lengths; the sprite is as wide as the longest one and
 * shorter lines are padded with transparent cells. Use `String.raw` for art that
 * contains backslashes.
 *
 * @param art - The art, as a multi-line string or an array of lines.
 * @param opts - Styling and transparency options, see {@link SpriteTextOptions}.
 * @returns A new sprite.
 *
 * @example
 * ```ts
 * const enemy = spriteFromText(
 *   String.raw`
 *  \_/
 *  (o)
 * `,
 *   {
 *     colors: `
 *  ggg
 *  rrr
 * `,
 *     palette: { g: style(10), r: style(9) },
 *   },
 * );
 * ```
 */
export function spriteFromText(art: string | string[], opts: SpriteTextOptions = {}): Sprite {
  const { style = 0, palette = {}, transparent = " " } = opts;
  const rows = toLines(art).map((line) => [...line]);
  const colorRows = opts.colors ? toLines(opts.colors).map((line) => [...line]) : [];

  const h = rows.length;
  const w = Math.max(0, ...rows.map((row) => row.length));
  const sprite = createSprite(w, h);

  for (let y = 0; y < h; y++) {
    const row = rows[y] ?? [];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] ?? "";
      if (ch === "" || ch === transparent) continue;
      const i = y * w + x;
      const key = colorRows[y]?.[x];
      sprite.chars[i] = ch.codePointAt(0) ?? 0;
      sprite.styles[i] = (key !== undefined ? palette[key] : undefined) ?? style;
    }
  }
  return sprite;
}
