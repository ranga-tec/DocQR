using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DocQR.Api.Data;
using DocQR.Api.Entities;

namespace DocQR.Api.Controllers;

[ApiController]
[Route("api/v1/departments")]
[Produces("application/json")]
public class DepartmentsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<DepartmentsController> _logger;

    public DepartmentsController(AppDbContext context, ILogger<DepartmentsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult> GetDepartments()
    {
        var departments = await _context.Departments
            .Where(d => d.IsActive)
            .OrderBy(d => d.Name)
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.Code,
                d.Description,
                d.ParentId,
                d.IsActive,
                d.CreatedAt,
                d.UpdatedAt,
                UserCount = d.UserDepartments.Count
            })
            .ToListAsync();

        return Ok(new { data = departments });
    }

    [HttpGet("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> GetDepartment(string id)
    {
        var department = await _context.Departments
            .Where(d => d.Id == id)
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.Code,
                d.Description,
                d.ParentId,
                d.IsActive,
                d.CreatedAt,
                d.UpdatedAt,
                Users = d.UserDepartments.Select(ud => new
                {
                    ud.User.Id,
                    ud.User.Username,
                    ud.User.Email,
                    FullName = ud.User.FirstName + " " + ud.User.LastName,
                    ud.IsPrimary
                })
            })
            .FirstOrDefaultAsync();

        if (department == null)
        {
            return NotFound(new { message = "Department not found" });
        }

        return Ok(new { data = department });
    }

    [HttpPost]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> CreateDepartment([FromBody] CreateDepartmentDto dto)
    {
        // Check for duplicate code
        var exists = await _context.Departments.AnyAsync(d => d.Code == dto.Code);
        if (exists)
        {
            return BadRequest(new { message = "Department with this code already exists" });
        }

        var department = new Department
        {
            Name = dto.Name,
            Code = dto.Code,
            Description = dto.Description,
            ParentId = dto.ParentId,
            IsActive = true
        };

        _context.Departments.Add(department);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetDepartment), new { id = department.Id }, new
        {
            data = new
            {
                department.Id,
                department.Name,
                department.Code,
                department.Description,
                department.ParentId,
                department.IsActive,
                department.CreatedAt
            }
        });
    }

    [HttpPatch("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> UpdateDepartment(string id, [FromBody] UpdateDepartmentDto dto)
    {
        var department = await _context.Departments.FindAsync(id);
        if (department == null)
        {
            return NotFound(new { message = "Department not found" });
        }

        if (!string.IsNullOrEmpty(dto.Name))
            department.Name = dto.Name;
        if (!string.IsNullOrEmpty(dto.Code))
            department.Code = dto.Code;
        if (dto.Description != null)
            department.Description = dto.Description;
        if (dto.ParentId != null)
            department.ParentId = dto.ParentId;
        if (dto.IsActive.HasValue)
            department.IsActive = dto.IsActive.Value;

        department.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            data = new
            {
                department.Id,
                department.Name,
                department.Code,
                department.Description,
                department.ParentId,
                department.IsActive,
                department.UpdatedAt
            }
        });
    }

    [HttpDelete("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteDepartment(string id)
    {
        var department = await _context.Departments.FindAsync(id);
        if (department == null)
        {
            return NotFound(new { message = "Department not found" });
        }

        // Soft delete by setting IsActive to false
        department.IsActive = false;
        department.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Department deactivated successfully" });
    }

    [HttpPost("{id}/users")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> AddUserToDepartment(string id, [FromBody] AddUserToDepartmentDto dto)
    {
        var department = await _context.Departments.FindAsync(id);
        if (department == null)
        {
            return NotFound(new { message = "Department not found" });
        }

        var user = await _context.Users.FindAsync(dto.UserId);
        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        var existing = await _context.UserDepartments
            .FirstOrDefaultAsync(ud => ud.UserId == dto.UserId && ud.DepartmentId == id);

        if (existing != null)
        {
            return BadRequest(new { message = "User is already in this department" });
        }

        var userDepartment = new UserDepartment
        {
            UserId = dto.UserId,
            DepartmentId = id,
            IsPrimary = dto.IsPrimary
        };

        _context.UserDepartments.Add(userDepartment);
        await _context.SaveChangesAsync();

        return Ok(new { message = "User added to department successfully" });
    }

    [HttpDelete("{id}/users/{userId}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> RemoveUserFromDepartment(string id, string userId)
    {
        var userDepartment = await _context.UserDepartments
            .FirstOrDefaultAsync(ud => ud.UserId == userId && ud.DepartmentId == id);

        if (userDepartment == null)
        {
            return NotFound(new { message = "User is not in this department" });
        }

        _context.UserDepartments.Remove(userDepartment);
        await _context.SaveChangesAsync();

        return Ok(new { message = "User removed from department successfully" });
    }
}

public class CreateDepartmentDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ParentId { get; set; }
}

public class UpdateDepartmentDto
{
    public string? Name { get; set; }
    public string? Code { get; set; }
    public string? Description { get; set; }
    public string? ParentId { get; set; }
    public bool? IsActive { get; set; }
}

public class AddUserToDepartmentDto
{
    public string UserId { get; set; } = string.Empty;
    public bool IsPrimary { get; set; } = false;
}
