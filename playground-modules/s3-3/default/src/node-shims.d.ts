/**
 * 操练场只预装了 Nest 运行所需依赖，没有 @types/node。
 * 这里按需声明本模块用到的 Node 类型；真实项目 npm i -D @types/node 后删掉本文件即可。
 */
declare module 'node:async_hooks' {
  export class AsyncLocalStorage<T> {
    run<R>(store: T, callback: (...args: any[]) => R, ...args: any[]): R;
    getStore(): T | undefined;
    enterWith(store: T): void;
  }
}
