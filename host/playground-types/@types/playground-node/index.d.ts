/**
 * 操练场编译期的最小 Node 全局声明。
 *
 * 真实 Nest 项目一定会安装 @types/node（`npm i -D @types/node`），
 * 所以 src/main.ts 里直接使用 `process.env.PORT` 是标准写法。
 * 操练场的虚拟运行时没有预装 @types/node，这里通过 TypeScript 的
 * typeRoots 注入一份最小声明，让脚手架风格的 main.ts 能通过类型检查；
 * 它不会出现在用户的项目文件树里。
 */
declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  pid: number;
  platform: string;
  exit(code?: number): never;
  cwd(): string;
};
