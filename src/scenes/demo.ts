import type { Clock } from "../engine/clock";
import type { Input } from "../engine/input";
import { style, type Screen } from "../engine/screen";
import { Scene } from "./scene";

export class DemoScene extends Scene {
  constructor(clock: Clock, input: Input, screen: Screen) {
    super(clock, input, screen);

    for (let y = 0; y < screen.h; y++) {
      for (let x = 0; x < screen.w; x++) {
        this.screen.set(x, y, "#", style(Math.floor(Math.random() * 15)));
      }
    }

    process.stdout.write(this.screen.render());
  }

  async update(): Promise<{ successor: Scene | null }> {
    this.screen.set(
      Math.floor(Math.random() * this.screen.w),
      Math.floor(Math.random() * this.screen.h),
      "#",
      style(Math.floor(Math.random() * 15)),
    );

    process.stdout.write(this.screen.render());

    return { successor: null };
  }

  redraw(w: number, h: number): void {
    const current = this.screen.capture();

    const ow = this.screen.w;
    const oh = this.screen.h;

    this.screen.resize(w, h);

    this.screen.drawSprite(current, 0, 0);

    for (let y = 0; y < oh; y++) {
      for (let x = ow; x < w; x++) {
        const c = Math.floor(Math.random() * 15);
        this.screen.set(x, y, "#", style(c));
      }
    }

    for (let y = oh; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = Math.floor(Math.random() * 15);
        this.screen.set(x, y, "#", style(c));
      }
    }

    process.stdout.write(this.screen.render());
  }
}
