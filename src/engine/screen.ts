// screen.ts - tiny diffing ANSI renderer for terminal games (256 colors, no deps)
//
// Usage:
//   const screen = new Screen(process.stdout.columns, process.stdout.rows)
//   process.stdout.write(ENTER)                       // alt screen, hide cursor
//   screen.text(2, 1, 'SCORE 100', style(11, undefined, true))
//   screen.set(10, 5, '@', style(9))
//   process.stdout.write(screen.render())             // writes only what changed
//   process.stdout.on('resize', () => {
//     process.stdout.write(screen.resize(process.stdout.columns, process.stdout.rows))
//   })
//   process.on('exit', () => process.stdout.write(LEAVE))

export const ENTER = "\x1b[?1049h\x1b[?25l\x1b[2J";
export const LEAVE = "\x1b[0m\x1b[?25h\x1b[?1049l";

// Pack a style into one number. 0 = terminal defaults.
// bits 0-8: fg+1 (0 = default), bits 9-17: bg+1 (0 = default), bit 18: bold
export function style(fg?: number, bg?: number, bold = false): number {
  return (
    (fg === undefined ? 0 : fg + 1) | ((bg === undefined ? 0 : bg + 1) << 9) | (bold ? 1 << 18 : 0)
  );
}

const BOLD = 1 << 18;

// Emit only the attributes that differ between two styles.
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

const SPACE = 32;

export class Screen {
  w = 0;
  h = 0;
  private chars!: Uint32Array;
  private styles!: Uint32Array;
  private prevChars!: Uint32Array;
  private prevStyles!: Uint32Array;

  constructor(w: number, h: number) {
    this.alloc(w, h);
  }

  private alloc(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.chars = new Uint32Array(w * h).fill(SPACE);
    this.styles = new Uint32Array(w * h);
    // prev is filled with 0 so the first render sees every cell as changed
    this.prevChars = new Uint32Array(w * h);
    this.prevStyles = new Uint32Array(w * h);
  }

  /** Reallocate after a terminal resize. Returns a clear-screen sequence to write. */
  resize(w: number, h: number): string {
    this.alloc(w, h);
    return "\x1b[2J";
  }

  clear() {
    this.chars.fill(SPACE);
    this.styles.fill(0);
  }

  set(x: number, y: number, ch: string, st = 0) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.chars[i] = ch.codePointAt(0)!;
    this.styles[i] = st;
  }

  text(x: number, y: number, str: string, st = 0) {
    for (const ch of str) this.set(x++, y, ch, st);
  }

  /** Diff against the last rendered frame and return the minimal ANSI string. */
  render(): string {
    const { w, h, chars, styles, prevChars, prevStyles } = this;
    let out = "";
    let curX = -1;
    let curY = -1;
    let curStyle = 0; // assume terminal is in default style at start

    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        if (chars[i] === prevChars[i] && styles[i] === prevStyles[i]) continue;

        // cheapest way to get the cursor to (x, y)
        if (y === curY) {
          const gap = x - curX;
          if (gap > 0) {
            // tiny gap of unchanged cells in the active style: rewriting them beats a jump
            let bridge = gap <= 3;
            for (let j = curX; bridge && j < x; j++)
              if (styles[row + j] !== curStyle) bridge = false;
            if (bridge) for (let j = curX; j < x; j++) out += String.fromCodePoint(chars[row + j]);
            else out += gap === 1 ? "\x1b[C" : `\x1b[${gap}C`;
          }
        } else if (curY >= 0 && y === curY + 1 && x === 0) {
          out += "\r\n"; // start of next line; can't scroll because y <= h-1
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
    // synchronized output (supported by most modern terminals, ignored by the rest)
    return `\x1b[?2026h${out}\x1b[?2026l`;
  }
}
