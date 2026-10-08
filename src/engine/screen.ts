/**
 * Escape sequence that switches to the alternate screen buffer, hides the
 * cursor and clears the screen.
 *
 * Write it to `process.stdout` before the first render and pair it with
 * {@link LEAVE} when the program exits.
 */
export const ENTER = "\x1b[?1049h\x1b[?25l\x1b[2J";

/**
 * Escape sequence that resets all text attributes, shows the cursor and
 * switches back to the normal screen buffer.
 *
 * Write it to `process.stdout` on every exit path (normal exit, errors and
 * Ctrl+C), otherwise the terminal is left in the alternate buffer with the
 * cursor hidden.
 */
export const LEAVE = "\x1b[0m\x1b[?25h\x1b[?1049l";

/**
 * Packs a foreground color, background color and bold flag into a single
 * integer style that {@link Screen.set} and {@link Screen.text} accept.
 *
 * The result is a plain integer, so styling cells stays allocation-free and
 * cheap enough to compute per cell per frame. A fresh {@link Screen} uses `0`,
 * which renders with the terminal defaults.
 *
 * @param fg - Foreground palette index in the range 0-255, or `undefined` for
 * the terminal default.
 * @param bg - Background palette index in the range 0-255, or `undefined` for
 * the terminal default.
 * @param bold - Render the text in bold when `true`.
 * @returns The packed style value.
 *
 * @example
 * ```ts
 * screen.text(2, 1, "SCORE 100", style(11, undefined, true));
 * screen.set(10, 5, "@", style(9));
 * ```
 */
export function style(fg?: number, bg?: number, bold = false): number {
  return (
    (fg === undefined ? 0 : fg + 1) | ((bg === undefined ? 0 : bg + 1) << 9) | (bold ? 1 << 18 : 0)
  );
}

/** Bit 18 of a packed style: the bold flag. Bits 0-8 store `fg + 1`, bits 9-17 store `bg + 1`. */
const BOLD = 1 << 18;

/**
 * Builds the shortest SGR (Select Graphic Rendition) escape sequence that turns
 * packed style `from` into packed style `to`.
 *
 * Only the attributes that differ are emitted; switching to the default style
 * collapses to a full reset instead. {@link Screen.render} uses this to avoid
 * re-sending unchanged colors for every cell.
 *
 * @param from - The packed style the terminal is currently in.
 * @param to - The packed style the next cell requires.
 * @returns An ANSI SGR sequence such as `"\x1b[1;38;5;9m"`.
 */
function sgrDelta(from: number, to: number): string {
  if (to === 0) return "\x1b[0m";
  let p = "";
  if ((from ^ to) & BOLD) p = to & BOLD ? "1" : "22";
  const fg = to & 0x1ff;
  if ((from & 0x1ff) !== fg) p += (p && ";") + (fg ? `38;5;${fg - 1}` : "39");
  const bg = (to >> 9) & 0x1ff;
  if (((from >> 9) & 0x1ff) !== bg) p += (p && ";") + (bg ? `48;5;${bg - 1}` : "49");
  return `\x1b[${p}m`;
}

/** Code point of the space character, used to initialize and clear cells. */
const SPACE = 32;

/**
 * A double-buffered grid of styled characters with ANSI output.
 *
 * Draw into the frame with {@link set}, {@link text} and {@link clear}, then
 * call {@link render} once per frame. Render compares the grid against the
 * previously rendered frame and returns an escape sequence that only touches
 * the cells that changed, which keeps output small even on large screens.
 *
 * Cells live in typed arrays (one code point and one packed style per cell), so
 * updates are allocation-free and fast enough for a 60 fps game loop.
 *
 * @example
 * ```ts
 * const screen = new Screen(process.stdout.columns, process.stdout.rows);
 * process.stdout.write(ENTER); // alternate buffer, hidden cursor
 *
 * function draw() {
 *   screen.clear();
 *   screen.text(2, 1, "SCORE 100", style(11, undefined, true));
 *   screen.set(10, 5, "@", style(9));
 *   process.stdout.write(screen.render()); // writes only the changed cells
 * }
 *
 * process.stdout.on("resize", () => {
 *   process.stdout.write(screen.resize(process.stdout.columns, process.stdout.rows));
 * });
 *
 * process.on("exit", () => process.stdout.write(LEAVE));
 * ```
 *
 * @remarks
 * - Cells map 1:1 to terminal columns. Full-width characters (CJK, most emoji)
 *   are stored as one cell but occupy two columns in the terminal, shifting
 *   everything drawn after them.
 * - {@link render} assumes the terminal is in the default style when it starts,
 *   and resets the style before returning if it changed it.
 */
export class Screen {
  /** Width in columns; kept in sync by the constructor and {@link resize}. */
  w = 0;

  /** Height in rows; kept in sync by the constructor and {@link resize}. */
  h = 0;

  /** Code point of every cell in the frame being built. */
  private chars!: Uint32Array;

  /** Packed style of every cell in the frame being built; see {@link style}. */
  private styles!: Uint32Array;

  /** Code points as of the last {@link render}; the diff baseline. */
  private prevChars!: Uint32Array;

  /** Styles as of the last {@link render}; the diff baseline. */
  private prevStyles!: Uint32Array;

  /** Flag for storing the screen activation */
  private active = false;

  /**
   * Creates a screen of `w * h` cells, all spaces in the default style.
   */
  constructor() {
    const { columns: width, rows: height } = process.stdout;

    this.alloc(width, height);
  }

  /**
   * (Re)allocates the cell buffers and resets the diff baseline.
   *
   * The previous-frame buffers are left zero-filled, which the first render
   * sees as "every cell changed", so the whole screen gets painted.
   *
   * @param w - New width in columns.
   * @param h - New height in rows.
   */
  private alloc(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.chars = new Uint32Array(w * h).fill(SPACE);
    this.styles = new Uint32Array(w * h);
    // prev stays zero-filled: the first render sees every cell as changed
    this.prevChars = new Uint32Array(w * h);
    this.prevStyles = new Uint32Array(w * h);
  }

  /**
   * Resizes the grid after a terminal resize.
   *
   * Allocates new buffers (the current frame is lost) and returns a
   * clear-screen sequence that the caller must write to `process.stdout`.
   *
   * @param w - New width in columns.
   * @param h - New height in rows.
   * @returns The ANSI clear-screen sequence `"\x1b[2J"`.
   */
  resize(w: number, h: number): string {
    this.alloc(w, h);
    return "\x1b[2J";
  }

  /**
   * Fills the frame being built with spaces in the default style.
   *
   * Only the in-memory grid is touched; nothing reaches the terminal until
   * {@link render}. Call it at the top of every frame, before drawing.
   */
  clear() {
    this.chars.fill(SPACE);
    this.styles.fill(0);
  }

  /**
   * Writes a single cell.
   *
   * Coordinates are zero-based and clipped: calls outside the grid are ignored,
   * so drawing code doesn't need bounds checks. Only the first code point of
   * `ch` is stored.
   *
   * @param x - Column, 0-based.
   * @param y - Row, 0-based.
   * @param ch - Character to draw, e.g. `"@"`.
   * @param st - Packed style from {@link style}; defaults to `0` (terminal default).
   */
  set(x: number, y: number, ch: string, st = 0) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.chars[i] = ch.codePointAt(0)!;
    this.styles[i] = st;
  }

  /**
   * Draws a string horizontally starting at `(x, y)`.
   *
   * The string is iterated by code point (so surrogate pairs such as emoji stay
   * intact) and each character goes through {@link set}, which clips anything
   * past the right edge. Text does not wrap to the next line.
   *
   * @param x - Starting column, 0-based.
   * @param y - Row, 0-based.
   * @param str - Text to draw.
   * @param st - Packed style from {@link style}; defaults to `0` (terminal default).
   */
  text(x: number, y: number, str: string, st = 0) {
    for (const ch of str) this.set(x++, y, ch, st);
  }

  /**
   * Diffs the current frame against the previous one and returns the minimal
   * ANSI sequence that updates the terminal.
   *
   * The sequence is wrapped in synchronized-output markers (`CSI ?2026h` ...
   * `CSI ?2026l`) so terminals that support them present the frame atomically;
   * other terminals ignore the markers and render as usual.
   *
   * The renderer keeps the output small by skipping unchanged cells, walking
   * the cursor horizontally instead of jumping to every cell, rewriting up to
   * three unchanged cells when that is cheaper than a cursor move, and emitting
   * only the style attributes that differ from the previous cell.
   *
   * The previous-frame baseline is updated in place, so the next call diffs
   * against this frame.
   *
   * @returns The ANSI sequence to write to `process.stdout`, or `""` when
   * nothing changed since the previous render.
   */
  render(): string {
    const { w, h, chars, styles, prevChars, prevStyles } = this;
    let out = "";
    let curX = -1;
    let curY = -1;
    let curStyle = 0; // the terminal starts each render in the default style

    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        if (chars[i] === prevChars[i] && styles[i] === prevStyles[i]) continue;

        // move the cursor to (x, y) as cheaply as possible
        if (y === curY) {
          const gap = x - curX;
          if (gap > 0) {
            // a gap of a few unchanged cells in the current style: rewriting them beats a jump
            let bridge = gap <= 3;
            for (let j = curX; bridge && j < x; j++)
              if (styles[row + j] !== curStyle) bridge = false;
            if (bridge) for (let j = curX; j < x; j++) out += String.fromCodePoint(chars[row + j]);
            else out += gap === 1 ? "\x1b[C" : `\x1b[${gap}C`;
          }
        } else if (curY >= 0 && y === curY + 1 && x === 0) {
          out += "\r\n"; // next row from its first column; y <= h - 1 so this cannot scroll
        } else {
          out += `\x1b[${y + 1};${x + 1}H`;
        }

        if (styles[i] !== curStyle) {
          out += sgrDelta(curStyle, styles[i]);
          curStyle = styles[i];
        }
        out += String.fromCodePoint(chars[i]);
        curX = x + 1;
        curY = y;

        prevChars[i] = chars[i];
        prevStyles[i] = styles[i];
      }
    }

    if (!out) return "";
    if (curStyle !== 0) out += "\x1b[0m";
    // synchronized output: most modern terminals present the frame atomically, others ignore it
    return `\x1b[?2026h${out}\x1b[?2026l`;
  }

  /**
   * Take over the terminal: alternate screen, hidden cursor, blank. The next
   * render() redraws everything.
   */
  enter() {
    if (this.active) return;
    this.active = true;
    this.prevChars.fill(0);
    this.prevStyles.fill(0);
    process.stdout.write(ENTER);
  }

  /**
   * Give the terminal back as it was: reset style, show cursor, leave the
   * alternate screen.
   */
  leave() {
    if (!this.active) return;
    this.active = false;
    process.stdout.write(LEAVE);
  }
}
