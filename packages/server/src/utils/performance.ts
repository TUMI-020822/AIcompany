/**
 * 性能监控和优化工具
 * 提供执行时间追踪、资源监控和性能指标收集
 */

import fs from 'fs/promises';
import path from 'path';

// ── 执行时间追踪 ─────────────────────────────────────────────────────────────

export interface TimingEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

class TimingTracker {
  private entries = new Map<string, TimingEntry>();
  private completedEntries: TimingEntry[] = [];

  start(name: string, metadata?: Record<string, unknown>): string {
    const id = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.entries.set(id, {
      name,
      startTime: performance.now(),
      metadata,
    });
    return id;
  }

  end(id: string): TimingEntry | null {
    const entry = this.entries.get(id);
    if (!entry) return null;

    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;
    this.entries.delete(id);
    this.completedEntries.push(entry);

    // 保留最近 1000 条记录
    if (this.completedEntries.length > 1000) {
      this.completedEntries = this.completedEntries.slice(-1000);
    }

    return entry;
  }

  getStats(name?: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const entries = name
      ? this.completedEntries.filter((e) => e.name === name)
      : this.completedEntries;

    if (entries.length === 0) return null;

    const durations = entries.map((e) => e.duration!).sort((a, b) => a - b);
    const count = durations.length;
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count,
      avgDuration: sum / count,
      minDuration: durations[0],
      maxDuration: durations[count - 1],
      p50: durations[Math.floor(count * 0.5)],
      p95: durations[Math.floor(count * 0.95)],
      p99: durations[Math.floor(count * 0.99)],
    };
  }

  getAllStats(): Record<string, ReturnType<TimingTracker['getStats']>> {
    const names = new Set(this.completedEntries.map((e) => e.name));
    const result: Record<string, ReturnType<TimingTracker['getStats']>> = {};
    for (const name of names) {
      result[name] = this.getStats(name);
    }
    return result;
  }
}

export const timingTracker = new TimingTracker();

// 便捷函数
export function timeAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
  const id = timingTracker.start(name, metadata);
  return fn().finally(() => {
    timingTracker.end(id);
  });
}

// ── 资源监控 ─────────────────────────────────────────────────────────────────

export interface ResourceUsage {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu: {
    user: number;
    system: number;
  };
}

class ResourceMonitor {
  private samples: ResourceUsage[] = [];
  private interval?: ReturnType<typeof setInterval>;
  private maxSamples = 1000;

  start(intervalMs: number = 60000) {
    if (this.interval) return;

    this.interval = setInterval(() => {
      this.sample();
    }, intervalMs);

    // 立即采集一次
    this.sample();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private sample() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const sample: ResourceUsage = {
      timestamp: Date.now(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
    };

    this.samples.push(sample);

    // 保留最近样本
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-this.maxSamples);
    }
  }

  getCurrentUsage(): ResourceUsage {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: Date.now(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
    };
  }

  getHistory(count: number = 100): ResourceUsage[] {
    return this.samples.slice(-count);
  }

  getAverageOver(minutes: number = 5): ResourceUsage | null {
    const cutoff = Date.now() - minutes * 60 * 1000;
    const recentSamples = this.samples.filter((s) => s.timestamp >= cutoff);

    if (recentSamples.length === 0) return null;

    const avg: ResourceUsage = {
      timestamp: Date.now(),
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
      },
      cpu: {
        user: 0,
        system: 0,
      },
    };

    for (const sample of recentSamples) {
      avg.memory.heapUsed += sample.memory.heapUsed;
      avg.memory.heapTotal += sample.memory.heapTotal;
      avg.memory.external += sample.memory.external;
      avg.memory.rss += sample.memory.rss;
      avg.cpu.user += sample.cpu.user;
      avg.cpu.system += sample.cpu.system;
    }

    const count = recentSamples.length;
    avg.memory.heapUsed /= count;
    avg.memory.heapTotal /= count;
    avg.memory.external /= count;
    avg.memory.rss /= count;
    avg.cpu.user /= count;
    avg.cpu.system /= count;

    return avg;
  }
}

export const resourceMonitor = new ResourceMonitor();

// ── 任务执行指标 ─────────────────────────────────────────────────────────────

export interface TaskMetrics {
  taskId: string;
  taskName: string;
  companyId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  totalDuration?: number;
  llmCalls: number;
  totalTokens: number;
  avgStepDuration?: number;
  createdAt: string;
  completedAt?: string;
}

class TaskMetricsCollector {
  private tasks = new Map<string, TaskMetrics>();
  private maxTasks = 1000;

  recordTaskStart(taskId: string, taskName: string, companyId: string, totalSteps: number) {
    const metrics: TaskMetrics = {
      taskId,
      taskName,
      companyId,
      status: 'running',
      totalSteps,
      completedSteps: 0,
      failedSteps: 0,
      llmCalls: 0,
      totalTokens: 0,
      createdAt: new Date().toISOString(),
    };

    this.tasks.set(taskId, metrics);
    this.prune();
  }

  recordStepComplete(taskId: string, tokens: number, duration: number) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.completedSteps++;
    task.llmCalls++;
    task.totalTokens += tokens;

    if (task.completedSteps > 0) {
      task.avgStepDuration = (task.avgStepDuration || 0) * ((task.completedSteps - 1) / task.completedSteps) + duration / task.completedSteps;
    }
  }

  recordStepFail(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.failedSteps++;
  }

  recordTaskComplete(taskId: string, status: 'completed' | 'failed') {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = status;
    task.completedAt = new Date().toISOString();

    if (task.createdAt) {
      task.totalDuration = new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime();
    }
  }

  getTaskMetrics(taskId: string): TaskMetrics | undefined {
    return this.tasks.get(taskId);
  }

  getAllTaskMetrics(): TaskMetrics[] {
    return Array.from(this.tasks.values());
  }

  getCompanyMetrics(companyId: string): TaskMetrics[] {
    return this.getAllTaskMetrics().filter((t) => t.companyId === companyId);
  }

  private prune() {
    if (this.tasks.size > this.maxTasks) {
      // 移除最旧的非运行中任务
      const entries = Array.from(this.tasks.entries())
        .filter(([, v]) => v.status !== 'running')
        .sort((a, b) => new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime());

      const toRemove = entries.slice(0, entries.length - this.maxTasks / 2);
      for (const [id] of toRemove) {
        this.tasks.delete(id);
      }
    }
  }
}

export const taskMetricsCollector = new TaskMetricsCollector();

// ── 性能报告生成 ─────────────────────────────────────────────────────────────

export interface PerformanceReport {
  generatedAt: string;
  uptime: number;
  resourceUsage: ResourceUsage;
  timingStats: Record<string, ReturnType<TimingTracker['getStats']>>;
  recentTasks: TaskMetrics[];
  summary: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    avgTaskDuration: number;
    totalTokensUsed: number;
    avgMemoryUsage: number;
  };
}

export function generatePerformanceReport(): PerformanceReport {
  const tasks = taskMetricsCollector.getAllTaskMetrics();
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const failedTasks = tasks.filter((t) => t.status === 'failed');

  const totalDuration = completedTasks.reduce((sum, t) => sum + (t.totalDuration || 0), 0);
  const avgDuration = completedTasks.length > 0 ? totalDuration / completedTasks.length : 0;

  const currentUsage = resourceMonitor.getCurrentUsage();
  const avgMemory = currentUsage.memory.heapUsed;

  return {
    generatedAt: new Date().toISOString(),
    uptime: process.uptime(),
    resourceUsage: currentUsage,
    timingStats: timingTracker.getAllStats(),
    recentTasks: tasks.slice(-20),
    summary: {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      avgTaskDuration: avgDuration,
      totalTokensUsed: tasks.reduce((sum, t) => sum + t.totalTokens, 0),
      avgMemoryUsage: avgMemory,
    },
  };
}

// ── 缓存工具 ─────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    entry.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number = 60000): void {
    // 清理过期条目
    if (this.cache.size >= this.maxSize) {
      this.prune();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      hits: 0,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { size: number; maxSize: number; hitRate: number } {
    let totalHits = 0;
    let totalEntries = 0;

    for (const entry of this.cache.values()) {
      if (Date.now() <= entry.expiresAt) {
        totalHits += entry.hits;
        totalEntries++;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
    };
  }

  private prune(): void {
    const now = Date.now();

    // 先清理过期的
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }

    // 如果还是太大，移除最少使用的
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].hits - b[1].hits);

      const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.2));
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }
}

// ── 导出 ─────────────────────────────────────────────────────────────────────

export default {
  timingTracker,
  resourceMonitor,
  taskMetricsCollector,
  timeAsync,
  generatePerformanceReport,
  SimpleCache,
};
