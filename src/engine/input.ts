import type { Screen } from "./screen";

/**
 * A single key event.
 *
 * `name` is the canonical, layout-independent key name, and `text` carries the
 * printable character when the event produced one.
 *
 * @example
 * ```ts
 * if (key.name === "enter") submit();
 * else if (key.text !== undefined) type(key.text);
 * ```
 */
export interface Key {
  /**
   * Canonical key name.
   *
   * - Regular keys are lowercase: `"a"`, `"1"`, `"space"`.
   * - Special keys use fixed names: `"up"`, `"down"`, `"left"`, `"right"`,
   *   `"home"`, `"end"`, `"pageup"`, `"pagedown"`, `"delete"`, `"backspace"`,
   *   `"enter"`, `"escape"`, `"tab"`.
   * - Ctrl combinations are `"ctrl+" + letter`: `"ctrl+a"`, `"ctrl+c"`.
   */
  name: string;

  /**
   * The printable character the key produced, for text input.
   *
   * Present for letters, digits, punctuation, space and pasted text. Absent for
   * non-printable keys and for Alt/Super combinations in Kitty mode, whose text
   * is suppressed instead of guessed. Shift is reflected here (`"a"` vs `"A"`),
   * not in {@link Key.name}.
   */
  text?: string;
}

/**
 * Event phase reported by the terminal.
 *
 * - `"press"` - the key went down (Kitty mode only).
 * - `"repeat"` - the OS auto-repeat while the key is held (Kitty reports it;
 *   legacy mode cannot distinguish it from a press).
 * - `"release"` - the key went up (Kitty mode only).
 * - `"tap"` - a legacy byte with no press/release information.
 */
type KeyEvent = "press" | "repeat" | "release" | "tap";

/** Maps the final byte of a non-tilde CSI/SS3 sequence to a key name. */
const CSI_FINAL: Record<string, string> = {
  A: "up",
  B: "down",
  C: "right",
  D: "left",
  H: "home",
  F: "end",
};

/** Maps the numeric parameter of a `CSI <n> ~` sequence to a key name. */
const CSI_TILDE: Record<string, string> = {
  "1": "home",
  "3": "delete",
  "4": "end",
  "5": "pageup",
  "6": "pagedown",
  "7": "home",
  "8": "end",
};

/** Kitty codepoints for named keys that have no usable character of their own. */
const KITTY_NAMED: Record<number, string> = {
  27: "escape",
  13: "enter",
  9: "tab",
  127: "backspace",
  32: "space",
};

/** Kitty modifier bit for Shift. */
const SHIFT = 1;
/** Kitty modifier bit for Alt/Option. */
const ALT = 2;
/** Kitty modifier bit for Control. */
const CTRL = 4;
/** Kitty modifier bit for Super/Cmd/Windows. */
const SUPER = 8;

/**
 * Kitty progressive-enhancement flags pushed by {@link Input.start}:
 * `1` disambiguate escape codes, `2` report event types (press/repeat/release),
 * `8` report all keys as escape codes, `16` report associated text.
 */
const KITTY_FLAGS = 1 | 2 | 8 | 16;

/**
 * Terminal keyboard input with two operating modes.
 *
 * - **Kitty mode** (preferred): if the terminal supports the Kitty keyboard
 *   protocol, {@link start} enables it and input becomes exact - presses,
 *   repeats and releases arrive separately, so {@link isDown} mirrors the
 *   physical keyboard.
 * - **Legacy mode** (fallback): raw bytes only. There is no key-up information,
 *   so {@link isDown} treats a key as held for {@link holdMs} milliseconds after
 *   its last event, and OS auto-repeat is indistinguishable from a press.
 *
 * Keys are read once per frame; call {@link endFrame} at the end of each frame
 * to clear the per-frame press state. To take the keyboard over (for example
 * with {@link TextInput}), route events to a handler with {@link capture}.
 *
 * @example
 * ```ts
 * const input = new Input();
 * await input.start(); // raw mode + Kitty detection
 *
 * const stop = startLoop((dt) => {
 *   if (input.wasPressed("q")) stop();
 *   if (input.isDown("right")) player.x += speed * dt;
 *   input.endFrame(); // always the last input call of the frame
 * });
 *
 * stop();
 * input.stop();
 * ```
 *
 * @remarks
 * Raw mode disables the terminal's SIGINT handling, so Ctrl+C arrives as a key
 * instead. {@link Input} handles it specially: it restores the terminal via
 * {@link stop} and calls {@link onExit}, which exits the process with code 130
 * by default.
 */
export class Input {
  /**
   * Legacy mode only: how long (in milliseconds) a key still counts as held
   * after its last event. Ignored in Kitty mode. Defaults to `150`.
   */
  holdMs = 150;

  /** `true` once {@link start} has detected and enabled the Kitty keyboard protocol. */
  kitty = false;

  /**
   * Called on Ctrl+C instead of the SIGINT that raw mode suppresses.
   *
   * The default exits the process with code 130 after {@link stop} has restored
   * the terminal. Override it to run cleanup first, then call `process.exit`
   * yourself.
   */
  onExit: () => void = () => process.exit(130);

  /** Legacy mode: timestamp of the most recent event, per key name. */
  private lastSeen = new Map<string, number>();

  /** Kitty mode: key names that are currently physically held. */
  private held = new Set<string>();

  /** Key names pressed since the last {@link endFrame}. */
  private pressedNow = new Set<string>();

  /** Handler keys are routed to while capturing, if any. */
  private handler: ((key: Key) => void) | null = null;

  /** Resolver of the in-flight Kitty detection, if any. */
  private detectDone: ((supported: boolean) => void) | null = null;

  /** `true` while stdin is in raw mode with the data listener attached. */
  private started = false;

  /**
   * Puts stdin into raw mode and, unless disabled, negotiates the Kitty
   * keyboard protocol.
   *
   * Detection queries the terminal's Kitty flags and then its primary device
   * attributes; every terminal answers the second query, so a device-attributes
   * reply that arrives without a Kitty reply before it means the protocol is
   * unsupported. The exchange times out after 400 ms, leaving terminals that
   * answer neither in legacy mode instead of hanging the game.
   *
   * Calling `start` on an already-started instance is a no-op that returns the
   * current {@link kitty} state.
   *
   * @param useKitty - `false` to skip detection and always use legacy mode.
   * @returns `true` if Kitty mode is active, otherwise `false` (legacy mode).
   * @throws If `process.stdin` is not a TTY.
   */
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
      // push our flags, and enable focus reporting so held keys can be dropped when focus is lost
      process.stdout.write(`\x1b[>${KITTY_FLAGS}u\x1b[?1004h`);
    }
    return this.kitty;
  }

  /**
   * Restores the terminal: disables focus reporting, pops the Kitty flags,
   * detaches the stdin listener, leaves raw mode and pauses stdin.
   *
   * Safe to call when not started, and safe to call more than once. Always call
   * it before the process exits.
   */
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

  /**
   * Whether the key is held down.
   *
   * Exact in Kitty mode (based on press/release events). Approximate in legacy
   * mode: the key counts as held for {@link holdMs} milliseconds after its last
   * press or repeat event.
   *
   * @param name - Canonical key name, e.g. `"right"` or `"space"`.
   * @returns `true` while the key is down.
   */
  isDown(name: string): boolean {
    if (this.kitty) return this.held.has(name);
    const t = this.lastSeen.get(name);
    return t !== undefined && performance.now() - t < this.holdMs;
  }

  /**
   * Whether the key was pressed since the last {@link endFrame}.
   *
   * Use it for one-shot actions (menu confirms, switching weapons, pause). In
   * Kitty mode only real presses count; in legacy mode OS auto-repeats are
   * indistinguishable from presses and also return `true`.
   *
   * @param name - Canonical key name, e.g. `"enter"` or `"q"`.
   * @returns `true` if the key was pressed this frame.
   */
  wasPressed(name: string): boolean {
    return this.pressedNow.has(name);
  }

  /**
   * Clears the per-frame press state tracked for {@link wasPressed}.
   *
   * Call once per frame, after all {@link wasPressed} checks.
   */
  endFrame() {
    this.pressedNow.clear();
  }

  /**
   * Routes all subsequent key events to `handler` instead of the game, which is
   * how {@link TextInput} receives typing.
   *
   * While capturing, new presses do not update {@link isDown} or
   * {@link wasPressed} (releases still update the held set), Ctrl+C still calls
   * {@link onExit}, and the tracked state is cleared so stale presses don't leak
   * into the text field.
   *
   * @param handler - Called for every key event while capturing.
   */
  capture(handler: (key: Key) => void) {
    this.handler = handler;
    this.lastSeen.clear();
    this.pressedNow.clear();
  }

  /**
   * Stops routing keys to the handler passed to {@link capture}. Game input
   * resumes on the next key event.
   */
  release() {
    this.handler = null;
  }

  /**
   * Probes the terminal for Kitty keyboard protocol support.
   *
   * Writes the "current flags" query followed by a primary device attributes
   * query. Every terminal answers the second query, so a device-attributes
   * reply that arrives without a Kitty reply before it means no support.
   *
   * @param timeoutMs - How long to wait for either reply before giving up.
   * @returns Whether the terminal reported Kitty support.
   */
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

  /** stdin `data` listener; forwards raw chunks to {@link parse}. */
  private onData = (chunk: string | Buffer) => {
    this.parse(String(chunk));
  };

  /**
   * Applies one parsed key event.
   *
   * Releases only update the held set (they are tracked even while a text box
   * has focus), Ctrl+C triggers the exit path, and the event is otherwise
   * routed to the capture handler or recorded for {@link isDown} and
   * {@link wasPressed}.
   *
   * @param key - The parsed key.
   * @param ev - Event phase; defaults to `"tap"` for legacy bytes.
   */
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

  /**
   * Parses a raw chunk into key events.
   *
   * A chunk can contain several keys (fast typing, paste, terminal replies), so
   * the string is consumed in a loop. Handles CSI/SS3 escape sequences, CR/LF,
   * backspace, tab, space, control bytes and printable text.
   *
   * @param s - Raw chunk, decoded as UTF-8 text.
   *
   * @remarks
   * Legacy mode carries no modifier information other than Ctrl: Alt+key
   * arrives as an `escape` key followed by the key itself.
   */
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

      // printable text (typing, or pasted text in Kitty mode): no key-up will follow
      const ch = String.fromCodePoint(s.codePointAt(i)!);
      this.dispatch({ name: ch.toLowerCase(), text: ch });
      i += ch.length;
    }
  }

  /**
   * Handles one escape sequence introduced by `ESC [` (CSI) or `ESC O` (SS3).
   *
   * Consumes replies to the startup queries and focus in/out reports, ignores
   * private-prefixed sequences that are not modeled (`CSI <`, `CSI =`,
   * `CSI >`), maps standard sequences through {@link CSI_FINAL} and
   * {@link CSI_TILDE}, and sends Kitty `CSI ... u` sequences to
   * {@link kittyKey}.
   *
   * @param isCsi - `true` for `ESC [`, `false` for `ESC O`.
   * @param params - Bytes between the introducer and the final byte.
   * @param final - Final byte identifying the sequence.
   */
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

  /**
   * Decodes a Kitty `CSI code;mods[:event];text u` sequence into a key.
   *
   * @param code - Unicode code point of the key.
   * @param mods - Modifier bitmask, already offset-corrected (0 means none).
   * @param textParam - Kitty's optional colon-separated associated text (code
   * points), empty when the terminal didn't send any.
   * @returns The key, or `null` for modifier, media and keypad codes, which are
   * ignored.
   */
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

/**
 * A minimal single-line text box.
 *
 * It owns no input state or terminal I/O: feed it every {@link Key} while it is
 * captured, and draw it once per frame. Editing supports the usual keys:
 * Backspace/Delete, Left/Right, Home/End.
 *
 * @example
 * ```ts
 * const name = new TextInput(12, (ch) => /[a-z0-9]/i.test(ch));
 *
 * input.capture((key) => {
 *   const result = name.handle(key);
 *   if (result === null) return;
 *   input.release();
 *   if (result === "submit") save(name.value);
 * });
 *
 * // in the frame:
 * name.draw(screen, 2, 5, style(15), style(0, 4));
 * ```
 */
export class TextInput {
  /** Current text. */
  value = "";

  /** Cursor position as an index into {@link value}, `0`...`value.length`. */
  cursor = 0;

  /**
   * @param maxLength - Maximum length of {@link value} (`value.length`).
   * Defaults to `16`.
   * @param accept - Optional filter for typed characters; return `false` to
   * reject a character. Defaults to accepting everything.
   */
  constructor(
    public maxLength = 16,
    public accept: (ch: string) => boolean = () => true,
  ) {}

  /**
   * Applies one key event. Call it from the handler passed to
   * {@link Input.capture}.
   *
   * Enter and Escape only report their intent; they don't clear the field, so
   * the caller decides what happens (usually {@link Input.release} plus a state
   * change). All other keys edit {@link value} and {@link cursor} in place.
   *
   * @param key - The key event to apply.
   * @returns `"submit"` on Enter, `"cancel"` on Escape, otherwise `null`.
   */
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

  /**
   * Draws the field and its cursor at `(x, y)` on the given screen.
   *
   * The value is padded with spaces to `maxLength + 1` cells so shrinking the
   * text overwrites the previous frame, and the cursor cell is drawn over
   * whatever character is under it (or a space at the end).
   *
   * @param screen - Anything with `set`/`text`, normally a {@link Screen}.
   * @param x - Column of the first cell, 0-based.
   * @param y - Row of the field, 0-based.
   * @param textStyle - Packed style for the text and padding.
   * @param cursorStyle - Packed style for the cursor cell.
   */
  draw(
    screen: Pick<Screen, "set" | "text">,
    x: number,
    y: number,
    textStyle: number,
    cursorStyle: number,
  ) {
    // padEnd keeps the field at a fixed width, so deleted characters get overwritten
    screen.text(x, y, this.value.padEnd(this.maxLength + 1), textStyle);
    screen.set(x + this.cursor, y, this.value.charAt(this.cursor) || " ", cursorStyle);
  }
}
