import type { Clock } from "../engine/clock";
import type { Input } from "../engine/input";
import type { Screen } from "../engine/screen";

export abstract class Scene {
  clock: Clock;
  input: Input;
  screen: Screen;

  constructor(clock: Clock, input: Input, screen: Screen) {
    this.clock = clock;
    this.input = input;
    this.screen = screen;
  }

  abstract update(): Promise<{ successor: Scene | null }>;

  abstract redraw(width: number, height: number): void;
}
