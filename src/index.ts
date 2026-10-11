import { Clock, startLoop } from "./engine/clock";
import { Input } from "./engine/input";
import { Screen } from "./engine/screen";
import type { Scene } from "./scenes/scene";
import { DemoScene } from "./scenes/demo";

async function main() {
  if (!process.stdout.isTTY) {
    console.log(
      "ERROR: Standard output/input is not a terminal (TTY). Please run this application directly in an interactive terminal.",
    );
  }

  const screen = new Screen();
  const input = new Input();
  const clock = new Clock();

  screen.enter();
  await input.start();

  let activeScene: Scene = new DemoScene(clock, input, screen);

  let isExiting = false;
  let stopLoop = () => {};

  // Single, idempotent shutdown handler
  const shutdown = (exitCode = 0) => {
    if (isExiting) return;
    isExiting = true;

    stopLoop();
    input.stop();
    screen.leave();

    process.exit(exitCode);
  };

  const checkResize = () => {
    const currentW = process.stdout.columns;
    const currentH = process.stdout.rows;

    if (screen.w !== currentW || screen.h !== currentH) {
      activeScene.redraw(currentW, currentH);
    }
  };

  // Gracefully handle process termination signals
  process.on("SIGINT", () => shutdown(0)); // Ctrl + C
  process.on("SIGTERM", () => shutdown(143)); // Terminal kill signal
  process.on("SIGHUP", () => shutdown(129)); // Terminal window closed
  process.on("uncaughtException", (e) => {
    console.error(e);
    shutdown(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error(reason);
    shutdown(1);
  });

  // Game loop
  stopLoop = startLoop(async (deltaTime) => {
    if (input.wasPressed("escape")) {
      shutdown(0);
      return;
    }

    checkResize();
    await activeScene.update(deltaTime);
    input.endFrame();
  }, 60);
}

// void (async () => {
//   await main();
// })();
await main();
