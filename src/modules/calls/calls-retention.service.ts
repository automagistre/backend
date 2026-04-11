import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { unlink } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { CallRecordingStateEnum } from './enums/call.enums';
import { PrismaService } from 'src/prisma/prisma.service';

const CALLS_RETENTION_CRON = '23 3 * * *';

@Injectable()
export class CallsRetentionService {
  private readonly logger = new Logger(CallsRetentionService.name);
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CALLS_RETENTION_CRON)
  async runByCron(): Promise<void> {
    const enabled = this.getBooleanConfig('CALLS_RETENTION_ENABLED', false);
    if (!enabled) {
      return;
    }

    if (this.isRunning) {
      this.logger.warn('Skip calls retention run: previous run still active');
      return;
    }

    this.isRunning = true;
    try {
      await this.runOnce();
    } catch (error) {
      this.logger.error(`Calls retention failed: ${this.formatError(error)}`);
    } finally {
      this.isRunning = false;
    }
  }

  async runOnce(): Promise<void> {
    const eventsRetentionDays = this.getIntConfig(
      'CALL_EVENTS_RETENTION_DAYS',
      120,
      1,
      3650,
    );
    const recordingsRetentionDays = this.getIntConfig(
      'CALL_RECORDINGS_RETENTION_DAYS',
      365,
      1,
      3650,
    );
    const recordingsBatchLimit = this.getIntConfig(
      'CALL_RECORDINGS_RETENTION_BATCH_LIMIT',
      200,
      1,
      5000,
    );
    const deleteFiles = this.getBooleanConfig(
      'CALL_RECORDINGS_RETENTION_DELETE_FILES',
      false,
    );

    const now = Date.now();
    const eventsCutoff = new Date(
      now - eventsRetentionDays * 24 * 60 * 60 * 1000,
    );
    const recordingsCutoff = new Date(
      now - recordingsRetentionDays * 24 * 60 * 60 * 1000,
    );

    const deletedEvents = await this.prisma.callEvent.deleteMany({
      where: {
        eventAt: { lt: eventsCutoff },
      },
    });

    const oldRecordings = await this.prisma.call.findMany({
      where: {
        recordingPath: { not: null },
        startedAt: { lt: recordingsCutoff },
      },
      select: {
        id: true,
        recordingPath: true,
      },
      orderBy: { startedAt: 'asc' },
      take: recordingsBatchLimit,
    });

    let deletedFiles = 0;
    let fileDeleteErrors = 0;

    for (const call of oldRecordings) {
      const path = call.recordingPath;
      if (deleteFiles && path) {
        const deleted = await this.tryDeleteRecordingFile(path);
        if (deleted) {
          deletedFiles += 1;
        } else {
          fileDeleteErrors += 1;
        }
      }

      await this.prisma.call.update({
        where: { id: call.id },
        data: {
          recordingPath: null,
          recordingMime: null,
          recordingSize: null,
          recordingHash: null,
          recordingState: CallRecordingStateEnum.NONE,
        },
      });
    }

    this.logger.log(
      `Calls retention done: deletedEvents=${deletedEvents.count}, cleanedRecordings=${oldRecordings.length}, deletedFiles=${deletedFiles}, fileDeleteErrors=${fileDeleteErrors}, eventsCutoff=${eventsCutoff.toISOString()}, recordingsCutoff=${recordingsCutoff.toISOString()}`,
    );
  }

  private async tryDeleteRecordingFile(relativePath: string): Promise<boolean> {
    const baseDir =
      this.configService.get<string>('CALL_RECORDINGS_DIR')?.trim() ||
      'storage/call-recordings';
    const baseAbsolutePath = resolve(process.cwd(), baseDir);
    const fileAbsolutePath = resolve(process.cwd(), relativePath);

    if (!this.isPathWithin(baseAbsolutePath, fileAbsolutePath)) {
      this.logger.warn(
        `Skip recording file deletion outside storage base: path=${relativePath}`,
      );
      return false;
    }

    try {
      await unlink(fileAbsolutePath);
      return true;
    } catch (error) {
      this.logger.warn(
        `Recording file delete failed: path=${relativePath}, error=${this.formatError(error)}`,
      );
      return false;
    }
  }

  private isPathWithin(basePath: string, targetPath: string): boolean {
    if (targetPath === basePath) {
      return true;
    }
    return targetPath.startsWith(`${basePath}${sep}`);
  }

  private getBooleanConfig(key: string, defaultValue: boolean): boolean {
    const raw = this.configService.get<string | boolean>(key);
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
    }
    return defaultValue;
  }

  private getIntConfig(
    key: string,
    defaultValue: number,
    min: number,
    max: number,
  ): number {
    const raw = this.configService.get<string | number>(key);
    const value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(raw)
          : defaultValue;
    if (!Number.isFinite(value)) return defaultValue;
    const intValue = Math.floor(value);
    if (intValue < min) return min;
    if (intValue > max) return max;
    return intValue;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
