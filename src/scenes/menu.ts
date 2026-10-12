import type { Clock } from "../engine/clock";
import type { Input } from "../engine/input";
import { style, type Screen } from "../engine/screen";
import { setTitle } from "../engine/system";
import { Scene } from "./scene";

export class MenuScene extends Scene {
  changesPerFrame: number = 0.1;

  constructor(clock: Clock, input: Input, screen: Screen) {
    super(clock, input, screen);

    setTitle("DN Gasbag");

    process.stdout.write(this.screen.render());
  }

  async update(deltaTime: number): Promise<{ successor: Scene | null }> {
    return { successor: null };
  }

  redraw(w: number, h: number): void {
    this.screen.resize(w, h);

    process.stdout.write(this.screen.render());
  }
}
