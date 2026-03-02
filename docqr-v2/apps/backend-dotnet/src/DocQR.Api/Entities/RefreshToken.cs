using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DocQR.Api.Entities;

[Table("refresh_tokens")]
public class RefreshToken
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [Column("token")]
    public string Token { get; set; } = string.Empty;

    [Column("user_id")]
    public string UserId { get; set; } = string.Empty;

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("revoked_at")]
    public DateTime? RevokedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User User { get; set; } = null!;
}

[Table("workflow_transitions")]
public class WorkflowTransition
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("workflow_instance_id")]
    public string WorkflowInstanceId { get; set; } = string.Empty;

    [Column("from_state")]
    [MaxLength(50)]
    public string? FromStatus { get; set; }

    [Required]
    [Column("to_state")]
    [MaxLength(50)]
    public string ToStatus { get; set; } = string.Empty;

    [Required]
    [Column("action")]
    [MaxLength(50)]
    public string Action { get; set; } = string.Empty;

    [Column("performed_by")]
    public string PerformedBy { get; set; } = string.Empty;

    [Column("performed_at")]
    public DateTime PerformedAt { get; set; } = DateTime.UtcNow;

    [Column("from_user_id")]
    public string? FromUserId { get; set; }

    [Column("to_user_id")]
    public string? ToUserId { get; set; }

    [Column("from_department_id")]
    public string? FromDepartmentId { get; set; }

    [Column("to_department_id")]
    public string? ToDepartmentId { get; set; }

    [Column("reason")]
    public string? Reason { get; set; }

    [Column("notes")]
    public string? Comments { get; set; }

    [Column("metadata", TypeName = "jsonb")]
    public string Metadata { get; set; } = "{}";

    // Navigation properties
    public User Performer { get; set; } = null!;
    public User? FromUser { get; set; }
    public User? ToUser { get; set; }
}

[Table("notifications")]
public class Notification
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("user_id")]
    public string UserId { get; set; } = string.Empty;

    [Column("template_id")]
    public string? TemplateId { get; set; }

    [Required]
    [Column("title")]
    [MaxLength(255)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [Column("message")]
    public string Message { get; set; } = string.Empty;

    [Column("resource_type")]
    [MaxLength(50)]
    public string? ResourceType { get; set; }

    [Column("resource_id")]
    public string? ResourceId { get; set; }

    [Column("action_url")]
    public string? ActionUrl { get; set; }

    [Column("channels", TypeName = "jsonb")]
    public string Channels { get; set; } = "[\"email\"]";

    [Column("email_status")]
    [MaxLength(20)]
    public string EmailStatus { get; set; } = "pending";

    [Column("email_sent_at")]
    public DateTime? EmailSentAt { get; set; }

    [Column("sms_status")]
    [MaxLength(20)]
    public string SmsStatus { get; set; } = "pending";

    [Column("sms_sent_at")]
    public DateTime? SmsSentAt { get; set; }

    [Column("push_status")]
    [MaxLength(20)]
    public string PushStatus { get; set; } = "pending";

    [Column("push_sent_at")]
    public DateTime? PushSentAt { get; set; }

    [Column("is_read")]
    public bool IsRead { get; set; } = false;

    [Column("read_at")]
    public DateTime? ReadAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User User { get; set; } = null!;
}
