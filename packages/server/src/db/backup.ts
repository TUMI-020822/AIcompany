/**
 * 数据库备份和恢复工具
 */

import fs from 'fs/promises';
import path from 'path';
import { sqlite, saveDatabase } from './index.js';
import { config } from '../config.js';

const BACKUP_DIR = path.join(path.dirname(config.DB_PATH), 'backups');

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  type: 'auto' | 'manual';
}

/**
 * 确保备份目录存在
 */
async function ensureBackupDir(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

/**
 * 创建数据库备份
 */
export async function createBackup(type: 'auto' | 'manual' = 'manual'): Promise<BackupInfo> {
  await ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, filename);

  // 导出数据库到文件
  const data = sqlite.export();
  await fs.writeFile(backupPath, Buffer.from(data));

  const stats = await fs.stat(backupPath);

  const info: BackupInfo = {
    filename,
    path: backupPath,
    size: stats.size,
    createdAt: new Date().toISOString(),
    type,
  };

  console.log(`[backup] Created ${type} backup: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);

  return info;
}

/**
 * 列出所有备份
 */
export async function listBackups(): Promise<BackupInfo[]> {
  await ensureBackupDir();

  const files = await fs.readdir(BACKUP_DIR);
  const backups: BackupInfo[] = [];

  for (const filename of files) {
    if (!filename.endsWith('.db')) continue;

    const filePath = path.join(BACKUP_DIR, filename);
    const stats = await fs.stat(filePath);

    backups.push({
      filename,
      path: filePath,
      size: stats.size,
      createdAt: stats.birthtime.toISOString(),
      type: filename.includes('auto') ? 'auto' : 'manual',
    });
  }

  // 按时间倒序排列
  return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * 从备份恢复数据库
 * 注意：sql.js 不支持热恢复，需要重启服务器
 */
export async function restoreBackup(filename: string): Promise<void> {
  const backupPath = path.join(BACKUP_DIR, filename);

  // 检查备份文件是否存在
  try {
    await fs.access(backupPath);
  } catch {
    throw new Error(`Backup file not found: ${filename}`);
  }

  // 备份当前数据库
  const currentBackup = `${config.DB_PATH}.before-restore-${Date.now()}`;
  const currentData = sqlite.export();
  await fs.writeFile(currentBackup, Buffer.from(currentData));

  // 加载备份
  const backupData = await fs.readFile(backupPath);
  const SQL = (await import('sql.js')).default;
  const SQL2 = await SQL();
  const backupDb = new SQL2.Database(backupData);

  // 替换当前数据库 - 通过重新初始化
  sqlite.close();
  
  // 将备份数据写入主数据库文件
  await fs.writeFile(config.DB_PATH, backupData);

  console.log(`[backup] Restored from ${filename}`);
  console.log(`[backup] Previous database backed up to ${currentBackup}`);
  console.log(`[backup] Please restart the server to use the restored database`);
}

/**
 * 删除旧备份
 */
export async function pruneBackups(keepCount: number = 10): Promise<number> {
  const backups = await listBackups();

  if (backups.length <= keepCount) {
    return 0;
  }

  const toDelete = backups.slice(keepCount);
  let deleted = 0;

  for (const backup of toDelete) {
    try {
      await fs.unlink(backup.path);
      deleted++;
    } catch (err) {
      console.error(`[backup] Failed to delete ${backup.filename}:`, err);
    }
  }

  console.log(`[backup] Pruned ${deleted} old backups`);
  return deleted;
}

/**
 * 自动备份调度器
 */
export class AutoBackupScheduler {
  private interval?: ReturnType<typeof setInterval>;
  private readonly intervalMs: number;
  private readonly maxBackups: number;

  constructor(intervalHours: number = 24, maxBackups: number = 7) {
    this.intervalMs = intervalHours * 60 * 60 * 1000;
    this.maxBackups = maxBackups;
  }

  start(): void {
    if (this.interval) return;

    // 立即执行一次
    this.runBackup();

    // 定时执行
    this.interval = setInterval(() => {
      this.runBackup();
    }, this.intervalMs);

    console.log(`[backup] Auto backup scheduled every ${this.intervalMs / 1000 / 60 / 60} hours`);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private async runBackup(): Promise<void> {
    try {
      await createBackup('auto');
      await pruneBackups(this.maxBackups);
    } catch (err) {
      console.error('[backup] Auto backup failed:', err);
    }
  }
}

/**
 * 数据库健康检查
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'ok' | 'error';
  message?: string;
  stats?: {
    tables: Record<string, number>;
    dbSize: number;
    integrity: string;
  };
}> {
  try {
    // 检查完整性
    const integrityResult = sqlite.exec('PRAGMA integrity_check');
    const integrity = integrityResult[0]?.values[0]?.[0] || 'unknown';

    // 获取各表记录数
    const tables = [
      'companies',
      'agents_catalog',
      'company_employees',
      'custom_agents',
      'chat_conversations',
      'chat_messages',
      'tasks',
      'task_steps',
      'api_keys',
    ];

    const counts: Record<string, number> = {};
    for (const table of tables) {
      try {
        const result = sqlite.exec(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = result[0]?.values[0]?.[0] as number || 0;
      } catch {
        counts[table] = -1;
      }
    }

    // 获取数据库文件大小
    let dbSize = 0;
    try {
      const stats = await fs.stat(config.DB_PATH);
      dbSize = stats.size;
    } catch {
      // 文件可能还不存在
    }

    return {
      status: integrity === 'ok' ? 'ok' : 'error',
      message: integrity === 'ok' ? 'Database is healthy' : `Integrity check failed: ${integrity}`,
      stats: {
        tables: counts,
        dbSize,
        integrity: integrity as string,
      },
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
