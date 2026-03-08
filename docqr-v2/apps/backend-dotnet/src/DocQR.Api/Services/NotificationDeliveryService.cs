using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DocQR.Api.Data;
using DocQR.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace DocQR.Api.Services;

public interface INotificationDeliveryService
{
    Task DispatchAsync(Notification notification, CancellationToken cancellationToken = default);
}

public class NotificationDeliveryService : INotificationDeliveryService
{
    private readonly AppDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<NotificationDeliveryService> _logger;

    public NotificationDeliveryService(
        AppDbContext context,
        IHttpClientFactory httpClientFactory,
        ILogger<NotificationDeliveryService> logger)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task DispatchAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(notification.UserId))
            {
                return;
            }

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u =>
                    u.Id == notification.UserId &&
                    u.IsActive &&
                    u.DeletedAt == null,
                    cancellationToken);

            if (user == null)
            {
                return;
            }

            var preference = await _context.UserNotificationPreferences
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.UserId == notification.UserId, cancellationToken);

            var emailEnabled = preference?.EmailEnabled ?? true;
            var smsEnabled = preference?.SmsEnabled ?? false;
            var inAppEnabled = preference?.InAppEnabled ?? true;

            var channels = new List<string>();
            if (inAppEnabled)
            {
                channels.Add("in_app");
            }

            if (emailEnabled && IsEmailConfigured() && !string.IsNullOrWhiteSpace(user.Email))
            {
                var sent = await TrySendEmailAsync(
                    user.Email,
                    notification.Title,
                    notification.Message,
                    cancellationToken);

                notification.EmailStatus = sent ? "sent" : "failed";
                notification.EmailSentAt = sent ? DateTime.UtcNow : null;

                if (sent)
                {
                    channels.Add("email");
                }
            }
            else if (!emailEnabled)
            {
                notification.EmailStatus = "disabled";
            }

            if (smsEnabled && IsSmsConfigured() && !string.IsNullOrWhiteSpace(user.Phone))
            {
                var sent = await TrySendSmsAsync(
                    user.Phone!,
                    $"{notification.Title}: {notification.Message}",
                    cancellationToken);

                notification.SmsStatus = sent ? "sent" : "failed";
                notification.SmsSentAt = sent ? DateTime.UtcNow : null;

                if (sent)
                {
                    channels.Add("sms");
                }
            }
            else if (!smsEnabled)
            {
                notification.SmsStatus = "disabled";
            }

            notification.Channels = JsonSerializer.Serialize(channels.Distinct(StringComparer.OrdinalIgnoreCase));
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch notification {NotificationId}", notification.Id);
        }
    }

    private async Task<bool> TrySendEmailAsync(
        string toEmail,
        string subject,
        string message,
        CancellationToken cancellationToken)
    {
        var apiKey = Environment.GetEnvironmentVariable("SENDGRID_API_KEY");
        var fromEmail = Environment.GetEnvironmentVariable("EMAIL_FROM")
            ?? Environment.GetEnvironmentVariable("SENDGRID_FROM_EMAIL");

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(fromEmail))
        {
            return false;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.sendgrid.com/v3/mail/send");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var payload = new
            {
                personalizations = new[]
                {
                    new
                    {
                        to = new[]
                        {
                            new { email = toEmail }
                        }
                    }
                },
                from = new { email = fromEmail },
                subject,
                content = new[]
                {
                    new { type = "text/plain", value = message }
                }
            };

            request.Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json");

            using var response = await client.SendAsync(request, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Email delivery failed for {ToEmail}", toEmail);
            return false;
        }
    }

    private async Task<bool> TrySendSmsAsync(
        string toPhoneNumber,
        string message,
        CancellationToken cancellationToken)
    {
        var accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        var authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");
        var fromNumber = Environment.GetEnvironmentVariable("TWILIO_FROM_NUMBER");

        if (string.IsNullOrWhiteSpace(accountSid) ||
            string.IsNullOrWhiteSpace(authToken) ||
            string.IsNullOrWhiteSpace(fromNumber))
        {
            return false;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            var endpoint = $"https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json";

            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            var basicAuth = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{authToken}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", basicAuth);

            request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["To"] = toPhoneNumber,
                ["From"] = fromNumber,
                ["Body"] = message
            });

            using var response = await client.SendAsync(request, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SMS delivery failed for {ToPhone}", toPhoneNumber);
            return false;
        }
    }

    private static bool IsEmailConfigured()
    {
        var sendGridApiKey = Environment.GetEnvironmentVariable("SENDGRID_API_KEY");
        var fromEmail = Environment.GetEnvironmentVariable("EMAIL_FROM")
            ?? Environment.GetEnvironmentVariable("SENDGRID_FROM_EMAIL");

        return !string.IsNullOrWhiteSpace(sendGridApiKey) &&
               !string.IsNullOrWhiteSpace(fromEmail);
    }

    private static bool IsSmsConfigured()
    {
        var accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        var authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");
        var fromNumber = Environment.GetEnvironmentVariable("TWILIO_FROM_NUMBER");

        return !string.IsNullOrWhiteSpace(accountSid) &&
               !string.IsNullOrWhiteSpace(authToken) &&
               !string.IsNullOrWhiteSpace(fromNumber);
    }
}
