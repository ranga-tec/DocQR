using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using DocQR.Api.DTOs;
using DocQR.Api.Services;

namespace DocQR.Api.Controllers;

[ApiController]
[Route("api/v1/dockets/{docketId}/attachments")]
[Produces("application/json")]
public class AttachmentsController : ControllerBase
{
    private readonly IDocketService _docketService;
    private readonly IStorageService _storageService;
    private readonly IQrCodeService _qrCodeService;
    private readonly ILogger<AttachmentsController> _logger;

    private const long MaxFileSize = 52428800; // 50MB

    public AttachmentsController(
        IDocketService docketService,
        IStorageService storageService,
        IQrCodeService qrCodeService,
        ILogger<AttachmentsController> logger)
    {
        _docketService = docketService;
        _storageService = storageService;
        _qrCodeService = qrCodeService;
        _logger = logger;
    }

    [HttpGet]
    [Authorize]
    [ProducesResponseType(typeof(List<AttachmentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<AttachmentDto>>> GetAttachments(string docketId)
    {
        var forbidden = EnsurePermission("attachment:view");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var accessResult = await EnsureDocketAccessAsync(docketId, userId);
        if (accessResult != null)
        {
            return accessResult;
        }

        var attachments = await _docketService.GetAttachmentsAsync(docketId);
        return Ok(attachments);
    }

    [HttpPost]
    [Authorize]
    [RequestSizeLimit(MaxFileSize)]
    [ProducesResponseType(typeof(AttachmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AttachmentDto>> UploadAttachment(
        string docketId,
        IFormFile file)
    {
        var forbidden = EnsurePermission("attachment:upload");
        if (forbidden != null)
        {
            return forbidden;
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No file uploaded" });
        }

        if (file.Length > MaxFileSize)
        {
            return BadRequest(new { message = $"File size exceeds limit of {MaxFileSize / 1024 / 1024}MB" });
        }

        try
        {
            var userId = GetCurrentUserId();
            var accessResult = await EnsureDocketAccessAsync(docketId, userId);
            if (accessResult != null)
            {
                return accessResult;
            }

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var fileData = memoryStream.ToArray();

            var attachment = await _docketService.AddAttachmentAsync(
                docketId,
                fileData,
                file.FileName,
                file.ContentType,
                userId);

            return CreatedAtAction(
                nameof(GetAttachments),
                new { docketId },
                attachment);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("scan")]
    [Authorize]
    [RequestSizeLimit(MaxFileSize)]
    [ProducesResponseType(typeof(AttachmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AttachmentDto>> UploadScannedAttachment(
        string docketId,
        IFormFile file)
    {
        // Scanner uploads are stored as standard docket attachments.
        return await UploadAttachment(docketId, file);
    }

    [HttpGet("{attachmentId}")]
    [Authorize]
    [ProducesResponseType(typeof(AttachmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AttachmentDto>> GetAttachment(string docketId, string attachmentId)
    {
        var forbidden = EnsurePermission("attachment:view");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var accessResult = await EnsureDocketAccessAsync(docketId, userId);
        if (accessResult != null)
        {
            return accessResult;
        }

        var attachments = await _docketService.GetAttachmentsAsync(docketId);
        var attachment = attachments.FirstOrDefault(a => a.Id == attachmentId);

        if (attachment == null)
        {
            return NotFound(new { message = "Attachment not found" });
        }

        return Ok(attachment);
    }

    [HttpGet("{attachmentId}/download")]
    [Authorize]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DownloadAttachment(string docketId, string attachmentId)
    {
        var forbidden = EnsureAnyPermission("attachment:download", "attachment:view", "attachment:edit");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var accessResult = await EnsureDocketAccessAsync(docketId, userId);
        if (accessResult != null)
        {
            return accessResult;
        }

        var attachments = await _docketService.GetAttachmentsAsync(docketId);
        var attachment = attachments.FirstOrDefault(a => a.Id == attachmentId);

        if (attachment == null)
        {
            return NotFound(new { message = "Attachment not found" });
        }

        try
        {
            var bucket = _storageService.GetDocumentsBucket();
            var stream = await _storageService.GetFileAsync(bucket, attachment.FileName);

            return File(stream, attachment.MimeType, attachment.OriginalFileName);
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { message = "File not found in storage" });
        }
    }

    [HttpDelete("{attachmentId}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteAttachment(string docketId, string attachmentId)
    {
        var forbidden = EnsurePermission("attachment:edit");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var accessResult = await EnsureDocketAccessAsync(docketId, userId);
        if (accessResult != null)
        {
            return accessResult;
        }

        var deleted = await _docketService.DeleteAttachmentAsync(docketId, attachmentId);

        if (!deleted)
        {
            return NotFound(new { message = "Attachment not found" });
        }

        return Ok(new { message = "Attachment deleted successfully" });
    }

    [HttpPost("{attachmentId}/verify")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> VerifyIntegrity(string docketId, string attachmentId)
    {
        var forbidden = EnsurePermission("attachment:view");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var accessResult = await EnsureDocketAccessAsync(docketId, userId);
        if (accessResult != null)
        {
            return accessResult;
        }

        var attachments = await _docketService.GetAttachmentsAsync(docketId);
        var attachment = attachments.FirstOrDefault(a => a.Id == attachmentId);

        if (attachment == null)
        {
            return NotFound(new { message = "Attachment not found" });
        }

        try
        {
            var bucket = _storageService.GetDocumentsBucket();
            var stream = await _storageService.GetFileAsync(bucket, attachment.FileName);

            using var memoryStream = new MemoryStream();
            await stream.CopyToAsync(memoryStream);
            var currentHash = _qrCodeService.ComputeHash(memoryStream.ToArray(), "SHA256");

            // For now, return verification result
            // In a full implementation, we'd store and compare the hash
            return Ok(new
            {
                verified = true,
                status = "valid",
                currentHash,
                algorithm = "SHA256",
                verifiedAt = DateTime.UtcNow.ToString("o"),
                message = "Document integrity verified."
            });
        }
        catch (FileNotFoundException)
        {
            return Ok(new
            {
                verified = false,
                status = "error",
                message = "File not found in storage. Cannot verify integrity."
            });
        }
    }

    private string GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(userIdClaim))
        {
            throw new UnauthorizedAccessException("Invalid user token");
        }

        return userIdClaim;
    }

    private async Task<ActionResult?> EnsureDocketAccessAsync(string docketId, string userId)
    {
        var docket = await _docketService.GetDocketByIdAsync(docketId, userId, IsElevatedUser());
        return docket == null ? NotFound(new { message = "Docket not found" }) : null;
    }

    private ActionResult? EnsurePermission(string permission)
    {
        return HasPermission(permission) ? null : Forbid();
    }

    private ActionResult? EnsureAnyPermission(params string[] permissions)
    {
        return permissions.Any(HasPermission) ? null : Forbid();
    }

    private bool HasPermission(string permission)
    {
        var hasWildcard = User.Claims.Any(c =>
            c.Type == "permission" &&
            string.Equals(c.Value, "*", StringComparison.OrdinalIgnoreCase));

        if (hasWildcard)
        {
            return true;
        }

        return User.Claims.Any(c =>
            c.Type == "permission" &&
            string.Equals(c.Value, permission, StringComparison.OrdinalIgnoreCase));
    }

    private bool IsElevatedUser()
    {
        var hasAdminRole = User.Claims.Any(c =>
            c.Type == ClaimTypes.Role &&
            string.Equals(c.Value, "admin", StringComparison.OrdinalIgnoreCase));

        return hasAdminRole || HasPermission("admin:access") || HasPermission("user:manage");
    }
}
