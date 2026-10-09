import { setImmediate as yieldToIO } from "node:timers/promises";
import { Clock } from "./engine/clock";
import { Input } from "./engine/input";
import { Screen } from "./engine/screen";
import type { Scene } from "./scenes/scene";
import { DemoScene } from "./scenes/demo";

async function main() {
  const screen = new Screen();
  const input = new Input();
  const clock = new Clock();

  screen.enter();
  await input.start();

  let activeScene: Scene = new DemoScene(clock, input, screen);

  const cleanup = () => {
    input.stop();
    screen.leave();
  };

  const checkResize = () => {
    const currentW = process.stdout.columns;
    const currentH = process.stdout.rows;

    if (screen.w != currentW || screen.h != currentH) {
      activeScene.redraw(currentW, currentH);
    }
  };

  process.on("exit", cleanup);
  process.on("SIGTERM", () => process.exit(143));
  process.on("SIGHUP", () => process.exit(129));
  process.on("uncaughtException", (e) => {
    cleanup();
    console.error(e);
    process.exit(1);
  });

  while (true) {
    if (input.wasPressed("escape")) process.exit(0);

    checkResize();

    await activeScene.update();

    input.endFrame();
    await yieldToIO();
  }
}

await main();
