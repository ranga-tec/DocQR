using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using DocQR.Api.Data;
using DocQR.Api.Entities;

namespace DocQR.Api.Controllers;

[ApiController]
[Route("api/v1/roles")]
[Produces("application/json")]
public class RolesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<RolesController> _logger;

    public RolesController(AppDbContext context, ILogger<RolesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult> GetRoles()
    {
        var roles = await _context.Roles
            .OrderBy(r => r.Name)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.DisplayName,
                r.Description,
                r.IsSystemRole,
                r.Permissions,
                r.CreatedAt,
                r.UpdatedAt,
                UserCount = r.UserRoles.Count
            })
            .ToListAsync();

        return Ok(new { data = roles });
    }

    [HttpGet("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> GetRole(string id)
    {
        var role = await _context.Roles
            .Where(r => r.Id == id)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.DisplayName,
                r.Description,
                r.IsSystemRole,
                r.Permissions,
                r.CreatedAt,
                r.UpdatedAt,
                Users = r.UserRoles.Select(ur => new
                {
                    ur.User.Id,
                    ur.User.Username,
                    ur.User.Email,
                    FullName = ur.User.FirstName + " " + ur.User.LastName
                })
            })
            .FirstOrDefaultAsync();

        if (role == null)
        {
            return NotFound(new { message = "Role not found" });
        }

        return Ok(new { data = role });
    }

    [HttpPost]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> CreateRole([FromBody] CreateRoleDto dto)
    {
        var normalizedName = dto.Name.Trim();

        var exists = await _context.Roles.AnyAsync(r => r.Name.ToLower() == normalizedName.ToLower());
        if (exists)
        {
            return BadRequest(new { message = "Role with this name already exists" });
        }

        if (!TryNormalizePermissions(dto.Permissions, out var permissionsJson, out var permissionsError))
        {
            return BadRequest(new { message = permissionsError });
        }

        var role = new Role
        {
            Name = normalizedName,
            DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName) ? normalizedName : dto.DisplayName.Trim(),
            Description = dto.Description,
            IsSystemRole = false,
            Permissions = permissionsJson
        };

        _context.Roles.Add(role);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRole), new { id = role.Id }, new
        {
            data = new
            {
                role.Id,
                role.Name,
                role.DisplayName,
                role.Description,
                role.IsSystemRole,
                role.Permissions,
                role.CreatedAt
            }
        });
    }

    [HttpPatch("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> UpdateRole(string id, [FromBody] UpdateRoleDto dto)
    {
        return await UpdateRoleInternal(id, dto);
    }

    [HttpPut("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> ReplaceRole(string id, [FromBody] UpdateRoleDto dto)
    {
        return await UpdateRoleInternal(id, dto);
    }

    private async Task<ActionResult> UpdateRoleInternal(string id, UpdateRoleDto dto)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null)
        {
            return NotFound(new { message = "Role not found" });
        }

        if (role.IsSystemRole)
        {
            return BadRequest(new { message = "Cannot modify system roles" });
        }

        if (!string.IsNullOrWhiteSpace(dto.Name))
        {
            var normalizedName = dto.Name.Trim();
            var duplicateName = await _context.Roles.AnyAsync(r => r.Id != id && r.Name.ToLower() == normalizedName.ToLower());
            if (duplicateName)
            {
                return BadRequest(new { message = "Role with this name already exists" });
            }

            role.Name = normalizedName;
        }

        if (!string.IsNullOrWhiteSpace(dto.DisplayName))
        {
            role.DisplayName = dto.DisplayName.Trim();
        }

        if (dto.Description != null)
        {
            role.Description = dto.Description;
        }

        if (dto.Permissions.HasValue)
        {
            if (!TryNormalizePermissions(dto.Permissions, out var permissionsJson, out var permissionsError))
            {
                return BadRequest(new { message = permissionsError });
            }

            role.Permissions = permissionsJson;
        }

        role.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            data = new
            {
                role.Id,
                role.Name,
                role.DisplayName,
                role.Description,
                role.IsSystemRole,
                role.Permissions,
                role.UpdatedAt
            }
        });
    }

    [HttpDelete("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> DeleteRole(string id)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null)
        {
            return NotFound(new { message = "Role not found" });
        }

        if (role.IsSystemRole)
        {
            return BadRequest(new { message = "Cannot delete system roles" });
        }

        // Check if any users have this role
        var hasUsers = await _context.UserRoles.AnyAsync(ur => ur.RoleId == id);
        if (hasUsers)
        {
            return BadRequest(new { message = "Cannot delete role that is assigned to users" });
        }

        _context.Roles.Remove(role);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Role deleted successfully" });
    }

    [HttpPost("{id}/users")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> AssignRoleToUser(string id, [FromBody] AssignRoleDto dto)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null)
        {
            return NotFound(new { message = "Role not found" });
        }

        var user = await _context.Users.FindAsync(dto.UserId);
        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        var existing = await _context.UserRoles
            .FirstOrDefaultAsync(ur => ur.UserId == dto.UserId && ur.RoleId == id);

        if (existing != null)
        {
            return BadRequest(new { message = "User already has this role" });
        }

        var userId = GetCurrentUserId();

        var userRole = new UserRole
        {
            UserId = dto.UserId,
            RoleId = id,
            AssignedBy = userId
        };

        _context.UserRoles.Add(userRole);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Role assigned to user successfully" });
    }

    [HttpDelete("{id}/users/{userId}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> RemoveRoleFromUser(string id, string userId)
    {
        var userRole = await _context.UserRoles
            .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == id);

        if (userRole == null)
        {
            return NotFound(new { message = "User does not have this role" });
        }

        _context.UserRoles.Remove(userRole);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Role removed from user successfully" });
    }

    [HttpGet("permissions")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult> GetPermissions()
    {
        var permissions = await _context.Permissions
            .OrderBy(p => p.ResourceType)
            .ThenBy(p => p.Code)
            .Select(p => new
            {
                p.Id,
                p.Code,
                p.Name,
                p.ResourceType
            })
            .ToListAsync();

        return Ok(new { data = permissions });
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

    private static bool TryNormalizePermissions(JsonElement? permissionsInput, out string permissionsJson, out string error)
    {
        permissionsJson = "[]";
        error = string.Empty;

        if (!permissionsInput.HasValue
            || permissionsInput.Value.ValueKind == JsonValueKind.Null
            || permissionsInput.Value.ValueKind == JsonValueKind.Undefined)
        {
            return true;
        }

        var permissions = new List<string>();

        if (permissionsInput.Value.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in permissionsInput.Value.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.String)
                {
                    error = "Permissions must be an array of strings.";
                    return false;
                }

                var permission = item.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(permission))
                {
                    permissions.Add(permission);
                }
            }

            permissionsJson = JsonSerializer.Serialize(permissions.Distinct(StringComparer.OrdinalIgnoreCase));
            return true;
        }

        if (permissionsInput.Value.ValueKind != JsonValueKind.String)
        {
            error = "Permissions must be either an array of strings or a JSON array string.";
            return false;
        }

        var rawPermissions = permissionsInput.Value.GetString();
        if (string.IsNullOrWhiteSpace(rawPermissions))
        {
            permissionsJson = "[]";
            return true;
        }

        try
        {
            using var document = JsonDocument.Parse(rawPermissions);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                error = "Permissions JSON must be an array of strings.";
                return false;
            }

            foreach (var item in document.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.String)
                {
                    error = "Permissions JSON must contain only string values.";
                    return false;
                }

                var permission = item.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(permission))
                {
                    permissions.Add(permission);
                }
            }

            permissionsJson = JsonSerializer.Serialize(permissions.Distinct(StringComparer.OrdinalIgnoreCase));
            return true;
        }
        catch (JsonException)
        {
            error = "Permissions string is not valid JSON.";
            return false;
        }
    }
}

public class CreateRoleDto
{
    [Required]
    [MinLength(1)]
    public string Name { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? Description { get; set; }
    public JsonElement? Permissions { get; set; }
}

public class UpdateRoleDto
{
    public string? Name { get; set; }
    public string? DisplayName { get; set; }
    public string? Description { get; set; }
    public JsonElement? Permissions { get; set; }
}

public class AssignRoleDto
{
    public string UserId { get; set; } = string.Empty;
}
