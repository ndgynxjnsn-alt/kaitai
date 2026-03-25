import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { S3Service } from './s3.service';

interface FileEntry {
  path: string;
  content: string | null;
}

@Controller('files')
export class FilesController {
  constructor(private readonly s3: S3Service) {}

  /** GET /files — list all file paths */
  @Get()
  async list(): Promise<{ files: string[] }> {
    const files = await this.s3.list();
    return { files };
  }

  /** GET /files/* — get a single file's content */
  @Get('*path')
  async getFile(@Param('path') path: string): Promise<FileEntry> {
    const filePath = '/' + path;
    const content = await this.s3.get(filePath);
    if (content === null) {
      throw new NotFoundException(`File not found: ${filePath}`);
    }
    return { path: filePath, content };
  }

  /** PUT /files/* — create or overwrite a file */
  @Put('*path')
  async putFile(
    @Param('path') path: string,
    @Body('content') content: string,
  ): Promise<{ path: string }> {
    const filePath = '/' + path;
    await this.s3.put(filePath, content ?? '');
    return { path: filePath };
  }

  /** DELETE /files/* — delete a file */
  @Delete('*path')
  async deleteFile(@Param('path') path: string): Promise<{ deleted: string }> {
    const filePath = '/' + path;
    await this.s3.delete(filePath);
    return { deleted: filePath };
  }
}
