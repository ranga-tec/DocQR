import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnlyOfficeService } from './onlyoffice.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('onlyoffice')
@Controller('onlyoffice')
export class OnlyOfficeController {
  constructor(private readonly onlyOfficeService: OnlyOfficeService) {}

  @Get('config/:attachmentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get OnlyOffice editor configuration for an attachment' })
  async getEditorConfig(
    @Param('attachmentId') attachmentId: string,
    @Query('mode') mode: 'view' | 'edit' = 'edit',
    @CurrentUser('id') userId: string,
  ) {
    return this.onlyOfficeService.getEditorConfig(attachmentId, userId, mode);
  }

  @Get('download/:attachmentId')
  @ApiOperation({ summary: 'Download attachment for OnlyOffice (internal)' })
  async downloadForOnlyOffice(
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const { stream, mimeType, fileName } = await this.onlyOfficeService.getFileForDownload(attachmentId);

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Access-Control-Allow-Origin': '*',
    });

    stream.pipe(res);
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle OnlyOffice document save callback' })
  async handleCallback(@Body() body: any) {
    // OnlyOffice sends callback when document is saved
    return this.onlyOfficeService.handleCallback(body);
  }
}
