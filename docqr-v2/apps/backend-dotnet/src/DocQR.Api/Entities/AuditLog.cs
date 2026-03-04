using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DocQR.Api.Entities;

[Table("audit_logs")]
public class AuditLog
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("user_id")]
    public string? UserId { get; set; }

    [Required]
    [Column("action")]
    [MaxLength(100)]
    public string Action { get; set; } = string.Empty;

    [Required]
    [Column("resource_type")]
    [MaxLength(100)]
    public string ResourceType { get; set; } = string.Empty;

    [Column("resource_id")]
    public string? ResourceId { get; set; }

    [Column("docket_id")]
    public string? DocketId { get; set; }

    [Column("attachment_id")]
    public string? AttachmentId { get; set; }

    [Column("workflow_instance_id")]
    public string? WorkflowInstanceId { get; set; }

    [Column("details", TypeName = "jsonb")]
    public string Details { get; set; } = "{}";

    [Column("old_values", TypeName = "jsonb")]
    public string? OldValues { get; set; }

    [Column("new_values", TypeName = "jsonb")]
    public string? NewValues { get; set; }

    [Column("ip_address")]
    [MaxLength(100)]
    public string? IpAddress { get; set; }

    [Column("user_agent")]
    public string? UserAgent { get; set; }

    [Column("request_path")]
    [MaxLength(500)]
    public string? RequestPath { get; set; }

    [Column("request_method")]
    [MaxLength(20)]
    public string? RequestMethod { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User? User { get; set; }
}
