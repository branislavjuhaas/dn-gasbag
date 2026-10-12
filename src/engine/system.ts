export const setTitle = (title: string) =>
  process.stdout.write(`\x1b]2;${title.replace(/\p{Cc}/gu, "")}\x07`);
