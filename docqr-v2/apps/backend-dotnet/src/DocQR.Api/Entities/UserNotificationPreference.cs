using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DocQR.Api.Entities;

[Table("user_notification_preferences")]
public class UserNotificationPreference
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("user_id")]
    public string UserId { get; set; } = string.Empty;

    [Column("email_enabled")]
    public bool EmailEnabled { get; set; } = true;

    [Column("sms_enabled")]
    public bool SmsEnabled { get; set; } = false;

    [Column("in_app_enabled")]
    public bool InAppEnabled { get; set; } = true;

    [Column("quiet_hours_enabled")]
    public bool QuietHoursEnabled { get; set; } = false;

    [Column("quiet_hours_start")]
    [MaxLength(10)]
    public string? QuietHoursStart { get; set; }

    [Column("quiet_hours_end")]
    [MaxLength(10)]
    public string? QuietHoursEnd { get; set; }

    [Column("time_zone")]
    [MaxLength(100)]
    public string TimeZone { get; set; } = "UTC";

    [Column("delivery_mode")]
    [MaxLength(20)]
    public string DeliveryMode { get; set; } = "immediate";

    [Column("digest_frequency")]
    [MaxLength(20)]
    public string DigestFrequency { get; set; } = "daily";

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
