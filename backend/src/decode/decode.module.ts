import { Module, forwardRef } from '@nestjs/common';
import { DecodeController } from './decode.controller';
import { ParserRegistryService } from './parser-registry.service';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [forwardRef(() => FilesModule)],
  controllers: [DecodeController],
  providers: [ParserRegistryService],
  exports: [ParserRegistryService],
})
export class DecodeModule {}
