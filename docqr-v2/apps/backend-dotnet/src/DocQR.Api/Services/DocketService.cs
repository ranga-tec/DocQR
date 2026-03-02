using Microsoft.EntityFrameworkCore;
using DocQR.Api.Data;
using DocQR.Api.DTOs;
using DocQR.Api.Entities;

namespace DocQR.Api.Services;

public interface IDocketService
{
    Task<DocketListResponseDto> GetDocketsAsync(string userId, int page = 1, int pageSize = 20, string? status = null, string? search = null);
    Task<DocketResponseDto?> GetDocketByIdAsync(string id, string userId);
    Task<DocketResponseDto?> GetDocketByQrTokenAsync(string qrToken);
    Task<DocketResponseDto> CreateDocketAsync(CreateDocketDto dto, string userId);
    Task<DocketResponseDto?> UpdateDocketAsync(string id, UpdateDocketDto dto, string userId);
    Task<bool> DeleteDocketAsync(string id, string userId);
    Task<DocketResponseDto?> ForwardDocketAsync(string id, ForwardDocketDto dto, string userId);
    Task<string> GenerateQrTokenAsync(string docketId, int expirationHours = 24);
    Task<List<AttachmentDto>> GetAttachmentsAsync(string docketId);
    Task<AttachmentDto> AddAttachmentAsync(string docketId, byte[] fileData, string fileName, string mimeType, string userId);
    Task<bool> DeleteAttachmentAsync(string docketId, string attachmentId);
    Task<List<CommentDto>> GetCommentsAsync(string docketId);
    Task<CommentDto> AddCommentAsync(string docketId, CreateCommentDto dto, string userId);
}

public class DocketService : IDocketService
{
    private readonly AppDbContext _context;
    private readonly IStorageService _storageService;
    private readonly IQrCodeService _qrCodeService;
    private readonly ILogger<DocketService> _logger;

    public DocketService(
        AppDbContext context,
        IStorageService storageService,
        IQrCodeService qrCodeService,
        ILogger<DocketService> logger)
    {
        _context = context;
        _storageService = storageService;
        _qrCodeService = qrCodeService;
        _logger = logger;
    }

    public async Task<DocketListResponseDto> GetDocketsAsync(string userId, int page = 1, int pageSize = 20, string? status = null, string? search = null)
    {
        var query = _context.Dockets
            .Include(d => d.DocketType)
            .Include(d => d.Creator)
            .Include(d => d.CurrentAssignee)
            .Where(d => d.DeletedAt == null);

        // Filter by status
        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(d => d.Status == status);
        }

        // Search by subject or docket number
        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(d =>
                d.Subject.Contains(search) ||
                d.DocketNumber.Contains(search));
        }

        var total = await query.CountAsync();

        var dockets = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = dockets.Select(MapToDto).ToList();

        return new DocketListResponseDto
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling((double)total / pageSize)
        };
    }

    public async Task<DocketResponseDto?> GetDocketByIdAsync(string id, string userId)
    {
        var docket = await _context.Dockets
            .Include(d => d.DocketType)
            .Include(d => d.Creator)
            .Include(d => d.CurrentAssignee)
            .FirstOrDefaultAsync(d => d.Id == id && d.DeletedAt == null);

        return docket != null ? MapToDto(docket) : null;
    }

    public async Task<DocketResponseDto?> GetDocketByQrTokenAsync(string qrToken)
    {
        var docket = await _context.Dockets
            .Include(d => d.DocketType)
            .Include(d => d.Creator)
            .Include(d => d.CurrentAssignee)
            .FirstOrDefaultAsync(d =>
                d.QrToken == qrToken &&
                d.DeletedAt == null &&
                (d.QrTokenExpiresAt == null || d.QrTokenExpiresAt > DateTime.UtcNow));

        return docket != null ? MapToDto(docket) : null;
    }

    public async Task<DocketResponseDto> CreateDocketAsync(CreateDocketDto dto, string userId)
    {
        // Get docket type (optional)
        DocketType? docketType = null;
        string docketNumber;
        var year = DateTime.UtcNow.Year;

        if (!string.IsNullOrEmpty(dto.DocketTypeId))
        {
            docketType = await _context.DocketTypes
                .FirstOrDefaultAsync(t => t.Id == dto.DocketTypeId);
        }

        if (docketType != null)
        {
            // Generate docket number with type prefix
            var count = await _context.Dockets
                .CountAsync(d => d.DocketTypeId == docketType.Id && d.CreatedAt.Year == year);
            docketNumber = $"{docketType.Code}-{year}-{(count + 1):D5}";
        }
        else
        {
            // Generate generic docket number
            var count = await _context.Dockets
                .CountAsync(d => d.CreatedAt.Year == year);
            docketNumber = $"DOC-{year}-{(count + 1):D5}";
        }

        // Generate QR token
        var qrToken = _qrCodeService.GenerateSecureToken();

        // Determine assignee
        var assigneeId = !string.IsNullOrEmpty(dto.AssignToUserId) ? dto.AssignToUserId : userId;

        var docket = new Docket
        {
            Id = Guid.NewGuid().ToString(),
            DocketNumber = docketNumber,
            Subject = dto.Subject,
            Description = dto.Description,
            DocketTypeId = docketType?.Id,
            Status = "open",
            Priority = dto.Priority ?? "normal",
            DueDate = dto.DueDate,
            // Sender information
            SenderName = dto.SenderName,
            SenderOrganization = dto.SenderOrganization,
            SenderEmail = dto.SenderEmail,
            SenderPhone = dto.SenderPhone,
            SenderAddress = dto.SenderAddress,
            ReceivedDate = dto.ReceivedDate ?? DateTime.UtcNow,
            // QR
            QrToken = qrToken,
            QrTokenExpiresAt = DateTime.UtcNow.AddHours(24),
            QrTokenCreatedAt = DateTime.UtcNow,
            // Audit
            CreatedBy = userId,
            CurrentAssigneeId = assigneeId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Dockets.Add(docket);
        await _context.SaveChangesAsync();

        // Reload with related data
        await _context.Entry(docket).Reference(d => d.DocketType).LoadAsync();
        await _context.Entry(docket).Reference(d => d.Creator).LoadAsync();
        await _context.Entry(docket).Reference(d => d.CurrentAssignee).LoadAsync();

        return MapToDto(docket);
    }

    public async Task<DocketResponseDto?> UpdateDocketAsync(string id, UpdateDocketDto dto, string userId)
    {
        var docket = await _context.Dockets
            .FirstOrDefaultAsync(d => d.Id == id && d.DeletedAt == null);

        if (docket == null) return null;

        if (!string.IsNullOrEmpty(dto.Title))
            docket.Subject = dto.Title;

        if (dto.Description != null)
            docket.Description = dto.Description;

        if (!string.IsNullOrEmpty(dto.Priority))
            docket.Priority = dto.Priority;

        if (dto.DueDate.HasValue)
            docket.DueDate = dto.DueDate;

        docket.UpdatedAt = DateTime.UtcNow;
        docket.UpdatedBy = userId;

        await _context.SaveChangesAsync();

        await _context.Entry(docket).Reference(d => d.DocketType).LoadAsync();
        await _context.Entry(docket).Reference(d => d.Creator).LoadAsync();
        await _context.Entry(docket).Reference(d => d.CurrentAssignee).LoadAsync();

        return MapToDto(docket);
    }

    public async Task<bool> DeleteDocketAsync(string id, string userId)
    {
        var docket = await _context.Dockets
            .FirstOrDefaultAsync(d => d.Id == id && d.DeletedAt == null);

        if (docket == null) return false;

        docket.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<DocketResponseDto?> ForwardDocketAsync(string id, ForwardDocketDto dto, string userId)
    {
        var docket = await _context.Dockets
            .FirstOrDefaultAsync(d => d.Id == id && d.DeletedAt == null);

        if (docket == null) return null;

        // Get sequence number
        var lastSeq = await _context.DocketAssignments
            .Where(a => a.DocketId == docket.Id)
            .MaxAsync(a => (int?)a.SequenceNumber) ?? 0;

        // Create assignment record
        var assignment = new DocketAssignment
        {
            Id = Guid.NewGuid().ToString(),
            DocketId = docket.Id,
            AssignedFrom = userId,
            AssignedTo = dto.ToUserId,
            AssignmentType = dto.Action ?? "forward",
            Comments = dto.Comments,
            SequenceNumber = lastSeq + 1,
            AssignedAt = DateTime.UtcNow
        };

        _context.DocketAssignments.Add(assignment);

        // Update docket
        docket.CurrentAssigneeId = dto.ToUserId;
        docket.Status = "forwarded";
        docket.UpdatedAt = DateTime.UtcNow;
        docket.UpdatedBy = userId;

        await _context.SaveChangesAsync();

        await _context.Entry(docket).Reference(d => d.DocketType).LoadAsync();
        await _context.Entry(docket).Reference(d => d.Creator).LoadAsync();
        await _context.Entry(docket).Reference(d => d.CurrentAssignee).LoadAsync();

        return MapToDto(docket);
    }

    public async Task<string> GenerateQrTokenAsync(string docketId, int expirationHours = 24)
    {
        var docket = await _context.Dockets
            .FirstOrDefaultAsync(d => d.Id == docketId);

        if (docket == null)
            throw new InvalidOperationException("Docket not found");

        var token = _qrCodeService.GenerateSecureToken();
        docket.QrToken = token;
        docket.QrTokenExpiresAt = DateTime.UtcNow.AddHours(expirationHours);
        docket.QrTokenCreatedAt = DateTime.UtcNow;
        docket.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return token;
    }

    public async Task<List<AttachmentDto>> GetAttachmentsAsync(string docketId)
    {
        var attachments = await _context.DocketAttachments
            .Include(a => a.Uploader)
            .Where(a => a.DocketId == docketId && a.DeletedAt == null)
            .OrderByDescending(a => a.UploadedAt)
            .ToListAsync();

        return attachments.Select(a => new AttachmentDto
        {
            Id = a.Id.ToString(),
            FileName = a.FileName,
            OriginalFileName = a.OriginalFileName,
            FileSize = a.FileSize.ToString(),
            MimeType = a.MimeType,
            IsPrimary = a.IsPrimary,
            IntegrityStatus = a.IntegrityStatus,
            UploadedAt = a.UploadedAt,
            Uploader = a.Uploader != null ? new UserSummaryDto
            {
                Id = a.Uploader.Id.ToString(),
                Username = a.Uploader.Username,
                FullName = a.Uploader.FullName
            } : null
        }).ToList();
    }

    public async Task<AttachmentDto> AddAttachmentAsync(string docketId, byte[] fileData, string fileName, string mimeType, string userId)
    {
        var docket = await _context.Dockets.FirstOrDefaultAsync(d => d.Id == docketId);
        if (docket == null)
            throw new InvalidOperationException("Docket not found");

        // Generate storage key
        var ext = Path.GetExtension(fileName);
        var storageKey = $"{docketId}/{Guid.NewGuid()}{ext}";

        // Upload to storage
        var bucket = _storageService.GetDocumentsBucket();
        await _storageService.UploadFileAsync(bucket, storageKey, fileData, mimeType);

        // Compute hash
        var fileHash = _qrCodeService.ComputeHash(fileData, "SHA256");

        // Check if this is first attachment
        var isFirstAttachment = !await _context.DocketAttachments
            .AnyAsync(a => a.DocketId == docketId && a.DeletedAt == null);

        var attachment = new DocketAttachment
        {
            Id = Guid.NewGuid().ToString(),
            DocketId = docketId,
            FileName = storageKey,
            OriginalFileName = fileName,
            FileSize = fileData.Length,
            MimeType = mimeType,
            StorageBucket = bucket,
            StorageKey = storageKey,
            IsPrimary = isFirstAttachment,
            FileHash = fileHash,
            HashAlgorithm = "SHA256",
            IntegrityStatus = "valid",
            UploadedBy = userId,
            UploadedAt = DateTime.UtcNow
        };

        _context.DocketAttachments.Add(attachment);
        await _context.SaveChangesAsync();

        var uploader = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        return new AttachmentDto
        {
            Id = attachment.Id.ToString(),
            FileName = attachment.FileName,
            OriginalFileName = attachment.OriginalFileName,
            FileSize = attachment.FileSize.ToString(),
            MimeType = attachment.MimeType,
            IsPrimary = attachment.IsPrimary,
            IntegrityStatus = attachment.IntegrityStatus,
            UploadedAt = attachment.UploadedAt,
            Uploader = uploader != null ? new UserSummaryDto
            {
                Id = uploader.Id.ToString(),
                Username = uploader.Username,
                FullName = uploader.FullName
            } : null
        };
    }

    public async Task<bool> DeleteAttachmentAsync(string docketId, string attachmentId)
    {
        var attachment = await _context.DocketAttachments
            .FirstOrDefaultAsync(a =>
                a.Id == attachmentId &&
                a.DocketId == docketId &&
                a.DeletedAt == null);

        if (attachment == null) return false;

        attachment.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<List<CommentDto>> GetCommentsAsync(string docketId)
    {
        var comments = await _context.DocketComments
            .Include(c => c.Author)
            .Where(c => c.DocketId == docketId)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        return comments.Select(c => new CommentDto
        {
            Id = c.Id.ToString(),
            Content = c.Content,
            IsInternal = c.IsInternal,
            CreatedAt = c.CreatedAt,
            Author = c.Author != null ? new UserSummaryDto
            {
                Id = c.Author.Id.ToString(),
                Username = c.Author.Username,
                FullName = c.Author.FullName
            } : null
        }).ToList();
    }

    public async Task<CommentDto> AddCommentAsync(string docketId, CreateCommentDto dto, string userId)
    {
        var docket = await _context.Dockets.FirstOrDefaultAsync(d => d.Id == docketId);
        if (docket == null)
            throw new InvalidOperationException("Docket not found");

        var comment = new DocketComment
        {
            Id = Guid.NewGuid().ToString(),
            DocketId = docketId,
            AuthorId = userId,
            Content = dto.Content,
            IsInternal = dto.IsInternal,
            CreatedAt = DateTime.UtcNow
        };

        _context.DocketComments.Add(comment);
        await _context.SaveChangesAsync();

        var author = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        return new CommentDto
        {
            Id = comment.Id.ToString(),
            Content = comment.Content,
            IsInternal = comment.IsInternal,
            CreatedAt = comment.CreatedAt,
            Author = author != null ? new UserSummaryDto
            {
                Id = author.Id.ToString(),
                Username = author.Username,
                FullName = author.FullName
            } : null
        };
    }

    private DocketResponseDto MapToDto(Docket docket)
    {
        return new DocketResponseDto
        {
            Id = docket.Id.ToString(),
            ReferenceNumber = docket.DocketNumber,
            Title = docket.Subject,
            Description = docket.Description,
            Status = docket.Status,
            Priority = docket.Priority,
            DueDate = docket.DueDate,
            QrToken = docket.QrToken,
            QrTokenExpiresAt = docket.QrTokenExpiresAt,
            CreatedAt = docket.CreatedAt,
            UpdatedAt = docket.UpdatedAt,
            DocketType = docket.DocketType != null ? new DocketTypeDto
            {
                Id = docket.DocketType.Id.ToString(),
                Name = docket.DocketType.Name,
                Description = docket.DocketType.Description,
                Prefix = docket.DocketType.Code
            } : null,
            Creator = docket.Creator != null ? new UserSummaryDto
            {
                Id = docket.Creator.Id.ToString(),
                Username = docket.Creator.Username,
                FullName = docket.Creator.FullName
            } : null,
            CurrentAssignee = docket.CurrentAssignee != null ? new UserSummaryDto
            {
                Id = docket.CurrentAssignee.Id.ToString(),
                Username = docket.CurrentAssignee.Username,
                FullName = docket.CurrentAssignee.FullName
            } : null
        };
    }
}
