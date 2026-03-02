using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DocQR.Api.Data;
using DocQR.Api.DTOs;

namespace DocQR.Api.Controllers;

[ApiController]
[Route("api/v1/docket-types")]
[Produces("application/json")]
public class DocketTypesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<DocketTypesController> _logger;

    public DocketTypesController(AppDbContext context, ILogger<DocketTypesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    [Authorize]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<ActionResult> GetDocketTypes()
    {
        var types = await _context.DocketTypes
            .Where(t => t.IsActive)
            .OrderBy(t => t.Name)
            .Select(t => new DocketTypeDto
            {
                Id = t.Id.ToString(),
                Name = t.Name,
                Description = t.Description,
                Prefix = t.Code
            })
            .ToListAsync();

        // Wrap in data property for frontend compatibility
        return Ok(new { data = types });
    }

    [HttpGet("{id}")]
    [Authorize]
    [ProducesResponseType(typeof(DocketTypeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DocketTypeDto>> GetDocketType(string id)
    {
        var type = await _context.DocketTypes
            .Where(t => t.Id == id && t.IsActive)
            .Select(t => new DocketTypeDto
            {
                Id = t.Id.ToString(),
                Name = t.Name,
                Description = t.Description,
                Prefix = t.Code
            })
            .FirstOrDefaultAsync();

        if (type == null)
        {
            return NotFound(new { message = "Docket type not found" });
        }

        return Ok(type);
    }

    [HttpPost]
    [Authorize]
    [ProducesResponseType(typeof(DocketTypeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DocketTypeDto>> CreateDocketType([FromBody] CreateDocketTypeDto dto)
    {
        // Check if code already exists
        if (await _context.DocketTypes.AnyAsync(t => t.Code == dto.Code))
        {
            return BadRequest(new { message = "Docket type code already exists" });
        }

        var docketType = new Entities.DocketType
        {
            Id = Guid.NewGuid().ToString(),
            Name = dto.Name,
            Code = dto.Code.ToUpper(),
            Description = dto.Description,
            SlaDays = dto.SlaDays,
            RequiresApproval = dto.RequiresApproval,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.DocketTypes.Add(docketType);
        await _context.SaveChangesAsync();

        var result = new DocketTypeDto
        {
            Id = docketType.Id,
            Name = docketType.Name,
            Description = docketType.Description,
            Prefix = docketType.Code
        };

        return CreatedAtAction(nameof(GetDocketType), new { id = docketType.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize]
    [ProducesResponseType(typeof(DocketTypeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DocketTypeDto>> UpdateDocketType(string id, [FromBody] UpdateDocketTypeDto dto)
    {
        var docketType = await _context.DocketTypes.FirstOrDefaultAsync(t => t.Id == id);

        if (docketType == null)
        {
            return NotFound(new { message = "Docket type not found" });
        }

        if (!string.IsNullOrEmpty(dto.Name))
            docketType.Name = dto.Name;

        if (!string.IsNullOrEmpty(dto.Description))
            docketType.Description = dto.Description;

        if (dto.SlaDays.HasValue)
            docketType.SlaDays = dto.SlaDays;

        if (dto.RequiresApproval.HasValue)
            docketType.RequiresApproval = dto.RequiresApproval.Value;

        if (dto.IsActive.HasValue)
            docketType.IsActive = dto.IsActive.Value;

        await _context.SaveChangesAsync();

        return Ok(new DocketTypeDto
        {
            Id = docketType.Id,
            Name = docketType.Name,
            Description = docketType.Description,
            Prefix = docketType.Code
        });
    }

    [HttpDelete("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteDocketType(string id)
    {
        var docketType = await _context.DocketTypes.FirstOrDefaultAsync(t => t.Id == id);

        if (docketType == null)
        {
            return NotFound(new { message = "Docket type not found" });
        }

        // Soft delete by deactivating
        docketType.IsActive = false;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Docket type deleted successfully" });
    }
}

public class CreateDocketTypeDto
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(20, MinimumLength = 1)]
    public string Code { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int? SlaDays { get; set; }

    public bool RequiresApproval { get; set; } = false;
}

public class UpdateDocketTypeDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int? SlaDays { get; set; }
    public bool? RequiresApproval { get; set; }
    public bool? IsActive { get; set; }
}
