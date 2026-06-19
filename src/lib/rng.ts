/**
 * 确定性 PRNG 工具 —— mock 模型与 CODER 调参共用。
 * 同一种子串 → 同一序列（可复现评分）；不同种子串 → 不同序列（异输入异输出，规避红线③）。
 * 不使用 Date.now()/Math.random()：产物字节必须只由输入决定。
 */

/** FNV-1a 32-bit 字符串哈希 → 无符号种子。 */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32：32-bit 种子 → [0,1) 的确定性序列。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 便捷的种子化随机源 + 取值助手。 */
export class Rng {
  private next: () => number;
  constructor(seedKey: string) {
    this.next = mulberry32(hashString(seedKey));
  }
  float(): number {
    return this.next();
  }
  /** [min, max) 浮点。 */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  /** [min, max] 整数。 */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  bool(p = 0.5): boolean {
    return this.next() < p;
  }
  /** 不重复地取 n 个（n ≤ arr.length）。 */
  sample<T>(arr: readonly T[], n: number): T[] {
    const pool = [...arr];
    const out: T[] = [];
    const count = Math.min(n, pool.length);
    for (let i = 0; i < count; i++) {
      out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0]);
    }
    return out;
  }
}
