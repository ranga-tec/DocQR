import { Module } from '@nestjs/common';
import { SigningController } from './signing.controller';
import { SigningService } from './signing.service';
import { NoopSigningProvider } from './providers/noop-signing.provider';

@Module({
  controllers: [SigningController],
  providers: [SigningService, NoopSigningProvider],
  exports: [SigningService],
})
export class SigningModule {}
