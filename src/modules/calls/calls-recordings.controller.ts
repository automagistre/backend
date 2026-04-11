import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { createReadStream } from 'node:fs';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { CallsService } from './calls.service';

@Controller('calls')
@RequireTenant()
export class CallsRecordingsController {
  constructor(private readonly callsService: CallsService) {}

  @Get(':id/recording')
  async getCallRecording(
    @AuthContext() ctx: AuthContextType,
    @Param('id') id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<StreamableFile> {
    const file = await this.callsService.getRecordingFile(ctx, id);

    reply.header('content-type', file.mime ?? 'application/octet-stream');
    reply.header('content-length', String(file.size));
    reply.header(
      'content-disposition',
      `inline; filename="${file.filename.replace(/"/g, '')}"`,
    );
    reply.header('cache-control', 'private, max-age=60');

    return new StreamableFile(createReadStream(file.absolutePath));
  }
}
