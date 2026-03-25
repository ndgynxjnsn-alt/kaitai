import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FilesModule } from './files/files.module';
import { ApiKeyGuard } from './auth/api-key.guard';

@Module({
  imports: [FilesModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
