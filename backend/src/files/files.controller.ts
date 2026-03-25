import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiResponse } from '@nestjs/swagger';
import { S3Service } from './s3.service';

interface FileEntry {
  path: string;
  content: string | null;
}

@ApiTags('files')
@ApiSecurity('api-key')
@ApiResponse({ status: 401, description: 'Invalid or missing API key (x-api-key header)' })
@Controller('files')
export class FilesController {
  constructor(private readonly s3: S3Service) {}

  @ApiOperation({ summary: 'List all file paths' })
  @Get()
  async list(): Promise<{ files: string[] }> {
    const files = await this.s3.list();
    return { files };
  }

  @ApiOperation({ summary: 'Get a single file by path' })
  @Get('*path')
  async getFile(@Param('path') path: string): Promise<FileEntry> {
    const filePath = '/' + path;
    const content = await this.s3.get(filePath);
    if (content === null) {
      throw new NotFoundException(`File not found: ${filePath}`);
    }
    return { path: filePath, content };
  }

  @ApiOperation({ summary: 'Create or overwrite a file' })
  @Put('*path')
  async putFile(
    @Param('path') path: string,
    @Body('content') content: string,
  ): Promise<{ path: string }> {
    const filePath = '/' + path;
    await this.s3.put(filePath, content ?? '');
    return { path: filePath };
  }

  @ApiOperation({ summary: 'Delete a file' })
  @Delete('*path')
  async deleteFile(@Param('path') path: string): Promise<{ deleted: string }> {
    const filePath = '/' + path;
    await this.s3.delete(filePath);
    return { deleted: filePath };
  }
}
