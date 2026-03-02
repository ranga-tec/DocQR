using System.ComponentModel.DataAnnotations;

namespace DocQR.Api.DTOs;

public class CreateDocketDto
{
    // Support both 'subject' (frontend) and 'title' (alternative)
    [Required]
    [StringLength(255, MinimumLength = 1)]
    public string Subject { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? DocketTypeId { get; set; }

    public string? Priority { get; set; } = "normal";

    public DateTime? DueDate { get; set; }

    // Sender information
    public string? SenderName { get; set; }
    public string? SenderOrganization { get; set; }
    public string? SenderEmail { get; set; }
    public string? SenderPhone { get; set; }
    public string? SenderAddress { get; set; }
    public DateTime? ReceivedDate { get; set; }

    // Assignment
    public string? AssignToUserId { get; set; }

    public Dictionary<string, object>? Metadata { get; set; }
}

public class UpdateDocketDto
{
    [StringLength(255, MinimumLength = 1)]
    public string? Title { get; set; }

    public string? Description { get; set; }

    public string? Priority { get; set; }

    public DateTime? DueDate { get; set; }

    public Dictionary<string, object>? Metadata { get; set; }
}

public class DocketResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string ReferenceNumber { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public DateTime? DueDate { get; set; }
    public string? QrToken { get; set; }
    public DateTime? QrTokenExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DocketTypeDto? DocketType { get; set; }
    public UserSummaryDto? Creator { get; set; }
    public UserSummaryDto? CurrentAssignee { get; set; }
    public int AttachmentCount { get; set; }
    public int CommentCount { get; set; }
}

public class DocketTypeDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Prefix { get; set; }
}

public class UserSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? FullName { get; set; }
}

public class ForwardDocketDto
{
    [Required]
    public string ToUserId { get; set; } = string.Empty;

    public string? Comments { get; set; }

    public string? Action { get; set; } = "forward";
}

public class DocketListResponseDto
{
    public List<DocketResponseDto> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

public class AttachmentDto
{
    public string Id { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string FileSize { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
    public string? IntegrityStatus { get; set; }
    public DateTime UploadedAt { get; set; }
    public UserSummaryDto? Uploader { get; set; }
}

public class CommentDto
{
    public string Id { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public bool IsInternal { get; set; }
    public DateTime CreatedAt { get; set; }
    public UserSummaryDto? Author { get; set; }
}

public class CreateCommentDto
{
    [Required]
    [StringLength(5000, MinimumLength = 1)]
    public string Content { get; set; } = string.Empty;

    public bool IsInternal { get; set; } = false;
}
