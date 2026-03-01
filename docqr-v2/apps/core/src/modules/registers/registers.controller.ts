import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  RegistersService,
  CreateRegisterDto,
  UpdateRegisterDto,
  CreateEntryDto,
  UpdateEntryDto,
} from './registers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

interface CurrentUserData {
  id: string;
  email: string;
  roles: string[];
}

@ApiTags('registers')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('registers')
export class RegistersController {
  constructor(private readonly registersService: RegistersService) {}

  // =====================
  // Physical Registers
  // =====================

  @Post()
  @UseGuards(RolesGuard)
  @RequireRoles('admin', 'clerk')
  @ApiOperation({ summary: 'Create a new physical register' })
  createRegister(
    @Body() dto: CreateRegisterDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.registersService.createRegister(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all physical registers' })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'registerType', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAllRegisters(
    @Query('departmentId') departmentId?: string,
    @Query('registerType') registerType?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.registersService.findAllRegisters({
      departmentId,
      registerType,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get register statistics' })
  getStats() {
    return this.registersService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a physical register by ID' })
  findOneRegister(@Param('id') id: string) {
    return this.registersService.findOneRegister(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @RequireRoles('admin', 'clerk')
  @ApiOperation({ summary: 'Update a physical register' })
  updateRegister(@Param('id') id: string, @Body() dto: UpdateRegisterDto) {
    return this.registersService.updateRegister(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a physical register (Admin only)' })
  deleteRegister(@Param('id') id: string) {
    return this.registersService.deleteRegister(id);
  }

  // =====================
  // Register Entries
  // =====================

  @Post('entries')
  @UseGuards(RolesGuard)
  @RequireRoles('admin', 'clerk')
  @ApiOperation({ summary: 'Create a new register entry' })
  createEntry(
    @Body() dto: CreateEntryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.registersService.createEntry(dto, user.id);
  }

  @Get('entries')
  @ApiOperation({ summary: 'List register entries with filtering and pagination' })
  @ApiQuery({ name: 'registerId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  findAllEntries(
    @Query('registerId') registerId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.registersService.findAllEntries({
      registerId,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get('entries/export/excel')
  @ApiOperation({ summary: 'Export register entries to Excel' })
  async exportEntriesExcel(
    @Res() res: Response,
    @Query('registerId') registerId?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const entries = await this.registersService.getEntriesForExport({
      registerId,
      search,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });

    const rows = entries.map((entry) => ({
      RegisterCode: entry.register?.registerCode || '',
      EntryNumber: entry.entryNumber,
      EntryDate: entry.entryDate.toISOString().slice(0, 10),
      Subject: entry.subject,
      FromParty: entry.fromParty || '',
      ToParty: entry.toParty || '',
      Remarks: entry.remarks || '',
      DocketNumber: entry.docket?.docketNumber || '',
      DocketStatus: entry.docket?.status || '',
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RegisterEntries');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `register-entries-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    res.send(buffer);
  }

  @Get('entries/export/pdf')
  @ApiOperation({ summary: 'Export register entries to PDF' })
  async exportEntriesPdf(
    @Res() res: Response,
    @Query('registerId') registerId?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const entries = await this.registersService.getEntriesForExport({
      registerId,
      search,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });

    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(16).text('Register Entries Export', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555555').text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(1);
    doc.fillColor('#000000');

    if (entries.length === 0) {
      doc.fontSize(11).text('No entries found for the selected filters.');
    } else {
      entries.forEach((entry, index) => {
        doc.fontSize(11).text(`${index + 1}. ${entry.subject}`);
        doc.fontSize(9).fillColor('#555555').text(
          `Entry: ${entry.entryNumber} | Date: ${entry.entryDate.toISOString().slice(0, 10)} | Register: ${entry.register?.registerCode || 'N/A'}`,
        );
        doc.text(
          `From: ${entry.fromParty || '-'} | To: ${entry.toParty || '-'} | Docket: ${entry.docket?.docketNumber || '-'}`,
        );
        if (entry.remarks) {
          doc.text(`Remarks: ${entry.remarks}`);
        }
        doc.fillColor('#000000');
        doc.moveDown(0.8);

        if (doc.y > 760) {
          doc.addPage();
        }
      });
    }

    doc.end();

    const buffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const fileName = `register-entries-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(buffer);
  }

  @Get(':registerId/next-entry-number')
  @ApiOperation({ summary: 'Get the next available entry number for a register' })
  getNextEntryNumber(@Param('registerId') registerId: string) {
    return this.registersService.getNextEntryNumber(registerId);
  }

  @Get('entries/:id')
  @ApiOperation({ summary: 'Get a register entry by ID' })
  findOneEntry(@Param('id') id: string) {
    return this.registersService.findOneEntry(id);
  }

  @Put('entries/:id')
  @UseGuards(RolesGuard)
  @RequireRoles('admin', 'clerk')
  @ApiOperation({ summary: 'Update a register entry' })
  updateEntry(@Param('id') id: string, @Body() dto: UpdateEntryDto) {
    return this.registersService.updateEntry(id, dto);
  }

  @Delete('entries/:id')
  @UseGuards(RolesGuard)
  @RequireRoles('admin', 'clerk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a register entry' })
  deleteEntry(@Param('id') id: string) {
    return this.registersService.deleteEntry(id);
  }

  // =====================
  // Linking
  // =====================

  @Post('entries/:entryId/link-docket/:docketId')
  @UseGuards(RolesGuard)
  @RequireRoles('admin', 'clerk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link a register entry to a docket' })
  linkDocket(
    @Param('entryId') entryId: string,
    @Param('docketId') docketId: string,
  ) {
    return this.registersService.linkDocket(entryId, docketId);
  }

  @Delete('entries/:entryId/unlink-docket')
  @UseGuards(RolesGuard)
  @RequireRoles('admin', 'clerk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink a register entry from its docket' })
  unlinkDocket(@Param('entryId') entryId: string) {
    return this.registersService.unlinkDocket(entryId);
  }
}
