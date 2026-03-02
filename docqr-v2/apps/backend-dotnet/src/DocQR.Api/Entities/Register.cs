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
    [Column("register_code")]
    [MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Column("department_id")]
    public string? DepartmentId { get; set; }

    [Required]
    [Column("register_type")]
    [MaxLength(20)]
    public string RegisterType { get; set; } = "general";

    [Column("year_start")]
    public DateTime? YearStart { get; set; }

    [Column("year_end")]
    public DateTime? YearEnd { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by")]
    public string? CreatedBy { get; set; }

    [NotMapped]
    public string? Location { get; set; }

    [NotMapped]
    public DateTime UpdatedAt { get; set; }

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
    [MaxLength(50)]
    public string EntryNumber { get; set; } = string.Empty;

    [Column("entry_date")]
    public DateTime EntryDate { get; set; } = DateTime.UtcNow;

    [Column("docket_id")]
    public string? DocketId { get; set; }

    [Required]
    [Column("subject")]
    [MaxLength(255)]
    public string Subject { get; set; } = string.Empty;

    [Column("from_party")]
    [MaxLength(200)]
    public string? FromParty { get; set; }

    [Column("to_party")]
    [MaxLength(200)]
    public string? ToParty { get; set; }

    [Column("remarks")]
    public string? Remarks { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("created_by")]
    public string? CreatedBy { get; set; }

    [NotMapped]
    public string EntryType { get; set; } = "general";

    [NotMapped]
    public string? SenderName
    {
        get => FromParty;
        set => FromParty = value;
    }

    [NotMapped]
    public string? RecipientName
    {
        get => ToParty;
        set => ToParty = value;
    }

    [NotMapped]
    public string? ReferenceNumber { get; set; }

    [NotMapped]
    public DateTime? DateReceived
    {
        get => EntryDate;
        set
        {
            if (value.HasValue)
            {
                EntryDate = value.Value;
            }
        }
    }

    [NotMapped]
    public DateTime? DateSent { get; set; }

    // Navigation properties
    public Register Register { get; set; } = null!;
    public Docket? Docket { get; set; }
    public User? Creator { get; set; }
}
