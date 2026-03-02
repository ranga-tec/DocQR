using System.Globalization;
using System.Security.Claims;
using System.Text;
using DocQR.Api.Data;
using DocQR.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DocQR.Api.Controllers;

[ApiController]
[Route("api/v1/registers")]
[Produces("application/json")]
public class RegistersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<RegistersController> _logger;

    public RegistersController(AppDbContext context, ILogger<RegistersController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    [Authorize]
    public async Task<ActionResult> GetRegisters()
    {
        var registersRaw = await _context.Registers
            .Where(r => r.IsActive)
            .Include(r => r.Department)
            .Include(r => r.Entries)
            .OrderBy(r => r.Name)
            .ToListAsync();

        var registers = registersRaw.Select(r => new
        {
            r.Id,
            r.Name,
            registerCode = r.Code,
            r.Description,
            r.DepartmentId,
            department = r.Department != null ? new { r.Department.Id, r.Department.Name, r.Department.Code } : null,
            registerType = r.RegisterType,
            yearStart = r.YearStart,
            yearEnd = r.YearEnd,
            r.IsActive,
            r.CreatedAt,
            _count = new { entries = r.Entries.Count }
        }).ToList();

        return Ok(new { data = registers });
    }

    [HttpGet("stats")]
    [Authorize]
    public async Task<ActionResult> GetStats()
    {
        var totalRegisters = await _context.Registers.CountAsync();
        var activeRegisters = await _context.Registers.CountAsync(r => r.IsActive);
        var totalEntries = await _context.RegisterEntries.CountAsync();
        var recentEntries = await _context.RegisterEntries.CountAsync(e => e.CreatedAt >= DateTime.UtcNow.AddDays(-7));
        var pendingEntries = await _context.RegisterEntries.CountAsync(e => e.DocketId == null);

        var byTypeRows = await _context.Registers
            .GroupBy(r => r.RegisterType)
            .Select(g => new { RegisterType = g.Key, Count = g.Count() })
            .ToListAsync();

        var byType = byTypeRows.ToDictionary(
            x => string.IsNullOrWhiteSpace(x.RegisterType) ? "general" : x.RegisterType,
            x => x.Count,
            StringComparer.OrdinalIgnoreCase);

        return Ok(new
        {
            data = new
            {
                totalRegisters,
                activeRegisters,
                totalEntries,
                recentEntries,
                pendingEntries,
                byType
            }
        });
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<ActionResult> GetRegister(string id)
    {
        var r = await _context.Registers
            .Where(x => x.Id == id)
            .Include(x => x.Department)
            .Include(x => x.Creator)
            .Include(x => x.Entries)
            .FirstOrDefaultAsync();

        if (r == null) return NotFound(new { message = "Register not found" });

        return Ok(new
        {
            data = new
            {
                r.Id,
                r.Name,
                registerCode = r.Code,
                r.Description,
                r.DepartmentId,
                department = r.Department != null ? new { r.Department.Id, r.Department.Name, r.Department.Code } : null,
                registerType = r.RegisterType,
                yearStart = r.YearStart,
                yearEnd = r.YearEnd,
                r.IsActive,
                r.CreatedAt,
                creator = r.Creator != null ? new { r.Creator.Id, r.Creator.Username, r.Creator.FirstName, r.Creator.LastName } : null,
                _count = new { entries = r.Entries.Count }
            }
        });
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult> CreateRegister([FromBody] CreateRegisterDto dto)
    {
        var code = dto.GetCode().Trim().ToUpperInvariant();
        var name = dto.Name.Trim();
        if (string.IsNullOrWhiteSpace(code)) return BadRequest(new { message = "Register code is required" });
        if (string.IsNullOrWhiteSpace(name)) return BadRequest(new { message = "Register name is required" });

        var exists = await _context.Registers.AnyAsync(r => r.Code == code);
        if (exists) return BadRequest(new { message = "Register with this code already exists" });

        var register = new Register
        {
            Name = name,
            Code = code,
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            DepartmentId = string.IsNullOrWhiteSpace(dto.DepartmentId) ? null : dto.DepartmentId,
            RegisterType = string.IsNullOrWhiteSpace(dto.RegisterType) ? "general" : dto.RegisterType.Trim().ToLowerInvariant(),
            YearStart = dto.GetYearStart(),
            YearEnd = dto.GetYearEnd(),
            IsActive = true,
            CreatedBy = GetCurrentUserId()
        };

        _context.Registers.Add(register);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRegister), new { id = register.Id }, new
        {
            data = new
            {
                register.Id,
                register.Name,
                registerCode = register.Code,
                register.Description,
                register.DepartmentId,
                registerType = register.RegisterType,
                yearStart = register.YearStart,
                yearEnd = register.YearEnd,
                register.IsActive,
                register.CreatedAt
            }
        });
    }

    [HttpPatch("{id}")]
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult> UpdateRegister(string id, [FromBody] UpdateRegisterDto dto)
    {
        var register = await _context.Registers.FindAsync(id);
        if (register == null) return NotFound(new { message = "Register not found" });

        if (!string.IsNullOrWhiteSpace(dto.Name)) register.Name = dto.Name.Trim();

        var code = dto.GetCode();
        if (!string.IsNullOrWhiteSpace(code))
        {
            var normalized = code.Trim().ToUpperInvariant();
            var duplicate = await _context.Registers.AnyAsync(r => r.Id != id && r.Code == normalized);
            if (duplicate) return BadRequest(new { message = "Register with this code already exists" });
            register.Code = normalized;
        }

        if (dto.Description != null) register.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        if (dto.DepartmentId != null) register.DepartmentId = string.IsNullOrWhiteSpace(dto.DepartmentId) ? null : dto.DepartmentId;
        if (!string.IsNullOrWhiteSpace(dto.RegisterType)) register.RegisterType = dto.RegisterType.Trim().ToLowerInvariant();
        if (dto.YearStart != null || dto.YearStartDate.HasValue) register.YearStart = dto.GetYearStart();
        if (dto.YearEnd != null || dto.YearEndDate.HasValue) register.YearEnd = dto.GetYearEnd();
        if (dto.IsActive.HasValue) register.IsActive = dto.IsActive.Value;

        await _context.SaveChangesAsync();
        return Ok(new { data = register });
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult> DeleteRegister(string id)
    {
        var register = await _context.Registers.FindAsync(id);
        if (register == null) return NotFound(new { message = "Register not found" });
        register.IsActive = false;
        await _context.SaveChangesAsync();
        return Ok(new { message = "Register deactivated successfully" });
    }

    [HttpGet("{registerId}/next-entry-number")]
    [Authorize]
    public async Task<ActionResult> GetNextEntryNumber(string registerId)
    {
        var exists = await _context.Registers.AnyAsync(r => r.Id == registerId);
        if (!exists) return NotFound(new { message = "Register not found" });
        return Ok(new { nextEntryNumber = await ResolveNextEntryNumber(registerId) });
    }

    [HttpGet("entries")]
    [Authorize]
    public async Task<ActionResult> GetEntries(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        [FromQuery] string? registerId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? fromDate = null,
        [FromQuery] string? toDate = null)
    {
        page = page <= 0 ? 1 : page;
        limit = limit <= 0 ? 20 : limit;

        var query = BuildEntriesQuery(registerId, search, fromDate, toDate);
        var total = await query.CountAsync();
        var rows = await query
            .OrderByDescending(e => e.EntryDate)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        return Ok(new
        {
            data = rows.Select(MapEntry).ToList(),
            meta = new { total, page, limit, totalPages = (int)Math.Ceiling((double)total / limit) }
        });
    }

    [HttpGet("entries/{id}")]
    [Authorize]
    public async Task<ActionResult> GetEntry(string id)
    {
        var entry = await _context.RegisterEntries
            .Include(e => e.Register)
            .Include(e => e.Docket)
            .FirstOrDefaultAsync(e => e.Id == id);
        if (entry == null) return NotFound(new { message = "Register entry not found" });
        return Ok(new { data = MapEntry(entry) });
    }

    [HttpPost("entries")]
    [Authorize]
    public async Task<ActionResult> CreateEntryGlobal([FromBody] CreateRegisterEntryDto dto)
    {
        var registerId = dto.GetRegisterId();
        if (string.IsNullOrWhiteSpace(registerId)) return BadRequest(new { message = "RegisterId is required" });
        return await CreateEntryInternal(registerId, dto);
    }

    [HttpGet("{registerId}/entries")]
    [Authorize]
    public async Task<ActionResult> GetRegisterEntries(string registerId, [FromQuery] int page = 1, [FromQuery] int limit = 20)
    {
        return await GetEntries(page, limit, registerId, null, null, null);
    }

    [HttpPost("{registerId}/entries")]
    [Authorize]
    public async Task<ActionResult> CreateEntry(string registerId, [FromBody] CreateRegisterEntryDto dto)
    {
        return await CreateEntryInternal(registerId, dto);
    }

    [HttpPatch("entries/{id}")]
    [HttpPut("entries/{id}")]
    [Authorize]
    public async Task<ActionResult> UpdateEntry(string id, [FromBody] UpdateRegisterEntryDto dto)
    {
        var entry = await _context.RegisterEntries
            .Include(e => e.Register)
            .Include(e => e.Docket)
            .FirstOrDefaultAsync(e => e.Id == id);
        if (entry == null) return NotFound(new { message = "Register entry not found" });

        if (dto.Subject != null)
        {
            var subject = dto.Subject.Trim();
            if (string.IsNullOrWhiteSpace(subject)) return BadRequest(new { message = "Subject is required" });
            entry.Subject = subject;
        }

        if (dto.EntryDate != null || dto.DateReceived.HasValue)
        {
            var parsed = dto.GetEntryDate();
            if (!parsed.HasValue) return BadRequest(new { message = "Invalid entry date" });
            entry.EntryDate = parsed.Value;
        }

        if (dto.FromParty != null || dto.SenderName != null) entry.FromParty = dto.GetFromParty();
        if (dto.ToParty != null || dto.RecipientName != null) entry.ToParty = dto.GetToParty();
        if (dto.Remarks != null) entry.Remarks = string.IsNullOrWhiteSpace(dto.Remarks) ? null : dto.Remarks.Trim();

        if (dto.DocketId != null)
        {
            if (string.IsNullOrWhiteSpace(dto.DocketId))
            {
                entry.DocketId = null;
            }
            else
            {
                var docketExists = await _context.Dockets.AnyAsync(d => d.Id == dto.DocketId);
                if (!docketExists) return BadRequest(new { message = "Docket not found" });
                entry.DocketId = dto.DocketId;
            }
        }

        await _context.SaveChangesAsync();
        await _context.Entry(entry).Reference(e => e.Docket).LoadAsync();
        return Ok(new { data = MapEntry(entry) });
    }

    [HttpDelete("entries/{id}")]
    [Authorize]
    public async Task<ActionResult> DeleteEntry(string id)
    {
        var entry = await _context.RegisterEntries.FindAsync(id);
        if (entry == null) return NotFound(new { message = "Register entry not found" });
        _context.RegisterEntries.Remove(entry);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Register entry deleted successfully" });
    }

    [HttpPost("entries/{entryId}/link-docket/{docketId}")]
    [Authorize]
    public async Task<ActionResult> LinkDocket(string entryId, string docketId)
    {
        var entry = await _context.RegisterEntries.FindAsync(entryId);
        if (entry == null) return NotFound(new { message = "Register entry not found" });
        var docketExists = await _context.Dockets.AnyAsync(d => d.Id == docketId);
        if (!docketExists) return NotFound(new { message = "Docket not found" });
        entry.DocketId = docketId;
        await _context.SaveChangesAsync();
        return Ok(new { message = "Docket linked successfully" });
    }

    [HttpDelete("entries/{entryId}/unlink-docket")]
    [Authorize]
    public async Task<ActionResult> UnlinkDocket(string entryId)
    {
        var entry = await _context.RegisterEntries.FindAsync(entryId);
        if (entry == null) return NotFound(new { message = "Register entry not found" });
        entry.DocketId = null;
        await _context.SaveChangesAsync();
        return Ok(new { message = "Docket unlinked successfully" });
    }

    [HttpGet("entries/export/excel")]
    [Authorize]
    public async Task<ActionResult> ExportEntriesExcel(
        [FromQuery] string? registerId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? fromDate = null,
        [FromQuery] string? toDate = null)
    {
        var rows = await BuildEntriesQuery(registerId, search, fromDate, toDate)
            .OrderByDescending(e => e.EntryDate)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Register Code,Entry Number,Entry Date,Subject,From Party,To Party,Remarks");
        foreach (var row in rows)
        {
            sb.AppendLine(string.Join(",",
                Csv(row.Register?.Code ?? string.Empty),
                Csv(row.EntryNumber),
                Csv(row.EntryDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                Csv(row.Subject),
                Csv(row.FromParty ?? string.Empty),
                Csv(row.ToParty ?? string.Empty),
                Csv(row.Remarks ?? string.Empty)));
        }

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"register-entries-{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    [HttpGet("entries/export/pdf")]
    [Authorize]
    public async Task<ActionResult> ExportEntriesPdf(
        [FromQuery] string? registerId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? fromDate = null,
        [FromQuery] string? toDate = null)
    {
        var rows = await BuildEntriesQuery(registerId, search, fromDate, toDate)
            .OrderByDescending(e => e.EntryDate)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Register Entries Report");
        sb.AppendLine($"Generated At: {DateTime.UtcNow:O}");
        sb.AppendLine(new string('-', 72));
        foreach (var row in rows)
        {
            sb.AppendLine($"[{row.EntryDate:yyyy-MM-dd}] {row.EntryNumber} | {row.Subject}");
            sb.AppendLine($"From: {row.FromParty ?? "-"} | To: {row.ToParty ?? "-"}");
            if (!string.IsNullOrWhiteSpace(row.Remarks)) sb.AppendLine($"Remarks: {row.Remarks}");
            sb.AppendLine(new string('-', 72));
        }

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/plain", $"register-entries-{DateTime.UtcNow:yyyyMMdd}.txt");
    }

    private async Task<ActionResult> CreateEntryInternal(string registerId, CreateRegisterEntryDto dto)
    {
        var register = await _context.Registers.FindAsync(registerId);
        if (register == null) return NotFound(new { message = "Register not found" });

        var subject = dto.Subject.Trim();
        if (string.IsNullOrWhiteSpace(subject)) return BadRequest(new { message = "Subject is required" });
        var entryDate = dto.GetEntryDate();
        if (!entryDate.HasValue) return BadRequest(new { message = "Entry date is required and must be valid" });

        var entryNumber = string.IsNullOrWhiteSpace(dto.EntryNumber)
            ? await ResolveNextEntryNumber(registerId)
            : dto.EntryNumber.Trim();

        var duplicate = await _context.RegisterEntries.AnyAsync(e => e.RegisterId == registerId && e.EntryNumber == entryNumber);
        if (duplicate) return BadRequest(new { message = "Entry number already exists for this register" });

        string? docketId = string.IsNullOrWhiteSpace(dto.DocketId) ? null : dto.DocketId;
        if (docketId != null)
        {
            var docketExists = await _context.Dockets.AnyAsync(d => d.Id == docketId);
            if (!docketExists) return BadRequest(new { message = "Docket not found" });
        }

        var entry = new RegisterEntry
        {
            RegisterId = registerId,
            EntryNumber = entryNumber,
            EntryDate = entryDate.Value,
            Subject = subject,
            FromParty = dto.GetFromParty(),
            ToParty = dto.GetToParty(),
            Remarks = string.IsNullOrWhiteSpace(dto.Remarks) ? null : dto.Remarks.Trim(),
            DocketId = docketId,
            CreatedBy = GetCurrentUserId()
        };

        _context.RegisterEntries.Add(entry);
        await _context.SaveChangesAsync();
        await _context.Entry(entry).Reference(e => e.Register).LoadAsync();
        await _context.Entry(entry).Reference(e => e.Docket).LoadAsync();

        return Created($"/api/v1/registers/entries/{entry.Id}", new { data = MapEntry(entry) });
    }

    private IQueryable<RegisterEntry> BuildEntriesQuery(string? registerId, string? search, string? fromDate, string? toDate)
    {
        var query = _context.RegisterEntries
            .Include(e => e.Register)
            .Include(e => e.Docket)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(registerId)) query = query.Where(e => e.RegisterId == registerId);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(e =>
                e.EntryNumber.Contains(term) ||
                e.Subject.Contains(term) ||
                (e.FromParty != null && e.FromParty.Contains(term)) ||
                (e.ToParty != null && e.ToParty.Contains(term)) ||
                (e.Remarks != null && e.Remarks.Contains(term)));
        }

        if (DateTime.TryParse(fromDate, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var from))
            query = query.Where(e => e.EntryDate >= from.Date);
        if (DateTime.TryParse(toDate, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var to))
            query = query.Where(e => e.EntryDate <= to.Date.AddDays(1).AddTicks(-1));

        return query;
    }

    private static object MapEntry(RegisterEntry e) => new
    {
        e.Id,
        e.RegisterId,
        register = e.Register != null ? new { e.Register.Id, e.Register.Name, registerCode = e.Register.Code } : null,
        entryNumber = e.EntryNumber,
        entryDate = e.EntryDate,
        e.DocketId,
        docket = e.Docket != null ? new { e.Docket.Id, e.Docket.DocketNumber, e.Docket.Subject, e.Docket.Status } : null,
        entryType = "general",
        e.Subject,
        fromParty = e.FromParty,
        toParty = e.ToParty,
        referenceNumber = (string?)null,
        dateReceived = e.EntryDate,
        dateSent = (DateTime?)null,
        e.Remarks,
        e.CreatedAt
    };

    private async Task<string> ResolveNextEntryNumber(string registerId)
    {
        var values = await _context.RegisterEntries
            .Where(e => e.RegisterId == registerId)
            .Select(e => e.EntryNumber)
            .ToListAsync();

        var max = 0;
        foreach (var value in values)
        {
            if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number) && number > max)
            {
                max = number;
            }
        }

        return (max + 1).ToString(CultureInfo.InvariantCulture);
    }

    private static string Csv(string value)
    {
        if (value.Contains('"') || value.Contains(',') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }
        return value;
    }

    private string GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userIdClaim)) throw new UnauthorizedAccessException("Invalid user token");
        return userIdClaim;
    }
}

public class CreateRegisterDto
{
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? RegisterCode { get; set; }
    public string? Description { get; set; }
    public string? DepartmentId { get; set; }
    public string? RegisterType { get; set; }
    public string? YearStart { get; set; }
    public string? YearEnd { get; set; }
    public DateTime? YearStartDate { get; set; }
    public DateTime? YearEndDate { get; set; }

    public string GetCode() => Code ?? RegisterCode ?? string.Empty;

    public DateTime? GetYearStart()
    {
        if (YearStartDate.HasValue) return YearStartDate.Value;
        if (DateTime.TryParse(YearStart, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)) return parsed;
        return null;
    }

    public DateTime? GetYearEnd()
    {
        if (YearEndDate.HasValue) return YearEndDate.Value;
        if (DateTime.TryParse(YearEnd, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)) return parsed;
        return null;
    }
}

public class UpdateRegisterDto
{
    public string? Name { get; set; }
    public string? Code { get; set; }
    public string? RegisterCode { get; set; }
    public string? Description { get; set; }
    public string? DepartmentId { get; set; }
    public string? RegisterType { get; set; }
    public string? YearStart { get; set; }
    public string? YearEnd { get; set; }
    public DateTime? YearStartDate { get; set; }
    public DateTime? YearEndDate { get; set; }
    public bool? IsActive { get; set; }

    public string? GetCode() => Code ?? RegisterCode;

    public DateTime? GetYearStart()
    {
        if (YearStartDate.HasValue) return YearStartDate.Value;
        if (DateTime.TryParse(YearStart, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)) return parsed;
        return null;
    }

    public DateTime? GetYearEnd()
    {
        if (YearEndDate.HasValue) return YearEndDate.Value;
        if (DateTime.TryParse(YearEnd, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)) return parsed;
        return null;
    }
}

public class CreateRegisterEntryDto
{
    public string? RegisterId { get; set; }
    public string? RegistrId { get; set; }
    public string? DocketId { get; set; }
    public string? EntryNumber { get; set; }
    public string? EntryDate { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string? SenderName { get; set; }
    public string? FromParty { get; set; }
    public string? RecipientName { get; set; }
    public string? ToParty { get; set; }
    public DateTime? DateReceived { get; set; }
    public string? Remarks { get; set; }

    public string? GetRegisterId() => RegisterId ?? RegistrId;
    public string? GetFromParty() => string.IsNullOrWhiteSpace(FromParty) ? SenderName : FromParty;
    public string? GetToParty() => string.IsNullOrWhiteSpace(ToParty) ? RecipientName : ToParty;

    public DateTime? GetEntryDate()
    {
        if (DateReceived.HasValue) return DateReceived.Value;
        if (DateTime.TryParse(EntryDate, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)) return parsed;
        return null;
    }
}

public class UpdateRegisterEntryDto
{
    public string? EntryDate { get; set; }
    public DateTime? DateReceived { get; set; }
    public string? Subject { get; set; }
    public string? SenderName { get; set; }
    public string? FromParty { get; set; }
    public string? RecipientName { get; set; }
    public string? ToParty { get; set; }
    public string? Remarks { get; set; }
    public string? DocketId { get; set; }

    public string? GetFromParty() => string.IsNullOrWhiteSpace(FromParty) ? SenderName : FromParty;
    public string? GetToParty() => string.IsNullOrWhiteSpace(ToParty) ? RecipientName : ToParty;

    public DateTime? GetEntryDate()
    {
        if (DateReceived.HasValue) return DateReceived.Value;
        if (DateTime.TryParse(EntryDate, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)) return parsed;
        return null;
    }
}
