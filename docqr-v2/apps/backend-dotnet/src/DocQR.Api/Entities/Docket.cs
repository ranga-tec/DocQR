using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DocQR.Api.Entities;

[Table("dockets")]
public class Docket
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    // Identification
    [Required]
    [Column("docket_number")]
    [MaxLength(50)]
    public string DocketNumber { get; set; } = string.Empty;

    [Required]
    [Column("qr_token")]
    [MaxLength(100)]
    public string QrToken { get; set; } = string.Empty;

    [Column("qr_code_path")]
    public string? QrCodePath { get; set; }

    [Column("qr_token_expires_at")]
    public DateTime? QrTokenExpiresAt { get; set; }

    [Column("qr_token_created_at")]
    public DateTime QrTokenCreatedAt { get; set; } = DateTime.UtcNow;

    // Sender Information
    [Column("sender_name")]
    [MaxLength(255)]
    public string? SenderName { get; set; }

    [Column("sender_organization")]
    [MaxLength(255)]
    public string? SenderOrganization { get; set; }

    [Column("sender_email")]
    [MaxLength(255)]
    public string? SenderEmail { get; set; }

    [Column("sender_phone")]
    [MaxLength(50)]
    public string? SenderPhone { get; set; }

    [Column("sender_address")]
    public string? SenderAddress { get; set; }

    [Column("received_date")]
    public DateTime? ReceivedDate { get; set; } = DateTime.UtcNow;

    // Classification
    [Column("docket_type_id")]
    public string? DocketTypeId { get; set; }

    [Required]
    [Column("subject")]
    [MaxLength(500)]
    public string Subject { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Column("priority")]
    [MaxLength(20)]
    public string Priority { get; set; } = "normal";

    [Column("confidentiality")]
    [MaxLength(20)]
    public string Confidentiality { get; set; } = "internal";

    // Workflow state
    [Column("status")]
    [MaxLength(50)]
    public string Status { get; set; } = "open";

    [Column("workflow_instance_id")]
    public string? WorkflowInstanceId { get; set; }

    [Column("current_assignee_id")]
    public string? CurrentAssigneeId { get; set; }

    [Column("current_department_id")]
    public string? CurrentDepartmentId { get; set; }

    // Physical register link
    [Column("register_entry_id")]
    public string? RegisterEntryId { get; set; }

    // SLA
    [Column("due_date")]
    public DateTime? DueDate { get; set; }

    [Column("sla_status")]
    [MaxLength(20)]
    public string SlaStatus { get; set; } = "on_track";

    // Metadata
    [Column("tags", TypeName = "jsonb")]
    public string Tags { get; set; } = "[]";

    [Column("custom_fields", TypeName = "jsonb")]
    public string CustomFields { get; set; } = "{}";

    // Audit
    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by")]
    public string? CreatedBy { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_by")]
    public string? UpdatedBy { get; set; }

    [Column("closed_at")]
    public DateTime? ClosedAt { get; set; }

    [Column("closed_by")]
    public string? ClosedBy { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    public DocketType? DocketType { get; set; }
    public User? Creator { get; set; }
    public User? Updater { get; set; }
    public User? Closer { get; set; }
    public User? CurrentAssignee { get; set; }
    public Department? CurrentDepartment { get; set; }
    public ICollection<DocketAttachment> Attachments { get; set; } = new List<DocketAttachment>();
    public ICollection<DocketComment> Comments { get; set; } = new List<DocketComment>();
    public ICollection<DocketAssignment> Assignments { get; set; } = new List<DocketAssignment>();
}

[Table("docket_types")]
public class DocketType
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [Column("name")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Column("code")]
    [MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Column("default_workflow_id")]
    public string? DefaultWorkflowId { get; set; }

    [Column("sla_days")]
    public int? SlaDays { get; set; }

    [Column("requires_approval")]
    public bool RequiresApproval { get; set; } = false;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Docket> Dockets { get; set; } = new List<Docket>();
}
