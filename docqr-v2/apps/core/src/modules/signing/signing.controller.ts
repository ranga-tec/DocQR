import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateSigningRequestDto, SigningService } from './signing.service';

@ApiTags('signing')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles('admin', 'approver')
@Controller('signing')
export class SigningController {
  constructor(private readonly signingService: SigningService) {}

  @Get('providers')
  @ApiOperation({ summary: 'List signing providers and configuration state' })
  getProviders() {
    return this.signingService.getProviders();
  }

  @Post('requests')
  @ApiOperation({ summary: 'Create a signing request (placeholder flow)' })
  createRequest(
    @Body() dto: CreateSigningRequestDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.signingService.createRequest(dto, userId);
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get signing request details' })
  getRequest(@Param('id') id: string) {
    return this.signingService.getRequest(id);
  }

  @Post('requests/:id/dispatch')
  @ApiOperation({ summary: 'Dispatch signing request to configured provider' })
  dispatchRequest(@Param('id') id: string) {
    return this.signingService.dispatchRequest(id);
  }
}
