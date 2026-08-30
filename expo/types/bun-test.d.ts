declare module "bun:test" {
  export const afterEach: (callback: () => void | Promise<void>) => void;
  export const describe: (name: string, callback: () => void) => void;
  export const test: (name: string, callback: () => void | Promise<void>) => void;
  export const expect: {
    (value: unknown): any;
    arrayContaining(values: readonly unknown[]): unknown;
  };
}

declare module "bun:sqlite" {
  export class Database {
    constructor(filename?: string);
    exec(sql: string): void;
    close(): void;
    query(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): unknown;
    };
  }
}
