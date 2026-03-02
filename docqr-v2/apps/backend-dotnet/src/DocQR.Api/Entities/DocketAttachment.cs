using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DocQR.Api.Entities;

[Table("docket_attachments")]
public class DocketAttachment
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("docket_id")]
    public string DocketId { get; set; } = string.Empty;

    // File info
    [Required]
    [Column("file_name")]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [Required]
    [Column("original_file_name")]
    [MaxLength(255)]
    public string OriginalFileName { get; set; } = string.Empty;

    [Column("file_size")]
    public long FileSize { get; set; }

    [Required]
    [Column("mime_type")]
    [MaxLength(100)]
    public string MimeType { get; set; } = string.Empty;

    [Required]
    [Column("storage_bucket")]
    [MaxLength(100)]
    public string StorageBucket { get; set; } = string.Empty;

    [Required]
    [Column("storage_key")]
    [MaxLength(500)]
    public string StorageKey { get; set; } = string.Empty;

    // Metadata
    [Column("attachment_type")]
    [MaxLength(50)]
    public string AttachmentType { get; set; } = "document";

    [Column("description")]
    public string? Description { get; set; }

    [Column("version")]
    public int Version { get; set; } = 1;

    [Column("is_primary")]
    public bool IsPrimary { get; set; } = false;

    // OnlyOffice
    [Column("onlyoffice_key")]
    [MaxLength(100)]
    public string? OnlyofficeKey { get; set; }

    [Column("last_edited_at")]
    public DateTime? LastEditedAt { get; set; }

    [Column("last_edited_by")]
    public string? LastEditedBy { get; set; }

    // Signing
    [Column("is_signed")]
    public bool IsSigned { get; set; } = false;

    [Column("signing_status")]
    [MaxLength(50)]
    public string? SigningStatus { get; set; }

    [Column("signed_at")]
    public DateTime? SignedAt { get; set; }

    [Column("signed_by")]
    public string? SignedBy { get; set; }

    [Column("signature_data", TypeName = "jsonb")]
    public string? SignatureData { get; set; }

    // Tamper Detection / Integrity
    [Column("file_hash")]
    [MaxLength(128)]
    public string? FileHash { get; set; }

    [Column("hash_algorithm")]
    [MaxLength(20)]
    public string? HashAlgorithm { get; set; }

    [Column("hash_verified_at")]
    public DateTime? HashVerifiedAt { get; set; }

    [Column("integrity_status")]
    [MaxLength(20)]
    public string IntegrityStatus { get; set; } = "unverified";

    // Audit
    [Column("uploaded_at")]
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    [Column("uploaded_by")]
    public string? UploadedBy { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    public Docket Docket { get; set; } = null!;
    public User? Uploader { get; set; }
    public User? LastEditor { get; set; }
    public User? Signer { get; set; }
}

[Table("docket_comments")]
public class DocketComment
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("docket_id")]
    public string DocketId { get; set; } = string.Empty;

    [Column("comment_type")]
    [MaxLength(50)]
    public string CommentType { get; set; } = "note";

    [Required]
    [Column("content")]
    public string Content { get; set; } = string.Empty;

    [Column("attachment_id")]
    public string? AttachmentId { get; set; }

    [Column("is_internal")]
    public bool IsInternal { get; set; } = false;

    // Immutable - only created_at
    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by")]
    public string AuthorId { get; set; } = string.Empty;

    // Navigation properties
    public Docket Docket { get; set; } = null!;
    public DocketAttachment? Attachment { get; set; }
    public User Author { get; set; } = null!;
}

[Table("docket_assignments")]
public class DocketAssignment
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("docket_id")]
    public string DocketId { get; set; } = string.Empty;

    // Assignment targets
    [Column("assigned_to_user_id")]
    public string? AssignedTo { get; set; }

    [Column("assigned_to_department_id")]
    public string? AssignedToDepartmentId { get; set; }

    [Column("assigned_by_user_id")]
    public string AssignedFrom { get; set; } = string.Empty;

    // Chain position
    [Column("sequence_number")]
    public int SequenceNumber { get; set; }

    // Metadata
    [Column("assignment_type")]
    [MaxLength(50)]
    public string AssignmentType { get; set; } = "forward";

    [Column("instructions")]
    public string? Instructions { get; set; }

    [Column("expected_action")]
    [MaxLength(50)]
    public string? ExpectedAction { get; set; }

    [Column("due_date")]
    public DateTime? DueDate { get; set; }

    // Status
    [Column("status")]
    [MaxLength(20)]
    public string Status { get; set; } = "pending";

    // Timestamps
    [Column("assigned_at")]
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    [Column("accepted_at")]
    public DateTime? AcceptedAt { get; set; }

    [Column("completed_at")]
    public DateTime? CompletedAt { get; set; }

    // Response
    [Column("response_notes")]
    public string? Comments { get; set; }

    [Column("action_taken")]
    public string? Action { get; set; }

    // Navigation properties
    public Docket Docket { get; set; } = null!;
    public User? AssignedToUser { get; set; }
    public Department? AssignedToDepartment { get; set; }
    public User AssignedByUser { get; set; } = null!;
}
