using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using DocQR.Api.Data;
using DocQR.Api.DTOs;
using DocQR.Api.Entities;
using DocQR.Api.Services;

namespace DocQR.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuthService _authService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(AppDbContext context, IAuthService authService, ILogger<UsersController> logger)
    {
        _context = context;
        _authService = authService;
        _logger = logger;
    }

    [HttpGet]
    [Authorize]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<ActionResult> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        var query = _context.Users
            .Where(u => u.IsActive && u.DeletedAt == null);

        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(u =>
                u.Username.Contains(search) ||
                u.Email.Contains(search) ||
                (u.FirstName != null && u.FirstName.Contains(search)) ||
                (u.LastName != null && u.LastName.Contains(search)));
        }

        var total = await query.CountAsync();

        var usersRaw = await query
            .OrderBy(u => u.Username)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                id = u.Id,
                username = u.Username,
                firstName = u.FirstName,
                lastName = u.LastName
            })
            .ToListAsync();

        // Compute fullName in memory
        var users = usersRaw.Select(u => new
        {
            u.id,
            u.username,
            u.firstName,
            u.lastName,
            fullName = string.IsNullOrEmpty(u.firstName) && string.IsNullOrEmpty(u.lastName)
                ? null
                : $"{u.firstName} {u.lastName}".Trim()
        }).ToList();

        // Wrap in data property for frontend compatibility
        return Ok(new
        {
            data = new
            {
                data = users,
                total,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)total / pageSize)
            }
        });
    }

    [HttpGet("{id}")]
    [Authorize]
    [ProducesResponseType(typeof(UserDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserDetailDto>> GetUser(string id)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Include(u => u.UserDepartments)
                .ThenInclude(ud => ud.Department)
            .Where(u => u.Id == id && u.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        return Ok(new UserDetailDto
        {
            Id = user.Id,
            Email = user.Email,
            Username = user.Username,
            FirstName = user.FirstName,
            LastName = user.LastName,
            FullName = user.FullName,
            Phone = user.Phone,
            Avatar = user.Avatar,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            Roles = user.UserRoles.Select(ur => ur.Role.Name).ToList(),
            Departments = user.UserDepartments.Select(ud => new DepartmentInfoDto
            {
                Id = ud.Department.Id,
                Name = ud.Department.Name,
                Code = ud.Department.Code,
                IsPrimary = ud.IsPrimary
            }).ToList()
        });
    }

    [HttpPost]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        // Check for existing email
        var existingEmail = await _context.Users.AnyAsync(u => u.Email == dto.Email);
        if (existingEmail)
        {
            return BadRequest(new { message = "Email already in use" });
        }

        // Check for existing username
        var existingUsername = await _context.Users.AnyAsync(u => u.Username == dto.Username);
        if (existingUsername)
        {
            return BadRequest(new { message = "Username already in use" });
        }

        var user = new User
        {
            Email = dto.Email,
            Username = dto.Username,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Phone = dto.Phone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            IsActive = true
        };

        _context.Users.Add(user);

        // Assign roles if provided
        if (dto.RoleIds != null && dto.RoleIds.Any())
        {
            foreach (var roleId in dto.RoleIds)
            {
                _context.UserRoles.Add(new UserRole
                {
                    UserId = user.Id,
                    RoleId = roleId
                });
            }
        }

        // Assign departments if provided
        if (dto.DepartmentIds != null && dto.DepartmentIds.Any())
        {
            var isPrimary = true;
            foreach (var deptId in dto.DepartmentIds)
            {
                _context.UserDepartments.Add(new UserDepartment
                {
                    UserId = user.Id,
                    DepartmentId = deptId,
                    IsPrimary = isPrimary
                });
                isPrimary = false;
            }
        }

        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, new
        {
            data = new
            {
                user.Id,
                user.Email,
                user.Username,
                user.FirstName,
                user.LastName,
                FullName = user.FullName,
                user.Phone,
                user.IsActive,
                user.CreatedAt
            }
        });
    }

    [HttpPatch("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> UpdateUser(string id, [FromBody] UpdateUserDto dto)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null || user.DeletedAt != null)
        {
            return NotFound(new { message = "User not found" });
        }

        if (!string.IsNullOrEmpty(dto.Email) && dto.Email != user.Email)
        {
            var emailExists = await _context.Users.AnyAsync(u => u.Email == dto.Email && u.Id != id);
            if (emailExists)
            {
                return BadRequest(new { message = "Email already in use" });
            }
            user.Email = dto.Email;
        }

        if (!string.IsNullOrEmpty(dto.Username) && dto.Username != user.Username)
        {
            var usernameExists = await _context.Users.AnyAsync(u => u.Username == dto.Username && u.Id != id);
            if (usernameExists)
            {
                return BadRequest(new { message = "Username already in use" });
            }
            user.Username = dto.Username;
        }

        if (dto.FirstName != null) user.FirstName = dto.FirstName;
        if (dto.LastName != null) user.LastName = dto.LastName;
        if (dto.Phone != null) user.Phone = dto.Phone;
        if (dto.IsActive.HasValue) user.IsActive = dto.IsActive.Value;

        if (!string.IsNullOrEmpty(dto.Password))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            data = new
            {
                user.Id,
                user.Email,
                user.Username,
                user.FirstName,
                user.LastName,
                FullName = user.FullName,
                user.Phone,
                user.IsActive,
                user.UpdatedAt
            }
        });
    }

    [HttpDelete("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteUser(string id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null || user.DeletedAt != null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Soft delete
        user.IsActive = false;
        user.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { message = "User deleted successfully" });
    }

    [HttpPost("{id}/roles")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> AssignRoles(string id, [FromBody] AssignUserRolesDto dto)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null || user.DeletedAt != null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Remove existing roles
        var existingRoles = await _context.UserRoles.Where(ur => ur.UserId == id).ToListAsync();
        _context.UserRoles.RemoveRange(existingRoles);

        // Add new roles
        foreach (var roleId in dto.RoleIds)
        {
            _context.UserRoles.Add(new UserRole
            {
                UserId = id,
                RoleId = roleId
            });
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "Roles updated successfully" });
    }

    [HttpPost("{id}/departments")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> AssignDepartments(string id, [FromBody] AssignUserDepartmentsDto dto)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null || user.DeletedAt != null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Remove existing departments
        var existingDepts = await _context.UserDepartments.Where(ud => ud.UserId == id).ToListAsync();
        _context.UserDepartments.RemoveRange(existingDepts);

        // Add new departments
        var isPrimary = true;
        foreach (var deptId in dto.DepartmentIds)
        {
            _context.UserDepartments.Add(new UserDepartment
            {
                UserId = id,
                DepartmentId = deptId,
                IsPrimary = isPrimary
            });
            isPrimary = false;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "Departments updated successfully" });
    }
}

public class CreateUserDto
{
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public List<string>? RoleIds { get; set; }
    public List<string>? DepartmentIds { get; set; }
}

public class UpdateUserDto
{
    public string? Email { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public bool? IsActive { get; set; }
}

public class AssignUserRolesDto
{
    public List<string> RoleIds { get; set; } = new();
}

public class AssignUserDepartmentsDto
{
    public List<string> DepartmentIds { get; set; } = new();
}

public class UserListResponseDto
{
    public List<UserSummaryDto> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

public class UserDetailDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public string? Avatar { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<string> Roles { get; set; } = new();
    public List<DepartmentInfoDto> Departments { get; set; } = new();
}
