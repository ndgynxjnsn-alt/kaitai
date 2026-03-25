import { Module, forwardRef } from '@nestjs/common';
import { FilesController } from './files.controller';
import { S3Service } from './s3.service';
import { DecodeModule } from '../decode/decode.module';

@Module({
  imports: [forwardRef(() => DecodeModule)],
  controllers: [FilesController],
  providers: [S3Service],
  exports: [S3Service],
})
export class FilesModule {}
