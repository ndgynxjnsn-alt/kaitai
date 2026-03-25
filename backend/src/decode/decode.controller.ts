import {
  Controller,
  Post,
  Body,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiResponse } from '@nestjs/swagger';
import { S3Service } from '../files/s3.service';
import { ParserRegistryService, TreeNode } from './parser-registry.service';

interface DecodeRequestDto {
  file: string;
}

interface ParserResult {
  id: string;
  success: boolean;
  objectTree?: TreeNode;
  error?: string;
}

interface DecodeResponseDto {
  file: string;
  parsers: ParserResult[];
}

@ApiTags('decode')
@ApiSecurity('api-key')
@ApiResponse({ status: 401, description: 'Invalid or missing API key (x-api-key header)' })
@Controller('decode')
export class DecodeController {
  constructor(
    private readonly s3: S3Service,
    private readonly registry: ParserRegistryService,
  ) {}

  @ApiOperation({ summary: 'Decode a binary file with all registered parsers' })
  @ApiResponse({ status: 200, description: 'Parse results from all registered parsers' })
  @Post()
  async decode(@Body() body: DecodeRequestDto): Promise<DecodeResponseDto> {
    const { file } = body;
    if (!file) {
      throw new BadRequestException('Missing "file" field (S3 path)');
    }

    // Download the binary file from S3
    const content = await this.s3.get(file);
    if (content === null) {
      throw new NotFoundException(`File not found: ${file}`);
    }

    // Convert the hex string content to an ArrayBuffer
    const buffer = hexToArrayBuffer(content);

    // Run all parsers
    const allParsers = this.registry.getAll();
    const parsers: ParserResult[] = allParsers.map((parser) => {
      const result = this.registry.parseWith(parser, buffer);
      return {
        id: parser.id,
        success: result.success,
        objectTree: result.tree,
        error: result.error,
      };
    });

    return { file, parsers };
  }
}

/** Convert a hex-encoded string (e.g. "cafebabe01") to an ArrayBuffer. */
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const clean = hex.replace(/\s+/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer as ArrayBuffer;
}
