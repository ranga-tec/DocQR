using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using DocQR.Api.Data;
using DocQR.Api.DTOs;
using DocQR.Api.Entities;

namespace DocQR.Api.Services;

public interface IAuthService
{
    Task<AuthResponseDto> RegisterAsync(RegisterDto dto);
    Task<AuthResponseDto> LoginAsync(LoginDto dto);
    Task<AuthResponseDto> RefreshTokenAsync(RefreshTokenDto dto);
    Task LogoutAsync(string refreshToken);
    Task LogoutAllAsync(string userId);
    Task ChangePasswordAsync(string userId, ChangePasswordDto dto);
    Task<UserProfileDto> GetProfileAsync(string userId);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(AppDbContext context, IConfiguration configuration, ILogger<AuthService> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
    {
        // Check if email exists
        if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
        {
            throw new InvalidOperationException("Email already registered");
        }

        // Check if username exists
        if (await _context.Users.AnyAsync(u => u.Username == dto.Username))
        {
            throw new InvalidOperationException("Username already taken");
        }

        // Create user
        var user = new User
        {
            Email = dto.Email,
            Username = dto.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Phone = dto.Phone
        };

        _context.Users.Add(user);

        // Assign default recipient role
        var recipientRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "recipient");
        if (recipientRole != null)
        {
            _context.UserRoles.Add(new UserRole
            {
                UserId = user.Id,
                RoleId = recipientRole.Id
            });
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("User registered: {Email}", user.Email);

        return await GenerateAuthResponseAsync(user);
    }

    public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Email == dto.Email);

        if (user == null)
        {
            throw new UnauthorizedAccessException("Invalid credentials");
        }

        if (!user.IsActive)
        {
            throw new UnauthorizedAccessException("Account is deactivated");
        }

        if (user.DeletedAt != null)
        {
            throw new UnauthorizedAccessException("Account has been deleted");
        }

        if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Invalid credentials");
        }

        // Update last login
        user.LastLoginAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("User logged in: {Email}", user.Email);
        return await GenerateAuthResponseAsync(user);
    }

    public async Task<AuthResponseDto> RefreshTokenAsync(RefreshTokenDto dto)
    {
        var storedToken = await _context.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Token == dto.RefreshToken);

        if (storedToken == null)
        {
            throw new UnauthorizedAccessException("Invalid refresh token");
        }

        if (storedToken.RevokedAt != null)
        {
            throw new UnauthorizedAccessException("Refresh token has been revoked");
        }

        if (storedToken.ExpiresAt < DateTime.UtcNow)
        {
            throw new UnauthorizedAccessException("Refresh token has expired");
        }

        // Revoke old token
        storedToken.RevokedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Generate new tokens
        return await GenerateAuthResponseAsync(storedToken.User);
    }

    public async Task LogoutAsync(string refreshToken)
    {
        var token = await _context.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == refreshToken);
        if (token != null)
        {
            token.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task LogoutAllAsync(string userId)
    {
        var tokens = await _context.RefreshTokens
            .Where(rt => rt.UserId == userId && rt.RevokedAt == null)
            .ToListAsync();

        foreach (var token in tokens)
        {
            token.RevokedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }

    public async Task ChangePasswordAsync(string userId, ChangePasswordDto dto)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new UnauthorizedAccessException("User not found");
        }

        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Current password is incorrect");
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await LogoutAllAsync(userId);

        _logger.LogInformation("Password changed for user: {Email}", user.Email);
    }

    public async Task<UserProfileDto> GetProfileAsync(string userId)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Include(u => u.UserDepartments)
                .ThenInclude(ud => ud.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            throw new UnauthorizedAccessException("User not found");
        }

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var permissions = ExtractPermissions(user.UserRoles);

        return new UserProfileDto
        {
            Id = user.Id,
            Email = user.Email,
            Username = user.Username,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Phone = user.Phone,
            Avatar = user.Avatar,
            IsActive = user.IsActive,
            LastLoginAt = user.LastLoginAt,
            CreatedAt = user.CreatedAt,
            Roles = roles,
            Permissions = permissions,
            Departments = user.UserDepartments.Select(ud => new DepartmentInfoDto
            {
                Id = ud.Department.Id,
                Name = ud.Department.Name,
                Code = ud.Department.Code,
                IsPrimary = ud.IsPrimary
            }).ToList()
        };
    }

    private async Task<AuthResponseDto> GenerateAuthResponseAsync(User user)
    {
        // Get user with roles
        var userWithRoles = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == user.Id);

        var roles = userWithRoles?.UserRoles.Select(ur => ur.Role.Name).ToList() ?? new List<string>();
        var permissions = ExtractPermissions(userWithRoles?.UserRoles ?? new List<UserRole>());

        // Generate access token
        var accessToken = GenerateAccessToken(user, roles, permissions);

        // Generate refresh token
        var refreshToken = Guid.NewGuid().ToString();
        var refreshExpiresIn = _configuration["Jwt:RefreshExpiresInDays"] ?? "7";
        var expiresAt = DateTime.UtcNow.AddDays(int.Parse(refreshExpiresIn));

        _context.RefreshTokens.Add(new RefreshToken
        {
            Token = refreshToken,
            UserId = user.Id,
            ExpiresAt = expiresAt
        });

        await _context.SaveChangesAsync();

        var expiresInHours = _configuration["Jwt:ExpiresInHours"] ?? "24";
        var expiresInSeconds = int.Parse(expiresInHours) * 3600;

        return new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn = expiresInSeconds,
            User = new UserInfoDto
            {
                Id = user.Id,
                Email = user.Email,
                Username = user.Username,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Roles = roles,
                Permissions = permissions
            }
        };
    }

    private string GenerateAccessToken(User user, List<string> roles, List<string> permissions)
    {
        var secret = _configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret not configured");
        var issuer = _configuration["Jwt:Issuer"] ?? "DocQR";
        var audience = _configuration["Jwt:Audience"] ?? "DocQR";
        var expiresInHours = _configuration["Jwt:ExpiresInHours"] ?? "24";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("username", user.Username),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // Add roles
        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        // Add permissions
        foreach (var permission in permissions)
        {
            claims.Add(new Claim("permission", permission));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(int.Parse(expiresInHours)),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static List<string> ExtractPermissions(ICollection<UserRole> userRoles)
    {
        var permissions = new HashSet<string>();

        foreach (var userRole in userRoles)
        {
            if (!string.IsNullOrEmpty(userRole.Role?.Permissions))
            {
                try
                {
                    var perms = System.Text.Json.JsonSerializer.Deserialize<List<string>>(userRole.Role.Permissions);
                    if (perms != null)
                    {
                        foreach (var permission in perms)
                        {
                            permissions.Add(permission);
                        }
                    }
                }
                catch
                {
                    // Ignore JSON parse errors
                }
            }
        }

        return permissions.ToList();
    }
}
