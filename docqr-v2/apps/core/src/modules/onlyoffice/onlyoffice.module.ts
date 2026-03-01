import { Module } from '@nestjs/common';
import { OnlyOfficeController } from './onlyoffice.controller';
import { OnlyOfficeService } from './onlyoffice.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DocketsModule } from '../dockets/dockets.module';

@Module({
  imports: [PrismaModule, DocketsModule],
  controllers: [OnlyOfficeController],
  providers: [OnlyOfficeService],
  exports: [OnlyOfficeService],
})
export class OnlyOfficeModule {}
