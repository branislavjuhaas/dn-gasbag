import type { Screen } from "./screen";

export interface Key {
  name: string;
  text?: string; // the typed character, for text input
}

type KeyEvent = "press" | "repeat" | "release" | "tap"; // 'tap' = legacy byte, no press/release info

const CSI_FINAL: Record<string, string> = {
  A: "up",
  B: "down",
  C: "right",
  D: "left",
  H: "home",
  F: "end",
};
const CSI_TILDE: Record<string, string> = {
  "1": "home",
  "3": "delete",
  "4": "end",
  "5": "pageup",
  "6": "pagedown",
  "7": "home",
  "8": "end",
};
const KITTY_NAMED: Record<number, string> = {
  27: "escape",
  13: "enter",
  9: "tab",
  127: "backspace",
  32: "space",
};

const SHIFT = 1;
const ALT = 2;
const CTRL = 4;
const SUPER = 8;

// Kitty progressive-enhancement flags: 1 disambiguate, 2 event types (press/repeat/release),
// 8 report all keys as escape codes, 16 report associated text.
const KITTY_FLAGS = 1 | 2 | 8 | 16;

export class Input {
  /** Legacy mode only: how long a key counts as "down" after its last event. */
  holdMs = 150;
  /** True after start() if the Kitty keyboard protocol is active. */
  kitty = false;
  /** Called on Ctrl+C (raw mode disables the normal SIGINT). Triggers your 'exit' handlers. */
  onExit: () => void = () => process.exit(130);

  private lastSeen = new Map<string, number>(); // legacy: last event time per key
  private held = new Set<string>(); // kitty: keys currently down
  private pressedNow = new Set<string>();
  private handler: ((key: Key) => void) | null = null;
  private detectDone: ((supported: boolean) => void) | null = null;
  private started = false;

  /** Enter raw mode and (optionally) detect + enable the Kitty protocol. Resolves to input.kitty. */
  async start(useKitty = true): Promise<boolean> {
    if (this.started) return this.kitty;
    if (!process.stdin.isTTY) throw new Error("stdin is not a TTY");
    this.started = true;
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.on("data", this.onData);

    if (useKitty && process.stdout.isTTY && (await this.detect(400))) {
      this.kitty = true;
      // push flags, and turn on focus reporting so we can drop held keys when focus is lost
      process.stdout.write(`\x1b[>${KITTY_FLAGS}u\x1b[?1004h`);
    }
    return this.kitty;
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    if (this.kitty) {
      this.kitty = false;
      process.stdout.write("\x1b[?1004l\x1b[<u"); // focus reporting off, pop our keyboard flags
    }
    process.stdin.off("data", this.onData);
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }

  /** True while the key is held. Exact with Kitty, emulated (seen within holdMs) otherwise. */
  isDown(name: string): boolean {
    if (this.kitty) return this.held.has(name);
    const t = this.lastSeen.get(name);
    return t !== undefined && performance.now() - t < this.holdMs;
  }

  /**
   * True if the key was pressed since the last endFrame().
   * Kitty: real presses only. Legacy: also includes OS auto-repeat events.
   */
  wasPressed(name: string): boolean {
    return this.pressedNow.has(name);
  }

  endFrame() {
    this.pressedNow.clear();
  }

  /** Route all keys to `handler` (e.g. a text box) instead of the game state. */
  capture(handler: (key: Key) => void) {
    this.handler = handler;
    this.lastSeen.clear();
    this.pressedNow.clear();
  }

  release() {
    this.handler = null;
  }

  // Ask for the current Kitty flags, then ask for primary device attributes. Every terminal
  // answers the second query, so if its answer arrives without a Kitty reply before it, the
  // protocol is unsupported. The timeout covers terminals that answer neither.
  private detect(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const finish = (supported: boolean) => {
        clearTimeout(timer);
        this.detectDone = null;
        resolve(supported);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      this.detectDone = finish;
      process.stdout.write("\x1b[?u\x1b[c");
    });
  }

  private onData = (chunk: string | Buffer) => {
    this.parse(String(chunk));
  };

  private dispatch(key: Key, ev: KeyEvent = "tap") {
    if (ev === "release") {
      this.held.delete(key.name); // always track releases, even while a text box has focus
      return;
    }
    if (key.name === "ctrl+c") {
      this.stop();
      this.onExit();
      return;
    }
    if (this.handler) {
      this.handler(key);
      return;
    }
    if (ev === "tap") {
      this.lastSeen.set(key.name, performance.now());
      this.pressedNow.add(key.name);
    } else {
      this.held.add(key.name); // press or repeat
      if (ev === "press") this.pressedNow.add(key.name);
    }
  }

  // One chunk can hold several keys (fast typing, paste, terminal replies), so parse in a loop.
  private parse(s: string) {
    let i = 0;
    while (i < s.length) {
      const c = s.charAt(i);

      if (c === "\x1b") {
        const next = s.charAt(i + 1);
        if (next === "[" || next === "O") {
          let j = i + 2;
          while (j < s.length && s.charCodeAt(j) >= 0x20 && s.charCodeAt(j) <= 0x3f) j++;
          const final = s.charAt(j);
          if (final !== "") {
            this.csi(next === "[", s.slice(i + 2, j), final);
            i = j + 1;
            continue;
          }
        }
        this.dispatch({ name: "escape" });
        i++;
        continue;
      }

      if (c === "\r" || c === "\n") {
        this.dispatch({ name: "enter" });
        i++;
        continue;
      }
      if (c === "\x7f" || c === "\b") {
        this.dispatch({ name: "backspace" });
        i++;
        continue;
      }
      if (c === "\t") {
        this.dispatch({ name: "tab" });
        i++;
        continue;
      }
      if (c === " ") {
        this.dispatch({ name: "space", text: " " });
        i++;
        continue;
      }

      const code = c.charCodeAt(0);
      if (code < 0x20) {
        this.dispatch({ name: `ctrl+${String.fromCharCode(code + 96)}` });
        i++;
        continue;
      }

      // plain printable text (typing, or a paste in Kitty mode) - no key-up will follow
      const ch = String.fromCodePoint(s.codePointAt(i)!);
      this.dispatch({ name: ch.toLowerCase(), text: ch });
      i += ch.length;
    }
  }

  // Handle one CSI (ESC [) or SS3 (ESC O) sequence.
  private csi(isCsi: boolean, params: string, final: string) {
    const lead = params.charAt(0);
    if (lead === "?") {
      // replies to our startup queries
      if (final === "u")
        this.detectDone?.(true); // Kitty flags reply
      else if (final === "c") this.detectDone?.(false); // device attributes reply, no Kitty before it
      return;
    }
    if (lead === "<" || lead === "=" || lead === ">") return;

    if (isCsi && params === "" && (final === "O" || final === "I")) {
      // focus out / in
      if (final === "O") {
        this.held.clear(); // a key-up may have been missed while unfocused
        this.lastSeen.clear();
      }
      return;
    }

    // params look like "code[:alts] ; mods[:event] ; text"
    const [p0 = "", p1 = "", p2 = ""] = params.split(";");
    const code = parseInt(p0, 10); // stops at ':' so "97:65" gives 97
    const [modStr = "", evStr = ""] = p1.split(":");
    const mods = modStr ? parseInt(modStr, 10) - 1 : 0;
    const ev: KeyEvent =
      evStr === "3" ? "release" : evStr === "2" ? "repeat" : this.kitty ? "press" : "tap";

    let key: Key | null = null;
    if (final === "u") {
      key = this.kittyKey(code, mods, p2);
    } else {
      const name = final === "~" ? CSI_TILDE[String(code)] : CSI_FINAL[final];
      if (name) key = { name };
    }
    if (key) this.dispatch(key, ev);
  }

  private kittyKey(code: number, mods: number, textParam: string): Key | null {
    if (!(code > 0)) return null;
    if (code >= 57344 && code <= 63743) return null; // modifier, media and keypad keys: ignored

    const named = KITTY_NAMED[code];
    const ch = String.fromCodePoint(code);
    const name = named ?? ch.toLowerCase();

    if (mods & CTRL && named === undefined) return { name: `ctrl+${name}` };

    const printable = named === undefined || code === 32;
    if (!printable) return { name };

    let text: string | undefined;
    if (textParam) {
      text = textParam
        .split(":")
        .map((cp) => String.fromCodePoint(parseInt(cp, 10)))
        .join("");
    } else if (!(mods & (ALT | SUPER))) {
      text = mods & SHIFT ? ch.toUpperCase() : ch;
    }
    return text === undefined ? { name } : { name, text };
  }
}

/** Minimal single-line text box. Feed it keys, draw it each frame. */
export class TextInput {
  value = "";
  cursor = 0;

  constructor(
    public maxLength = 16,
    public accept: (ch: string) => boolean = () => true,
  ) {}

  /** Returns 'submit' on Enter, 'cancel' on Escape, otherwise null. */
  handle(key: Key): "submit" | "cancel" | null {
    switch (key.name) {
      case "enter":
        return "submit";
      case "escape":
        return "cancel";
      case "backspace":
        if (this.cursor > 0) {
          this.value = this.value.slice(0, this.cursor - 1) + this.value.slice(this.cursor);
          this.cursor--;
        }
        break;
      case "delete":
        this.value = this.value.slice(0, this.cursor) + this.value.slice(this.cursor + 1);
        break;
      case "left":
        this.cursor = Math.max(0, this.cursor - 1);
        break;
      case "right":
        this.cursor = Math.min(this.value.length, this.cursor + 1);
        break;
      case "home":
        this.cursor = 0;
        break;
      case "end":
        this.cursor = this.value.length;
        break;
      default:
        if (key.text !== undefined && this.value.length < this.maxLength && this.accept(key.text)) {
          this.value = this.value.slice(0, this.cursor) + key.text + this.value.slice(this.cursor);
          this.cursor += key.text.length;
        }
    }
    return null;
  }

  draw(
    screen: Pick<Screen, "set" | "text">,
    x: number,
    y: number,
    textStyle: number,
    cursorStyle: number,
  ) {
    // padEnd gives the field a fixed width, so deleted characters get overwritten
    screen.text(x, y, this.value.padEnd(this.maxLength + 1), textStyle);
    screen.set(x + this.cursor, y, this.value.charAt(this.cursor) || " ", cursorStyle);
  }
}
