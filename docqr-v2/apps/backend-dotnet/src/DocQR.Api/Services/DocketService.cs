using Microsoft.EntityFrameworkCore;
using DocQR.Api.Data;
using DocQR.Api.DTOs;
using DocQR.Api.Entities;

namespace DocQR.Api.Services;

public interface IDocketService
{
    Task<DocketListResponseDto> GetDocketsAsync(
        string userId,
        int page = 1,
        int pageSize = 20,
        string? status = null,
        string? search = null,
        bool assignedToMe = false,
        bool includeAll = false);
    Task<DocketResponseDto?> GetDocketByIdAsync(string id, string userId, bool includeAll = false);
    Task<DocketResponseDto?> GetDocketByQrTokenAsync(string qrToken);
    Task<DocketResponseDto> CreateDocketAsync(CreateDocketDto dto, string userId);
    Task<DocketResponseDto?> UpdateDocketAsync(string id, UpdateDocketDto dto, string userId);
    Task<bool> DeleteDocketAsync(string id, string userId);
    Task<DocketResponseDto?> ForwardDocketAsync(string id, ForwardDocketDto dto, string userId);
    Task<DocketResponseDto?> AcceptDocketAsync(string id, string userId, string? notes = null);
    Task<DocketResponseDto?> CloseDocketAsync(string id, string userId);
    Task<List<DocketHistoryDto>> GetHistoryAsync(string docketId, string userId, bool includeAll = false);
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
    private readonly INotificationDeliveryService _notificationDeliveryService;
    private readonly ILogger<DocketService> _logger;

    public DocketService(
        AppDbContext context,
        IStorageService storageService,
        IQrCodeService qrCodeService,
        INotificationDeliveryService notificationDeliveryService,
        ILogger<DocketService> logger)
    {
        _context = context;
        _storageService = storageService;
        _qrCodeService = qrCodeService;
        _notificationDeliveryService = notificationDeliveryService;
        _logger = logger;
    }

    public async Task<DocketListResponseDto> GetDocketsAsync(
        string userId,
        int page = 1,
        int pageSize = 20,
        string? status = null,
        string? search = null,
        bool assignedToMe = false,
        bool includeAll = false)
    {
        var query = _context.Dockets
            .Include(d => d.DocketType)
            .Include(d => d.Creator)
            .Include(d => d.CurrentDepartment)
            .Include(d => d.CurrentAssignee)
                .ThenInclude(user => user!.UserDepartments)
                    .ThenInclude(userDepartment => userDepartment.Department)
            .Where(d => d.DeletedAt == null);

        // Restrict visibility unless explicitly elevated.
        if (assignedToMe)
        {
            query = query.Where(d =>
                d.CurrentAssigneeId == userId ||
                d.Assignments.Any(a => a.AssignedTo == userId));
        }
        else if (!includeAll)
        {
            query = query.Where(d =>
                d.CreatedBy == userId ||
                d.CurrentAssigneeId == userId ||
                d.Assignments.Any(a => a.AssignedTo == userId));
        }

        // Filter by status
        if (!string.IsNullOrEmpty(status))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = query.Where(d => d.Status.ToLower() == normalizedStatus);
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

        var docketIds = dockets.Select(d => d.Id).ToList();
        var latestAssignments = await GetLatestAssignmentsAsync(docketIds);
        var counts = await GetDocketCountsAsync(docketIds);

        var items = dockets
            .Select(docket => MapToDto(
                docket,
                latestAssignments.GetValueOrDefault(docket.Id),
                counts.GetValueOrDefault(docket.Id)))
            .ToList();

        return new DocketListResponseDto
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling((double)total / pageSize)
        };
    }

    public async Task<DocketResponseDto?> GetDocketByIdAsync(string id, string userId, bool includeAll = false)
    {
        var query = _context.Dockets
            .Include(d => d.DocketType)
            .Include(d => d.Creator)
            .Include(d => d.CurrentDepartment)
            .Include(d => d.CurrentAssignee)
                .ThenInclude(user => user!.UserDepartments)
                    .ThenInclude(userDepartment => userDepartment.Department)
            .Where(d => d.Id == id && d.DeletedAt == null);

        if (!includeAll)
        {
            query = query.Where(d =>
                d.CreatedBy == userId ||
                d.CurrentAssigneeId == userId ||
                d.Assignments.Any(a => a.AssignedTo == userId));
        }

        var docket = await query.FirstOrDefaultAsync();
        if (docket == null)
        {
            return null;
        }

        var latestAssignment = await GetLatestAssignmentAsync(docket.Id);
        var counts = (await GetDocketCountsAsync([docket.Id])).GetValueOrDefault(docket.Id);

        return MapToDto(docket, latestAssignment, counts);
    }

    public async Task<DocketResponseDto?> GetDocketByQrTokenAsync(string qrToken)
    {
        var docket = await _context.Dockets
            .Include(d => d.DocketType)
            .Include(d => d.Creator)
            .Include(d => d.CurrentDepartment)
            .Include(d => d.CurrentAssignee)
                .ThenInclude(user => user!.UserDepartments)
                    .ThenInclude(userDepartment => userDepartment.Department)
            .FirstOrDefaultAsync(d =>
                d.QrToken == qrToken &&
                d.DeletedAt == null &&
                (d.QrTokenExpiresAt == null || d.QrTokenExpiresAt > DateTime.UtcNow));

        if (docket == null)
        {
            return null;
        }

        var latestAssignment = await GetLatestAssignmentAsync(docket.Id);
        var counts = (await GetDocketCountsAsync([docket.Id])).GetValueOrDefault(docket.Id);

        return MapToDto(docket, latestAssignment, counts);
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
        var assignedToAnotherUser = !string.IsNullOrEmpty(dto.AssignToUserId) && dto.AssignToUserId != userId;

        var docket = new Docket
        {
            Id = Guid.NewGuid().ToString(),
            DocketNumber = docketNumber,
            Subject = dto.Subject,
            Description = dto.Description,
            DocketTypeId = docketType?.Id,
            Status = assignedToAnotherUser ? "forwarded" : "open",
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
            CurrentDepartmentId = await ResolveDepartmentIdAsync(assigneeId, null),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Dockets.Add(docket);

        Notification? assignmentNotification = null;
        if (assignedToAnotherUser && !string.IsNullOrEmpty(assigneeId))
        {
            var initialAssignment = new DocketAssignment
            {
                Id = Guid.NewGuid().ToString(),
                DocketId = docket.Id,
                AssignedFrom = userId,
                AssignedTo = assigneeId,
                AssignmentType = "forward",
                Instructions = "Initial assignment",
                SequenceNumber = 1,
                Status = "pending",
                AssignedAt = DateTime.UtcNow
            };

            _context.DocketAssignments.Add(initialAssignment);

            assignmentNotification = new Notification
            {
                Id = Guid.NewGuid().ToString(),
                UserId = assigneeId,
                Title = $"New docket assigned: {docket.DocketNumber}",
                Message = $"Docket \"{docket.Subject}\" has been assigned to you.",
                ResourceType = "docket",
                ResourceId = docket.Id,
                ActionUrl = $"/dockets/{docket.Id}",
                Channels = "[\"in_app\"]",
                CreatedAt = DateTime.UtcNow
            };
            _context.Notifications.Add(assignmentNotification);
        }

        await _context.SaveChangesAsync();

        if (assignmentNotification != null)
        {
            await _notificationDeliveryService.DispatchAsync(assignmentNotification);
        }

        // Reload with related data
        await _context.Entry(docket).Reference(d => d.DocketType).LoadAsync();
        await _context.Entry(docket).Reference(d => d.Creator).LoadAsync();
        await _context.Entry(docket).Reference(d => d.CurrentAssignee).LoadAsync();
        if (docket.CurrentDepartmentId != null)
        {
            await _context.Entry(docket).Reference(d => d.CurrentDepartment).LoadAsync();
        }

        var latestAssignment = await GetLatestAssignmentAsync(docket.Id);
        var counts = (await GetDocketCountsAsync([docket.Id])).GetValueOrDefault(docket.Id);

        return MapToDto(docket, latestAssignment, counts);
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
        if (string.IsNullOrWhiteSpace(dto.ToUserId) && string.IsNullOrWhiteSpace(dto.ToDepartmentId))
        {
            throw new InvalidOperationException("Forward target is required.");
        }

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
            AssignedToDepartmentId = dto.ToDepartmentId,
            AssignmentType = dto.Action ?? "forward",
            Instructions = dto.Instructions,
            Comments = dto.Comments ?? dto.Instructions,
            SequenceNumber = lastSeq + 1,
            Status = "pending",
            AssignedAt = DateTime.UtcNow
        };

        _context.DocketAssignments.Add(assignment);

        Notification? forwardNotification = null;
        if (!string.IsNullOrEmpty(dto.ToUserId))
        {
            forwardNotification = new Notification
            {
                Id = Guid.NewGuid().ToString(),
                UserId = dto.ToUserId,
                Title = $"Docket forwarded: {docket.DocketNumber}",
                Message = $"Docket \"{docket.Subject}\" has been forwarded to you.",
                ResourceType = "docket",
                ResourceId = docket.Id,
                ActionUrl = $"/dockets/{docket.Id}",
                Channels = "[\"in_app\"]",
                CreatedAt = DateTime.UtcNow
            };

            _context.Notifications.Add(forwardNotification);
        }

        // Update docket
        docket.CurrentAssigneeId = dto.ToUserId;
        docket.CurrentDepartmentId = await ResolveDepartmentIdAsync(dto.ToUserId, dto.ToDepartmentId);
        docket.Status = "forwarded";
        docket.UpdatedAt = DateTime.UtcNow;
        docket.UpdatedBy = userId;

        await _context.SaveChangesAsync();

        if (forwardNotification != null)
        {
            await _notificationDeliveryService.DispatchAsync(forwardNotification);
        }

        await _context.Entry(docket).Reference(d => d.DocketType).LoadAsync();
        await _context.Entry(docket).Reference(d => d.Creator).LoadAsync();
        await _context.Entry(docket).Reference(d => d.CurrentAssignee).LoadAsync();
        if (docket.CurrentDepartmentId != null)
        {
            await _context.Entry(docket).Reference(d => d.CurrentDepartment).LoadAsync();
        }

        var latestAssignment = await GetLatestAssignmentAsync(docket.Id);
        var counts = (await GetDocketCountsAsync([docket.Id])).GetValueOrDefault(docket.Id);

        return MapToDto(docket, latestAssignment, counts);
    }

    public async Task<DocketResponseDto?> AcceptDocketAsync(string id, string userId, string? notes = null)
    {
        var docket = await _context.Dockets
            .FirstOrDefaultAsync(d => d.Id == id && d.DeletedAt == null);

        if (docket == null) return null;

        var hasAccess = docket.CreatedBy == userId ||
                        docket.CurrentAssigneeId == userId ||
                        await _context.DocketAssignments.AnyAsync(a => a.DocketId == id && a.AssignedTo == userId);

        if (!hasAccess) return null;

        // Mark the latest pending assignment for this user as accepted.
        var assignment = await _context.DocketAssignments
            .Where(a => a.DocketId == id && a.AssignedTo == userId && a.Status == "pending")
            .OrderByDescending(a => a.AssignedAt)
            .FirstOrDefaultAsync();

        if (assignment != null)
        {
            assignment.Status = "accepted";
            assignment.AcceptedAt = DateTime.UtcNow;
            assignment.Action = "accept";
            if (!string.IsNullOrWhiteSpace(notes))
            {
                assignment.Comments = notes;
            }
        }

        docket.Status = "in_review";
        docket.CurrentDepartmentId = await ResolveDepartmentIdAsync(userId, docket.CurrentDepartmentId);
        docket.UpdatedAt = DateTime.UtcNow;
        docket.UpdatedBy = userId;

        await _context.SaveChangesAsync();

        await _context.Entry(docket).Reference(d => d.DocketType).LoadAsync();
        await _context.Entry(docket).Reference(d => d.Creator).LoadAsync();
        await _context.Entry(docket).Reference(d => d.CurrentAssignee).LoadAsync();
        if (docket.CurrentDepartmentId != null)
        {
            await _context.Entry(docket).Reference(d => d.CurrentDepartment).LoadAsync();
        }

        var latestAssignment = await GetLatestAssignmentAsync(docket.Id);
        var counts = (await GetDocketCountsAsync([docket.Id])).GetValueOrDefault(docket.Id);

        return MapToDto(docket, latestAssignment, counts);
    }

    public async Task<DocketResponseDto?> CloseDocketAsync(string id, string userId)
    {
        var docket = await _context.Dockets
            .FirstOrDefaultAsync(d => d.Id == id && d.DeletedAt == null);

        if (docket == null) return null;

        if (!string.Equals(docket.Status, "closed", StringComparison.OrdinalIgnoreCase))
        {
            docket.Status = "closed";
            docket.ClosedAt = DateTime.UtcNow;
            docket.ClosedBy = userId;
            docket.UpdatedAt = DateTime.UtcNow;
            docket.UpdatedBy = userId;

            var activeAssignments = await _context.DocketAssignments
                .Where(a => a.DocketId == id && a.Status == "pending")
                .ToListAsync();

            foreach (var assignment in activeAssignments)
            {
                assignment.Status = "completed";
                assignment.CompletedAt = DateTime.UtcNow;
                assignment.Action = "close";
            }

            await _context.SaveChangesAsync();
        }

        await _context.Entry(docket).Reference(d => d.DocketType).LoadAsync();
        await _context.Entry(docket).Reference(d => d.Creator).LoadAsync();
        await _context.Entry(docket).Reference(d => d.CurrentAssignee).LoadAsync();
        if (docket.CurrentDepartmentId != null)
        {
            await _context.Entry(docket).Reference(d => d.CurrentDepartment).LoadAsync();
        }

        var latestAssignment = await GetLatestAssignmentAsync(docket.Id);
        var counts = (await GetDocketCountsAsync([docket.Id])).GetValueOrDefault(docket.Id);

        return MapToDto(docket, latestAssignment, counts);
    }

    public async Task<List<DocketHistoryDto>> GetHistoryAsync(string docketId, string userId, bool includeAll = false)
    {
        var docketQuery = _context.Dockets
            .Include(d => d.Creator)
            .Include(d => d.Closer)
            .Where(d => d.Id == docketId && d.DeletedAt == null);

        if (!includeAll)
        {
            docketQuery = docketQuery.Where(d =>
                d.CreatedBy == userId ||
                d.CurrentAssigneeId == userId ||
                d.Assignments.Any(a => a.AssignedTo == userId));
        }

        var docket = await docketQuery.FirstOrDefaultAsync();
        if (docket == null)
        {
            return [];
        }

        var assignments = await _context.DocketAssignments
            .Include(a => a.AssignedByUser)
            .Include(a => a.AssignedToDepartment)
            .Include(a => a.AssignedToUser)
            .Where(a => a.DocketId == docketId)
            .OrderBy(a => a.SequenceNumber)
            .ThenBy(a => a.AssignedAt)
            .ToListAsync();

        var history = new List<DocketHistoryDto>
        {
            new()
            {
                Id = $"{docket.Id}:created",
                Action = "created",
                Description = "Docket created",
                PerformedBy = BuildUserSummary(docket.Creator),
                Status = docket.Status,
                PerformedAt = docket.CreatedAt
            }
        };

        foreach (var assignment in assignments)
        {
            var assignedTo = BuildUserSummary(assignment.AssignedToUser);
            var assignedDepartment = BuildDepartmentSummary(assignment.AssignedToDepartment);
            var targetLabel = assignedTo?.FullName
                ?? assignedTo?.Username
                ?? assignedDepartment?.Name
                ?? "recipient";

            history.Add(new DocketHistoryDto
            {
                Id = $"{assignment.Id}:assigned",
                Action = string.IsNullOrWhiteSpace(assignment.AssignmentType)
                    ? "forwarded"
                    : assignment.AssignmentType,
                Description = $"Sent to {targetLabel}",
                PerformedBy = BuildUserSummary(assignment.AssignedByUser),
                AssignedTo = assignedTo,
                Department = assignedDepartment,
                Status = assignment.Status,
                Notes = !string.IsNullOrWhiteSpace(assignment.Instructions)
                    ? assignment.Instructions
                    : assignment.Comments,
                PerformedAt = assignment.AssignedAt
            });

            if (assignment.AcceptedAt.HasValue)
            {
                history.Add(new DocketHistoryDto
                {
                    Id = $"{assignment.Id}:accepted",
                    Action = "accepted",
                    Description = $"{targetLabel} accepted the docket",
                    PerformedBy = assignedTo,
                    AssignedTo = assignedTo,
                    Department = assignedDepartment,
                    Status = assignment.Status,
                    Notes = assignment.Comments,
                    PerformedAt = assignment.AcceptedAt.Value
                });
            }
        }

        if (docket.ClosedAt.HasValue)
        {
            history.Add(new DocketHistoryDto
            {
                Id = $"{docket.Id}:closed",
                Action = "closed",
                Description = "Docket closed",
                PerformedBy = BuildUserSummary(docket.Closer),
                Status = docket.Status,
                PerformedAt = docket.ClosedAt.Value
            });
        }

        return history
            .OrderByDescending(entry => entry.PerformedAt)
            .ToList();
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

    private DocketResponseDto MapToDto(
        Docket docket,
        DocketAssignment? latestAssignment = null,
        DocketAggregateCounts? counts = null)
    {
        var currentDepartment = ResolveCurrentDepartment(docket, latestAssignment);

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
            SenderName = docket.SenderName,
            SenderOrganization = docket.SenderOrganization,
            SenderEmail = docket.SenderEmail,
            SenderPhone = docket.SenderPhone,
            SenderAddress = docket.SenderAddress,
            ReceivedDate = docket.ReceivedDate,
            DocketType = docket.DocketType != null ? new DocketTypeDto
            {
                Id = docket.DocketType.Id.ToString(),
                Name = docket.DocketType.Name,
                Description = docket.DocketType.Description,
                Prefix = docket.DocketType.Code
            } : null,
            Creator = BuildUserSummary(docket.Creator),
            CurrentAssignee = BuildUserSummary(docket.CurrentAssignee),
            CurrentDepartment = BuildDepartmentSummary(currentDepartment),
            CurrentAssignment = BuildAssignmentSummary(latestAssignment),
            ProgressSummary = BuildProgressSummary(docket, latestAssignment),
            AttachmentCount = counts?.AttachmentCount ?? 0,
            CommentCount = counts?.CommentCount ?? 0
        };
    }

    private async Task<string?> ResolveDepartmentIdAsync(string? userId, string? departmentId)
    {
        if (!string.IsNullOrWhiteSpace(departmentId))
        {
            return departmentId;
        }

        if (string.IsNullOrWhiteSpace(userId))
        {
            return null;
        }

        return await _context.UserDepartments
            .Where(assignment => assignment.UserId == userId)
            .OrderByDescending(assignment => assignment.IsPrimary)
            .ThenBy(assignment => assignment.AssignedAt)
            .Select(assignment => assignment.DepartmentId)
            .FirstOrDefaultAsync();
    }

    private async Task<Dictionary<string, DocketAssignment>> GetLatestAssignmentsAsync(IReadOnlyCollection<string> docketIds)
    {
        if (docketIds.Count == 0)
        {
            return new Dictionary<string, DocketAssignment>();
        }

        var assignments = await _context.DocketAssignments
            .Include(a => a.AssignedByUser)
            .Include(a => a.AssignedToDepartment)
            .Include(a => a.AssignedToUser)
                .ThenInclude(user => user!.UserDepartments)
                    .ThenInclude(userDepartment => userDepartment.Department)
            .Where(a => docketIds.Contains(a.DocketId))
            .OrderByDescending(a => a.SequenceNumber)
            .ThenByDescending(a => a.AssignedAt)
            .ToListAsync();

        return assignments
            .GroupBy(assignment => assignment.DocketId)
            .ToDictionary(group => group.Key, group => group.First());
    }

    private async Task<DocketAssignment?> GetLatestAssignmentAsync(string docketId)
    {
        return (await GetLatestAssignmentsAsync([docketId])).GetValueOrDefault(docketId);
    }

    private async Task<Dictionary<string, DocketAggregateCounts>> GetDocketCountsAsync(IReadOnlyCollection<string> docketIds)
    {
        var result = docketIds.ToDictionary(id => id, _ => new DocketAggregateCounts());
        if (docketIds.Count == 0)
        {
            return result;
        }

        var attachmentCounts = await _context.DocketAttachments
            .Where(attachment => docketIds.Contains(attachment.DocketId) && attachment.DeletedAt == null)
            .GroupBy(attachment => attachment.DocketId)
            .Select(group => new { DocketId = group.Key, Count = group.Count() })
            .ToListAsync();

        foreach (var item in attachmentCounts)
        {
            result[item.DocketId].AttachmentCount = item.Count;
        }

        var commentCounts = await _context.DocketComments
            .Where(comment => docketIds.Contains(comment.DocketId))
            .GroupBy(comment => comment.DocketId)
            .Select(group => new { DocketId = group.Key, Count = group.Count() })
            .ToListAsync();

        foreach (var item in commentCounts)
        {
            result[item.DocketId].CommentCount = item.Count;
        }

        return result;
    }

    private static UserSummaryDto? BuildUserSummary(User? user)
    {
        return user == null
            ? null
            : new UserSummaryDto
            {
                Id = user.Id.ToString(),
                Username = user.Username,
                FullName = user.FullName
            };
    }

    private static DepartmentSummaryDto? BuildDepartmentSummary(Department? department)
    {
        return department == null
            ? null
            : new DepartmentSummaryDto
            {
                Id = department.Id.ToString(),
                Name = department.Name,
                Code = department.Code
            };
    }

    private static DocketAssignmentSummaryDto? BuildAssignmentSummary(DocketAssignment? assignment)
    {
        return assignment == null
            ? null
            : new DocketAssignmentSummaryDto
            {
                Id = assignment.Id,
                Status = assignment.Status,
                AssignmentType = assignment.AssignmentType,
                Instructions = assignment.Instructions,
                Comments = assignment.Comments,
                ExpectedAction = assignment.ExpectedAction,
                ActionTaken = assignment.Action,
                AssignedAt = assignment.AssignedAt,
                AcceptedAt = assignment.AcceptedAt,
                CompletedAt = assignment.CompletedAt,
                AssignedBy = BuildUserSummary(assignment.AssignedByUser),
                AssignedTo = BuildUserSummary(assignment.AssignedToUser),
                AssignedToDepartment = BuildDepartmentSummary(assignment.AssignedToDepartment)
            };
    }

    private static Department? ResolveCurrentDepartment(Docket docket, DocketAssignment? latestAssignment)
    {
        return docket.CurrentDepartment
            ?? latestAssignment?.AssignedToDepartment
            ?? GetPrimaryDepartment(latestAssignment?.AssignedToUser)
            ?? GetPrimaryDepartment(docket.CurrentAssignee);
    }

    private static Department? GetPrimaryDepartment(User? user)
    {
        return user?.UserDepartments
            .OrderByDescending(assignment => assignment.IsPrimary)
            .ThenBy(assignment => assignment.AssignedAt)
            .Select(assignment => assignment.Department)
            .FirstOrDefault();
    }

    private static string BuildProgressSummary(Docket docket, DocketAssignment? latestAssignment)
    {
        if (!string.IsNullOrWhiteSpace(latestAssignment?.ExpectedAction))
        {
            return $"Waiting for {HumanizeValue(latestAssignment.ExpectedAction!)}";
        }

        return docket.Status.ToLowerInvariant() switch
        {
            "pending_approval" => "Waiting for approval",
            "approved" => "Approved",
            "rejected" => "Rejected",
            "closed" => "Closed",
            "archived" => "Archived",
            "in_review" => "Under review",
            "forwarded" when latestAssignment?.AssignedToDepartment != null && latestAssignment.AssignedToUser == null => "Awaiting department review",
            "forwarded" => "Awaiting recipient review",
            "open" => "Open for processing",
            _ => HumanizeValue(docket.Status)
        };
    }

    private static string HumanizeValue(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "In progress";
        }

        var normalized = value.Trim().Replace("_", " ").ToLowerInvariant();
        return normalized.Length switch
        {
            0 => "In progress",
            1 => normalized.ToUpperInvariant(),
            _ => char.ToUpperInvariant(normalized[0]) + normalized[1..]
        };
    }

    private sealed class DocketAggregateCounts
    {
        public int AttachmentCount { get; set; }
        public int CommentCount { get; set; }
    }
}
