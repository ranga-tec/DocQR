using System.Security.Claims;
using System.Data;
using DocQR.Api.Data;
using DocQR.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace DocQR.Api.Controllers;

[ApiController]
[Route("api/v1/notifications")]
[Authorize]
[Produces("application/json")]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<NotificationsController> _logger;
    private static readonly SemaphoreSlim PreferencesTableEnsureLock = new(1, 1);
    private static volatile bool _preferencesTableEnsured;

    public NotificationsController(AppDbContext context, ILogger<NotificationsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<ActionResult> GetNotifications(
        [FromQuery] int limit = 20,
        [FromQuery] int offset = 0,
        [FromQuery] bool unreadOnly = false)
    {
        var userId = GetCurrentUserId();
        var query = _context.Notifications
            .Where(n => n.UserId == userId);

        if (unreadOnly)
        {
            query = query.Where(n => !n.IsRead);
        }

        var total = await query.CountAsync();
        var unreadCount = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .CountAsync();

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip(Math.Max(offset, 0))
            .Take(Math.Clamp(limit, 1, 100))
            .Select(n => new
            {
                id = n.Id,
                title = n.Title,
                message = n.Message,
                resourceType = n.ResourceType,
                resourceId = n.ResourceId,
                actionUrl = n.ActionUrl,
                isRead = n.IsRead,
                readAt = n.ReadAt,
                createdAt = n.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            data = items,
            total,
            unreadCount
        });
    }

    [HttpGet("unread-count")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<ActionResult> GetUnreadCount()
    {
        var userId = GetCurrentUserId();
        var count = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .CountAsync();

        return Ok(new { count });
    }

    [HttpPost("{id}/read")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> MarkAsRead(string id)
    {
        var userId = GetCurrentUserId();
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notification == null)
        {
            return NotFound(new { message = "Notification not found" });
        }

        notification.IsRead = true;
        notification.ReadAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { success = true });
    }

    [HttpPost("mark-all-read")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<ActionResult> MarkAllAsRead()
    {
        var userId = GetCurrentUserId();
        var unread = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var notification in unread)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
        }

        if (unread.Count > 0)
        {
            await _context.SaveChangesAsync();
        }

        return Ok(new { success = true });
    }

    [HttpGet("preferences")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<ActionResult> GetPreferences()
    {
        try
        {
            var userId = GetCurrentUserId();
            var preference = await GetOrCreatePreferencesAsync(userId);
            return Ok(MapPreference(preference));
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
        }
    }

    [HttpPut("preferences")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> UpdatePreferences([FromBody] UpdateNotificationPreferencesDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => new { u.Email, u.Phone })
                .FirstOrDefaultAsync();

            if (user == null)
            {
                return Unauthorized(new { message = "Invalid user token" });
            }

            var emailConfigured = IsEmailProviderConfigured();
            var smsConfigured = IsSmsProviderConfigured();

            if (dto.EmailEnabled.HasValue && dto.EmailEnabled.Value && !emailConfigured)
            {
                return BadRequest(new { message = "Email delivery is not configured by administrator." });
            }

            if (dto.SmsEnabled.HasValue && dto.SmsEnabled.Value)
            {
                if (!smsConfigured)
                {
                    return BadRequest(new { message = "SMS delivery is not configured by administrator." });
                }

                if (string.IsNullOrWhiteSpace(user.Phone))
                {
                    return BadRequest(new { message = "Add a phone number in Profile before enabling SMS notifications." });
                }
            }

            if (!string.IsNullOrWhiteSpace(dto.DeliveryMode) &&
                !string.Equals(dto.DeliveryMode, "immediate", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(dto.DeliveryMode, "digest", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Delivery mode must be either 'immediate' or 'digest'." });
            }

            if (!string.IsNullOrWhiteSpace(dto.DigestFrequency) &&
                !string.Equals(dto.DigestFrequency, "daily", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(dto.DigestFrequency, "weekly", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Digest frequency must be either 'daily' or 'weekly'." });
            }

            var preference = await GetOrCreatePreferencesAsync(userId);

            if (dto.EmailEnabled.HasValue) preference.EmailEnabled = dto.EmailEnabled.Value;
            if (dto.SmsEnabled.HasValue) preference.SmsEnabled = dto.SmsEnabled.Value;
            if (dto.InAppEnabled.HasValue) preference.InAppEnabled = dto.InAppEnabled.Value;
            if (dto.QuietHoursEnabled.HasValue) preference.QuietHoursEnabled = dto.QuietHoursEnabled.Value;
            if (dto.QuietHoursStart != null) preference.QuietHoursStart = dto.QuietHoursStart;
            if (dto.QuietHoursEnd != null) preference.QuietHoursEnd = dto.QuietHoursEnd;
            if (dto.TimeZone != null) preference.TimeZone = dto.TimeZone;
            if (!string.IsNullOrWhiteSpace(dto.DeliveryMode)) preference.DeliveryMode = dto.DeliveryMode.ToLowerInvariant();
            if (!string.IsNullOrWhiteSpace(dto.DigestFrequency)) preference.DigestFrequency = dto.DigestFrequency.ToLowerInvariant();

            preference.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(MapPreference(preference));
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
        }
    }

    [HttpGet("capabilities")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<ActionResult> GetCapabilities()
    {
        var userId = GetCurrentUserId();
        var user = await _context.Users
            .Where(u => u.Id == userId)
            .Select(u => new { u.Email, u.Phone })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return Unauthorized(new { message = "Invalid user token" });
        }

        return Ok(new
        {
            emailConfigured = IsEmailProviderConfigured(),
            smsConfigured = IsSmsProviderConfigured(),
            emailAddress = user.Email,
            phoneNumber = user.Phone
        });
    }

    [HttpPost("digest/send")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> SendDigest()
    {
        try
        {
            var userId = GetCurrentUserId();
            var preference = await GetOrCreatePreferencesAsync(userId);

            if (!IsEmailProviderConfigured())
            {
                return BadRequest(new { message = "Email provider is not configured. Configure SendGrid settings first." });
            }

            if (!preference.EmailEnabled)
            {
                return BadRequest(new { message = "Email notifications are disabled for your account." });
            }

            return Ok(new
            {
                success = false,
                message = "Digest dispatch is not enabled in this backend yet. In-app notifications are active."
            });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
        }
    }

    private async Task<UserNotificationPreference> GetOrCreatePreferencesAsync(string userId)
    {
        await EnsurePreferencesTableAsync();

        var preference = await _context.UserNotificationPreferences
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (preference != null)
        {
            return preference;
        }

        preference = new UserNotificationPreference
        {
            UserId = userId,
            EmailEnabled = true,
            SmsEnabled = false,
            InAppEnabled = true,
            QuietHoursEnabled = false,
            QuietHoursStart = "22:00",
            QuietHoursEnd = "07:00",
            TimeZone = "UTC",
            DeliveryMode = "immediate",
            DigestFrequency = "daily",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.UserNotificationPreferences.Add(preference);
        await _context.SaveChangesAsync();

        return preference;
    }

    private async Task EnsurePreferencesTableAsync()
    {
        if (_preferencesTableEnsured)
        {
            return;
        }

        await PreferencesTableEnsureLock.WaitAsync();
        try
        {
            if (_preferencesTableEnsured)
            {
                return;
            }

            var connection = _context.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync();
            }

            await using (var existsCmd = connection.CreateCommand())
            {
                existsCmd.CommandText = "SELECT to_regclass('public.user_notification_preferences') IS NOT NULL";
                var existsResult = await existsCmd.ExecuteScalarAsync();
                var exists = existsResult is bool b && b;
                if (exists)
                {
                    _preferencesTableEnsured = true;
                    return;
                }
            }

            var createSql = @"
CREATE TABLE IF NOT EXISTS ""user_notification_preferences"" (
    ""id"" TEXT NOT NULL,
    ""user_id"" TEXT NOT NULL,
    ""email_enabled"" BOOLEAN NOT NULL DEFAULT true,
    ""sms_enabled"" BOOLEAN NOT NULL DEFAULT false,
    ""in_app_enabled"" BOOLEAN NOT NULL DEFAULT true,
    ""quiet_hours_enabled"" BOOLEAN NOT NULL DEFAULT false,
    ""quiet_hours_start"" TEXT,
    ""quiet_hours_end"" TEXT,
    ""time_zone"" TEXT NOT NULL DEFAULT 'UTC',
    ""delivery_mode"" TEXT NOT NULL DEFAULT 'immediate',
    ""digest_frequency"" TEXT NOT NULL DEFAULT 'daily',
    ""updated_at"" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    ""created_at"" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ""user_notification_preferences_pkey"" PRIMARY KEY (""id"")
);
CREATE UNIQUE INDEX IF NOT EXISTS ""user_notification_preferences_user_id_key"" ON ""user_notification_preferences"" (""user_id"");
CREATE INDEX IF NOT EXISTS ""user_notification_preferences_delivery_mode_idx"" ON ""user_notification_preferences"" (""delivery_mode"");
CREATE INDEX IF NOT EXISTS ""user_notification_preferences_quiet_hours_enabled_idx"" ON ""user_notification_preferences"" (""quiet_hours_enabled"");
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_notification_preferences_user_id_fkey'
    ) THEN
        ALTER TABLE ""user_notification_preferences""
            ADD CONSTRAINT ""user_notification_preferences_user_id_fkey""
            FOREIGN KEY (""user_id"") REFERENCES ""users""(""id"")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
";

            await _context.Database.ExecuteSqlRawAsync(createSql);
            _preferencesTableEnsured = true;
            _logger.LogInformation("Ensured table user_notification_preferences exists.");
        }
        catch (PostgresException ex) when (ex.SqlState == "42501")
        {
            _logger.LogError(ex, "Insufficient permissions to create user_notification_preferences table.");
            throw new InvalidOperationException(
                "Database migration is required: missing table user_notification_preferences and the current DB user cannot create it.");
        }
        finally
        {
            PreferencesTableEnsureLock.Release();
        }
    }

    private static object MapPreference(UserNotificationPreference preference)
    {
        return new
        {
            emailEnabled = preference.EmailEnabled,
            smsEnabled = preference.SmsEnabled,
            inAppEnabled = preference.InAppEnabled,
            quietHoursEnabled = preference.QuietHoursEnabled,
            quietHoursStart = preference.QuietHoursStart,
            quietHoursEnd = preference.QuietHoursEnd,
            timeZone = preference.TimeZone,
            deliveryMode = preference.DeliveryMode,
            digestFrequency = preference.DigestFrequency,
            updatedAt = preference.UpdatedAt
        };
    }

    private static bool IsEmailProviderConfigured()
    {
        var sendGridApiKey = Environment.GetEnvironmentVariable("SENDGRID_API_KEY");
        var fromEmail = Environment.GetEnvironmentVariable("EMAIL_FROM")
            ?? Environment.GetEnvironmentVariable("SENDGRID_FROM_EMAIL");

        return !string.IsNullOrWhiteSpace(sendGridApiKey) &&
               !string.IsNullOrWhiteSpace(fromEmail);
    }

    private static bool IsSmsProviderConfigured()
    {
        var accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        var authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");
        var fromNumber = Environment.GetEnvironmentVariable("TWILIO_FROM_NUMBER");

        return !string.IsNullOrWhiteSpace(accountSid) &&
               !string.IsNullOrWhiteSpace(authToken) &&
               !string.IsNullOrWhiteSpace(fromNumber);
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

public class UpdateNotificationPreferencesDto
{
    public bool? EmailEnabled { get; set; }
    public bool? SmsEnabled { get; set; }
    public bool? InAppEnabled { get; set; }
    public bool? QuietHoursEnabled { get; set; }
    public string? QuietHoursStart { get; set; }
    public string? QuietHoursEnd { get; set; }
    public string? TimeZone { get; set; }
    public string? DeliveryMode { get; set; }
    public string? DigestFrequency { get; set; }
}
