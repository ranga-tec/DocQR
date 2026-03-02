using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Security.Claims;
using DocQR.Api.Data;
using DocQR.Api.Entities;

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
    [ProducesResponseType(StatusCodes.Status200OK)]
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
            r.Location,
            registerType = "general",
            r.IsActive,
            r.CreatedAt,
            _count = new { entries = r.Entries.Count }
        }).ToList();

        return Ok(new { data = registers });
    }

    [HttpGet("stats")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult> GetStats()
    {
        var totalRegisters = await _context.Registers.CountAsync();
        var activeRegisters = await _context.Registers.CountAsync(r => r.IsActive);
        var totalEntries = await _context.RegisterEntries.CountAsync();
        var recentEntries = await _context.RegisterEntries
            .CountAsync(e => e.CreatedAt >= DateTime.UtcNow.AddDays(-7));
        var pendingEntries = await _context.RegisterEntries
            .CountAsync(e => e.DocketId == null);

        return Ok(new
        {
            data = new
            {
                totalRegisters,
                activeRegisters,
                totalEntries,
                recentEntries,
                pendingEntries,
                byType = new Dictionary<string, int>()
            }
        });
    }

    [HttpGet("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> GetRegister(string id)
    {
        var r = await _context.Registers
            .Where(r => r.Id == id)
            .Include(r => r.Department)
            .Include(r => r.Creator)
            .Include(r => r.Entries)
            .FirstOrDefaultAsync();

        if (r == null)
        {
            return NotFound(new { message = "Register not found" });
        }

        var register = new
        {
            r.Id,
            r.Name,
            registerCode = r.Code,
            r.Description,
            r.DepartmentId,
            department = r.Department != null ? new { r.Department.Id, r.Department.Name, r.Department.Code } : null,
            r.Location,
            registerType = "general",
            r.IsActive,
            r.CreatedAt,
            r.UpdatedAt,
            creator = r.Creator != null ? new { r.Creator.Id, r.Creator.Username, r.Creator.FirstName, r.Creator.LastName } : null,
            _count = new { entries = r.Entries.Count }
        };

        return Ok(new { data = register });
    }

    [HttpPost]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> CreateRegister([FromBody] CreateRegisterDto dto)
    {
        var code = dto.GetCode();
        var exists = await _context.Registers.AnyAsync(r => r.Code == code);
        if (exists)
        {
            return BadRequest(new { message = "Register with this code already exists" });
        }

        var userId = GetCurrentUserId();

        var register = new Register
        {
            Name = dto.Name,
            Code = code,
            Description = dto.Description,
            DepartmentId = dto.DepartmentId,
            Location = dto.Location,
            IsActive = true,
            CreatedBy = userId
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
                register.Location,
                registerType = dto.RegisterType ?? "general",
                register.IsActive,
                register.CreatedAt
            }
        });
    }

    [HttpPatch("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> UpdateRegister(string id, [FromBody] UpdateRegisterDto dto)
    {
        var register = await _context.Registers.FindAsync(id);
        if (register == null)
        {
            return NotFound(new { message = "Register not found" });
        }

        if (!string.IsNullOrEmpty(dto.Name))
            register.Name = dto.Name;
        if (!string.IsNullOrEmpty(dto.Code))
            register.Code = dto.Code;
        if (dto.Description != null)
            register.Description = dto.Description;
        if (dto.DepartmentId != null)
            register.DepartmentId = dto.DepartmentId;
        if (dto.Location != null)
            register.Location = dto.Location;
        if (dto.IsActive.HasValue)
            register.IsActive = dto.IsActive.Value;

        register.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { data = register });
    }

    [HttpDelete("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteRegister(string id)
    {
        var register = await _context.Registers.FindAsync(id);
        if (register == null)
        {
            return NotFound(new { message = "Register not found" });
        }

        register.IsActive = false;
        register.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Register deactivated successfully" });
    }

    // Register Entries
    [HttpGet("entries")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult> GetEntries(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        [FromQuery] string? registerId = null,
        [FromQuery] string? entryType = null)
    {
        var query = _context.RegisterEntries
            .Include(e => e.Register)
            .Include(e => e.Docket)
            .AsQueryable();

        if (!string.IsNullOrEmpty(registerId))
        {
            query = query.Where(e => e.RegisterId == registerId);
        }

        if (!string.IsNullOrEmpty(entryType))
        {
            query = query.Where(e => e.EntryType == entryType);
        }

        var total = await query.CountAsync();
        var entriesRaw = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        var entries = entriesRaw.Select(e => new
        {
            e.Id,
            e.RegisterId,
            register = new { e.Register.Id, e.Register.Name, registerCode = e.Register.Code },
            entryNumber = e.EntryNumber.ToString(),
            entryDate = e.DateReceived ?? e.CreatedAt,
            e.DocketId,
            docket = e.Docket != null ? new { e.Docket.Id, e.Docket.DocketNumber, e.Docket.Subject, e.Docket.Status } : null,
            e.EntryType,
            e.Subject,
            fromParty = e.SenderName,
            toParty = e.RecipientName,
            e.ReferenceNumber,
            e.DateReceived,
            e.DateSent,
            e.Remarks,
            e.CreatedAt
        }).ToList();

        return Ok(new
        {
            data = entries,
            meta = new
            {
                total,
                page,
                limit,
                totalPages = (int)Math.Ceiling((double)total / limit)
            }
        });
    }

    [HttpPost("entries")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> CreateEntryGlobal([FromBody] CreateRegisterEntryDto dto)
    {
        var registerId = dto.GetRegisterId();
        if (string.IsNullOrEmpty(registerId))
        {
            return BadRequest(new { message = "RegisterId is required" });
        }

        var register = await _context.Registers.FindAsync(registerId);
        if (register == null)
        {
            return NotFound(new { message = "Register not found" });
        }

        var userId = GetCurrentUserId();

        // Get the next entry number
        var lastEntry = await _context.RegisterEntries
            .Where(e => e.RegisterId == registerId)
            .OrderByDescending(e => e.EntryNumber)
            .FirstOrDefaultAsync();

        var entryNumber = (lastEntry?.EntryNumber ?? 0) + 1;

        var entry = new RegisterEntry
        {
            RegisterId = registerId,
            EntryNumber = entryNumber,
            DocketId = dto.DocketId,
            EntryType = dto.EntryType ?? "incoming",
            Subject = dto.Subject,
            SenderName = dto.GetSenderName(),
            RecipientName = dto.GetRecipientName(),
            ReferenceNumber = dto.ReferenceNumber,
            DateReceived = dto.GetDateReceived(),
            DateSent = dto.DateSent,
            Remarks = dto.Remarks,
            CreatedBy = userId
        };

        _context.RegisterEntries.Add(entry);
        await _context.SaveChangesAsync();

        return Created($"/api/v1/registers/{registerId}/entries", new
        {
            data = new
            {
                entry.Id,
                entry.RegisterId,
                entryNumber = entry.EntryNumber.ToString(),
                entryDate = entry.DateReceived ?? entry.CreatedAt,
                entry.DocketId,
                entry.EntryType,
                entry.Subject,
                fromParty = entry.SenderName,
                toParty = entry.RecipientName,
                entry.ReferenceNumber,
                entry.DateReceived,
                entry.DateSent,
                entry.Remarks,
                entry.CreatedAt
            }
        });
    }

    [HttpGet("{registerId}/entries")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult> GetRegisterEntries(
        string registerId,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20)
    {
        var register = await _context.Registers.FindAsync(registerId);
        if (register == null)
        {
            return NotFound(new { message = "Register not found" });
        }

        var query = _context.RegisterEntries
            .Where(e => e.RegisterId == registerId)
            .Include(e => e.Docket);

        var total = await query.CountAsync();
        var entriesRaw = await query
            .OrderByDescending(e => e.EntryNumber)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        var entries = entriesRaw.Select(e => new
        {
            e.Id,
            e.RegisterId,
            entryNumber = e.EntryNumber.ToString(),
            entryDate = e.DateReceived ?? e.CreatedAt,
            e.DocketId,
            docket = e.Docket != null ? new { e.Docket.Id, e.Docket.DocketNumber, e.Docket.Subject, e.Docket.Status } : null,
            e.EntryType,
            e.Subject,
            fromParty = e.SenderName,
            toParty = e.RecipientName,
            e.ReferenceNumber,
            e.DateReceived,
            e.DateSent,
            e.Remarks,
            e.CreatedAt
        }).ToList();

        return Ok(new
        {
            data = entries,
            meta = new { total, page, limit, totalPages = (int)Math.Ceiling((double)total / limit) }
        });
    }

    [HttpPost("{registerId}/entries")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> CreateEntry(string registerId, [FromBody] CreateRegisterEntryDto dto)
    {
        var register = await _context.Registers.FindAsync(registerId);
        if (register == null)
        {
            return NotFound(new { message = "Register not found" });
        }

        var userId = GetCurrentUserId();

        // Get the next entry number
        var lastEntry = await _context.RegisterEntries
            .Where(e => e.RegisterId == registerId)
            .OrderByDescending(e => e.EntryNumber)
            .FirstOrDefaultAsync();

        var entryNumber = (lastEntry?.EntryNumber ?? 0) + 1;

        var entry = new RegisterEntry
        {
            RegisterId = registerId,
            EntryNumber = entryNumber,
            DocketId = dto.DocketId,
            EntryType = dto.EntryType ?? "incoming",
            Subject = dto.Subject,
            SenderName = dto.GetSenderName(),
            RecipientName = dto.GetRecipientName(),
            ReferenceNumber = dto.ReferenceNumber,
            DateReceived = dto.GetDateReceived(),
            DateSent = dto.DateSent,
            Remarks = dto.Remarks,
            CreatedBy = userId
        };

        _context.RegisterEntries.Add(entry);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRegisterEntries), new { registerId }, new
        {
            data = new
            {
                entry.Id,
                entry.RegisterId,
                entryNumber = entry.EntryNumber.ToString(),
                entryDate = entry.DateReceived ?? entry.CreatedAt,
                entry.DocketId,
                entry.EntryType,
                entry.Subject,
                fromParty = entry.SenderName,
                toParty = entry.RecipientName,
                entry.ReferenceNumber,
                entry.DateReceived,
                entry.DateSent,
                entry.Remarks,
                entry.CreatedAt
            }
        });
    }

    private string GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(userIdClaim))
        {
            throw new UnauthorizedAccessException("Invalid user token");
        }

        return userIdClaim;
    }
}

public class CreateRegisterDto
{
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? RegisterCode { get; set; }  // Frontend sends this
    public string? Description { get; set; }
    public string? DepartmentId { get; set; }
    public string? Location { get; set; }
    public string? RegisterType { get; set; }  // Frontend sends this

    // Helper to get the actual code
    public string GetCode() => Code ?? RegisterCode ?? string.Empty;
}

public class UpdateRegisterDto
{
    public string? Name { get; set; }
    public string? Code { get; set; }
    public string? RegisterCode { get; set; }
    public string? Description { get; set; }
    public string? DepartmentId { get; set; }
    public string? Location { get; set; }
    public string? RegisterType { get; set; }
    public bool? IsActive { get; set; }
}

public class CreateRegisterEntryDto
{
    public string? RegisterId { get; set; }  // For global endpoint
    public string? RegistrId { get; set; }  // Alias with typo (legacy support)
    public string? DocketId { get; set; }
    public string? EntryType { get; set; }
    public string? EntryNumber { get; set; }  // Frontend sends as string
    public string? EntryDate { get; set; }  // Frontend sends ISO date string
    public string Subject { get; set; } = string.Empty;
    public string? SenderName { get; set; }
    public string? FromParty { get; set; }  // Frontend sends this
    public string? RecipientName { get; set; }
    public string? ToParty { get; set; }  // Frontend sends this
    public string? ReferenceNumber { get; set; }
    public DateTime? DateReceived { get; set; }
    public DateTime? DateSent { get; set; }
    public string? Remarks { get; set; }

    // Helpers
    public string? GetRegisterId() => RegisterId ?? RegistrId;
    public string GetSenderName() => SenderName ?? FromParty ?? string.Empty;
    public string GetRecipientName() => RecipientName ?? ToParty ?? string.Empty;
    public DateTime? GetDateReceived()
    {
        if (DateReceived.HasValue) return DateReceived;
        if (!string.IsNullOrEmpty(EntryDate) && DateTime.TryParse(EntryDate, out var parsed))
            return parsed;
        return null;
    }
}
