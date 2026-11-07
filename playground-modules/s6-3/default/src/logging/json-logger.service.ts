import { Injectable, LoggerService } from '@nestjs/common';
import { currentTraceId } from './trace-context';

/**
 * 练习 s6-3 · 结构化日志与可观测性
 *
 * 用自定义 LoggerService 替换 Nest 默认日志：每行一条 JSON，字段固定，
 * 方便 Loki / ELK / CloudWatch 直接按字段检索：
 *   {"ts":"...","level":"info","context":"OrdersService","msg":"order.created",
 *    "traceId":"tr-...","meta":{"orderId":"ord-1001"}}
 *
 * 三条硬规则：
 *   1. 一定有 traceId（同一个请求的所有日志共享一个）；
 *   2. 敏感字段（password/token/authorization/cookie）落盘前必须脱敏；
 *   3. 慢请求打 warn，供告警规则按 durationMs 抓。
 *
 * 真实项目：pino（nestjs-pino）或 winston 做 JSON transport，OpenTelemetry 负责 traceId 注入；
 * 本文件用内存环形缓冲代替日志系统的「查询最近 N 条」能力。
 */

/** 命中这些 key（不区分大小写）的值一律替换成 [REDACTED]。 */
const SENSITIVE_KEYS = ['password', 'passwd', 'token', 'accesstoken', 'refreshtoken', 'authorization', 'cookie', 'secret', 'idcard', 'phone'];

const MAX_BUFFER = 200;

export interface LogEntry {
  ts: string;
  level: string;
  context: string;
  msg: string;
  traceId?: string;
  meta?: Record<string, any>;
}

/** 递归脱敏：对象/数组都走一遍，避免嵌套里的 token 漏出去。 */
export function redact(value: any, depth = 0): any {
  if (depth > 4) return '[depth-limit]';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value !== null && typeof value === 'object') {
    const output: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = SENSITIVE_KEYS.indexOf(key.toLowerCase()) >= 0 ? '[REDACTED]' : redact(item, depth + 1);
    }
    return output;
  }
  return value;
}

@Injectable()
export class JsonLoggerService implements LoggerService {
  private readonly buffer: LogEntry[] = [];
  private readonly levelCounts: Record<string, number> = {};

  log(message: any, ...optionalParams: any[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: any, ...optionalParams: any[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]): void {
    this.write('verbose', message, optionalParams);
  }

  /** 给 /logs?traceId= 用：按 traceId 过滤最近日志（真实项目查 Loki/Jaeger）。 */
  recent(traceId?: string): LogEntry[] {
    const list = traceId ? this.buffer.filter((entry) => entry.traceId === traceId) : this.buffer;
    return list.slice(-50);
  }

  stats() {
    return { buffered: this.buffer.length, levelCounts: { ...this.levelCounts }, maxBuffer: MAX_BUFFER };
  }

  /**
   * Nest 的日志调用签名很灵活：log(message) / log(message, context) / log(obj)。
   * 这里把字符串参数当 context，对象参数并进 meta，其余忽略。
   */
  private write(level: string, message: any, params: any[]): void {
    let context = 'App';
    let meta: Record<string, any> | undefined;
    for (const param of params) {
      if (typeof param === 'string') context = param;
      else if (param !== null && typeof param === 'object') meta = { ...(meta ?? {}), ...param };
    }

    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      context,
      msg: typeof message === 'string' ? message : String(message?.name ?? 'object'),
      traceId: currentTraceId() ?? undefined,
    };
    if (message !== null && typeof message === 'object') meta = { message: redact(message), ...(meta ?? {}) };
    if (meta !== undefined) entry.meta = redact(meta);

    this.levelCounts[level] = (this.levelCounts[level] ?? 0) + 1;
    this.buffer.push(entry);
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
    // stdout 一行一条 JSON：容器日志采集器按行解析。真实项目交给 pino 的 transport。
    console.log(JSON.stringify(entry));
  }
}
