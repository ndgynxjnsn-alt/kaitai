import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FilesModule } from './files/files.module';
import { DecodeModule } from './decode/decode.module';
import { ApiKeyGuard } from './auth/api-key.guard';
import { S3Service } from './files/s3.service';
import { ParserRegistryService } from './decode/parser-registry.service';

@Module({
  imports: [FilesModule, DecodeModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    private readonly s3: S3Service,
    private readonly registry: ParserRegistryService,
  ) {}

  async onModuleInit() {
    // Compile all existing .ksy files into parsers on startup
    const files = await this.s3.list();
    const ksyFiles = files.filter((f) => f.endsWith('.ksy'));
    for (const path of ksyFiles) {
      const content = await this.s3.get(path);
      if (content) {
        await this.registry.register(path, content);
      }
    }
    this.logger.log(
      `Bootstrapped ${this.registry.getAll().length} parser(s) from ${ksyFiles.length} .ksy file(s)`,
    );
  }
}
