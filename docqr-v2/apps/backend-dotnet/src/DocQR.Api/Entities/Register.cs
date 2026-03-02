using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DocQR.Api.Entities;

[Table("physical_registers")]
public class Register
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

    [Column("department_id")]
    public string? DepartmentId { get; set; }

    [Column("location")]
    [MaxLength(200)]
    public string? Location { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by")]
    public string? CreatedBy { get; set; }

    // Navigation properties
    public Department? Department { get; set; }
    public User? Creator { get; set; }
    public ICollection<RegisterEntry> Entries { get; set; } = new List<RegisterEntry>();
}

[Table("register_entries")]
public class RegisterEntry
{
    [Key]
    [Column("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Column("register_id")]
    public string RegisterId { get; set; } = string.Empty;

    [Column("entry_number")]
    public int EntryNumber { get; set; }

    [Column("docket_id")]
    public string? DocketId { get; set; }

    [Column("entry_type")]
    [MaxLength(50)]
    public string EntryType { get; set; } = "incoming"; // incoming, outgoing, internal

    [Required]
    [Column("subject")]
    [MaxLength(255)]
    public string Subject { get; set; } = string.Empty;

    [Column("sender_name")]
    [MaxLength(200)]
    public string? SenderName { get; set; }

    [Column("recipient_name")]
    [MaxLength(200)]
    public string? RecipientName { get; set; }

    [Column("reference_number")]
    [MaxLength(100)]
    public string? ReferenceNumber { get; set; }

    [Column("date_received")]
    public DateTime? DateReceived { get; set; }

    [Column("date_sent")]
    public DateTime? DateSent { get; set; }

    [Column("remarks")]
    public string? Remarks { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by")]
    public string? CreatedBy { get; set; }

    // Navigation properties
    public Register Register { get; set; } = null!;
    public Docket? Docket { get; set; }
    public User? Creator { get; set; }
}
