import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

export interface CreateCommentDto {
  content: string;
  commentType?: string;
  attachmentId?: string;
  isInternal?: boolean;
}

@ApiTags('comments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dockets/:docketId/comments')
export class CommentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:view')
  @ApiOperation({ summary: 'Get all comments for a docket' })
  async findAll(@Param('docketId') docketId: string) {
    return this.prisma.docketComment.findMany({
      where: { docketId },
      include: {
        author: { select: { id: true, username: true, email: true } },
        attachment: { select: { id: true, originalFileName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:comment')
  @ApiOperation({ summary: 'Add a comment to docket (immutable)' })
  async create(
    @Param('docketId') docketId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.prisma.docketComment.create({
      data: {
        docketId,
        content: dto.content,
        commentType: dto.commentType || 'note',
        attachmentId: dto.attachmentId,
        isInternal: dto.isInternal || false,
        createdBy: userId,
      },
      include: {
        author: { select: { id: true, username: true, email: true } },
      },
    });
  }
}
