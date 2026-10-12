import type { Clock } from "../engine/clock";
import type { Input } from "../engine/input";
import { style, type Screen } from "../engine/screen";
import { setTitle } from "../engine/system";
import { Scene } from "./scene";

export class DemoScene extends Scene {
  changesPerFrame: number = 0.1;

  constructor(clock: Clock, input: Input, screen: Screen) {
    super(clock, input, screen);

    setTitle("DN Gasbag - diff_rend Demo");

    for (let y = 0; y < screen.h - 1; y++) {
      for (let x = 0; x < screen.w; x++) {
        this.screen.set(x, y, "#", style(Math.floor(Math.random() * 15)));
      }
    }

    this.statusBar();

    process.stdout.write(this.screen.render());
  }

  statusBar(): void {
    this.screen.text(
      0,
      this.screen.h - 1,
      " DN Gasbag v2 - diff_rend Demo | 60 FPS" +
        " ".repeat(this.screen.w - 50) +
        `${Math.floor(this.changesPerFrame * 100)
          .toString()
          .padStart(3)}% (+/-) `,
      style(15, 5),
    );
  }

  changeSpeed(factor: number): void {
    this.changesPerFrame = Math.min(Math.max(this.changesPerFrame + factor * 0.05, 0), 1);

    this.screen.text(
      this.screen.w - 11,
      this.screen.h - 1,
      Math.floor(this.changesPerFrame * 100)
        .toString()
        .padStart(3),
      style(15, 5),
    );
  }

  async update(deltaTime: number): Promise<{ successor: Scene | null }> {
    if (this.input.isDown("+")) this.changeSpeed(deltaTime);
    if (this.input.isDown("-")) this.changeSpeed(-deltaTime);

    for (let y = 0; y < this.screen.h - 1; y++) {
      for (let x = 0; x < this.screen.w; x++) {
        if (Math.random() > this.changesPerFrame) continue;
        this.screen.set(x, y, "#", style(Math.floor(Math.random() * 15)));
      }
    }

    this.screen.text(
      32,
      this.screen.h - 1,
      Math.floor(1 / deltaTime)
        .toString()
        .padStart(3) + " FPS    ",
      style(15, 5),
    );

    process.stdout.write(this.screen.render());

    return { successor: null };
  }

  redraw(w: number, h: number): void {
    const current = this.screen.capture();

    const ow = this.screen.w;
    const oh = this.screen.h - 1;

    this.screen.resize(w, h);

    this.screen.drawSprite(current, 0, 0);

    for (let y = 0; y < oh; y++) {
      for (let x = ow; x < w; x++) {
        const c = Math.floor(Math.random() * 15);
        this.screen.set(x, y, "#", style(c));
      }
    }

    for (let y = oh; y < h - 1; y++) {
      for (let x = 0; x < w; x++) {
        const c = Math.floor(Math.random() * 15);
        this.screen.set(x, y, "#", style(c));
      }
    }

    this.statusBar();

    process.stdout.write(this.screen.render());
  }
}
