using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using DocQR.Api.Data;

namespace DocQR.Api.Controllers;

[ApiController]
[Route("api/v1/onlyoffice")]
[Produces("application/json")]
public class OnlyOfficeController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<OnlyOfficeController> _logger;

    public OnlyOfficeController(
        AppDbContext context,
        IConfiguration configuration,
        ILogger<OnlyOfficeController> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpGet("config/{attachmentId}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> GetEditorConfig(
        string attachmentId,
        [FromQuery] string mode = "view")
    {
        var attachment = await _context.DocketAttachments
            .Include(a => a.Docket)
            .Include(a => a.Uploader)
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.DeletedAt == null);

        if (attachment == null)
        {
            return NotFound(new { message = "Attachment not found" });
        }

        var userId = GetCurrentUserId();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        // Get OnlyOffice configuration
        var onlyOfficeUrl = _configuration["OnlyOffice:ServerUrl"] ?? "http://localhost:8080";
        var jwtSecret = _configuration["OnlyOffice:JwtSecret"] ?? "your-256-bit-secret-for-onlyoffice-jwt";
        var jwtEnabled = _configuration.GetValue<bool>("OnlyOffice:JwtEnabled", true);

        // Build document URL - use host.docker.internal for Docker containers to reach host
        var externalUrl = _configuration["OnlyOffice:ExternalBackendUrl"];
        string baseUrl;

        if (!string.IsNullOrEmpty(externalUrl))
        {
            baseUrl = externalUrl;
        }
        else
        {
            var hostIp = _configuration["OnlyOffice:HostIp"] ?? "host.docker.internal";
            var port = Request.Host.Port ?? 5000;
            baseUrl = $"http://{hostIp}:{port}";
        }

        // Document URL (uses token-based endpoint)
        var documentUrl = $"{baseUrl}/api/v1/onlyoffice/document/{attachmentId}";
        var callbackUrl = $"{baseUrl}/api/v1/onlyoffice/callback/{attachmentId}";

        // Determine document type
        var documentType = GetDocumentType(attachment.MimeType);
        var fileType = GetFileExtension(attachment.OriginalFileName);

        // For PDFs, always use edit mode to enable commenting/annotation
        var effectiveMode = documentType == "pdf" ? "edit" : mode;

        // Include version in key to bust cache after edits
        var documentKey = $"{attachment.Id}_v{attachment.Version}_{attachment.UploadedAt:yyyyMMddHHmmss}";

        // Build the config object
        var config = new OnlyOfficeConfig
        {
            Document = new OnlyOfficeDocument
            {
                FileType = fileType,
                Key = documentKey,
                Title = attachment.OriginalFileName,
                Url = documentUrl,
                Permissions = new OnlyOfficePermissions
                {
                    Download = true,
                    Edit = effectiveMode == "edit",
                    Print = true,
                    Review = effectiveMode == "edit",
                    Comment = true,  // Allow commenting even in view mode
                    FillForms = true
                }
            },
            DocumentType = documentType,
            EditorConfig = new OnlyOfficeEditorConfig
            {
                Mode = effectiveMode == "edit" ? "edit" : "view",
                CallbackUrl = callbackUrl,
                User = new OnlyOfficeUser
                {
                    Id = userId,
                    Name = user?.FullName ?? user?.Username ?? "Unknown"
                },
                Customization = new OnlyOfficeCustomization
                {
                    Autosave = true,
                    Chat = false,
                    Comments = true,
                    CompactHeader = false,
                    CompactToolbar = false,
                    Feedback = false,
                    Forcesave = true,
                    Help = false
                },
                Lang = "en"
            }
        };

        // Generate JWT token if enabled (token payload should NOT include the token field itself)
        if (jwtEnabled)
        {
            // Create a payload for signing - must use same property names as expected by OnlyOffice
            // The JsonSerializerOptions with CamelCase policy handles the naming
            config.Token = GenerateJwtTokenFromObject(new
            {
                document = new
                {
                    fileType = config.Document.FileType,
                    key = config.Document.Key,
                    title = config.Document.Title,
                    url = config.Document.Url,
                    permissions = new
                    {
                        download = config.Document.Permissions.Download,
                        edit = config.Document.Permissions.Edit,
                        print = config.Document.Permissions.Print,
                        review = config.Document.Permissions.Review,
                        comment = config.Document.Permissions.Comment,
                        fillForms = config.Document.Permissions.FillForms
                    }
                },
                documentType = config.DocumentType,
                editorConfig = new
                {
                    mode = config.EditorConfig.Mode,
                    callbackUrl = config.EditorConfig.CallbackUrl,
                    user = new
                    {
                        id = config.EditorConfig.User.Id,
                        name = config.EditorConfig.User.Name
                    },
                    customization = new
                    {
                        autosave = config.EditorConfig.Customization.Autosave,
                        chat = config.EditorConfig.Customization.Chat,
                        comments = config.EditorConfig.Customization.Comments,
                        compactHeader = config.EditorConfig.Customization.CompactHeader,
                        compactToolbar = config.EditorConfig.Customization.CompactToolbar,
                        feedback = config.EditorConfig.Customization.Feedback,
                        forcesave = config.EditorConfig.Customization.Forcesave,
                        help = config.EditorConfig.Customization.Help
                    },
                    lang = config.EditorConfig.Lang
                }
            }, jwtSecret);
        }

        return Ok(new
        {
            onlyOfficeUrl = $"{onlyOfficeUrl}/web-apps/apps/api/documents/api.js",
            config
        });
    }

    // Document download endpoint for OnlyOffice (uses token-based auth)
    [HttpGet("document/{attachmentId}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> GetDocument(string attachmentId, [FromQuery] string? token)
    {
        var attachment = await _context.DocketAttachments
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.DeletedAt == null);

        if (attachment == null)
        {
            return NotFound(new { message = "Attachment not found" });
        }

        try
        {
            var localPath = _configuration["Storage:LocalPath"] ?? "./uploads";
            // Include storage bucket in the path: uploads/{bucket}/{storageKey}
            var filePath = Path.Combine(localPath, attachment.StorageBucket, attachment.StorageKey);

            if (!System.IO.File.Exists(filePath))
            {
                _logger.LogWarning("File not found at path: {FilePath}", filePath);
                return NotFound(new { message = "File not found in storage" });
            }

            var stream = System.IO.File.OpenRead(filePath);
            return File(stream, attachment.MimeType, attachment.OriginalFileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error serving document {AttachmentId}", attachmentId);
            return NotFound(new { message = "Error loading file" });
        }
    }

    [HttpPost("callback/{attachmentId}")]
    [AllowAnonymous]
    public async Task<ActionResult> HandleCallback(
        string attachmentId,
        [FromBody] OnlyOfficeCallbackDto callback,
        [FromHeader(Name = "Authorization")] string? authHeader)
    {
        _logger.LogInformation("OnlyOffice callback for {AttachmentId}: Status={Status}",
            attachmentId, callback.Status);

        // Validate JWT token from header if JWT is enabled
        var jwtEnabled = _configuration.GetValue<bool>("OnlyOffice:JwtEnabled", true);
        if (jwtEnabled && !string.IsNullOrEmpty(authHeader))
        {
            var jwtSecret = _configuration["OnlyOffice:JwtSecret"] ?? "your-256-bit-secret-for-onlyoffice-jwt";
            var token = authHeader.Replace("Bearer ", "");
            if (!ValidateJwtToken(token, jwtSecret))
            {
                _logger.LogWarning("Invalid JWT token in callback");
                return Ok(new { error = 1 });
            }
        }

        // Status codes:
        // 0 - no document with the key identifier
        // 1 - document is being edited
        // 2 - document is ready for saving
        // 3 - document saving error
        // 4 - document closed with no changes
        // 6 - document being edited, current state saved
        // 7 - force save error

        if (callback.Status == 2 || callback.Status == 6)
        {
            if (!string.IsNullOrEmpty(callback.Url))
            {
                try
                {
                    await SaveDocumentAsync(attachmentId, callback.Url);
                    _logger.LogInformation("Document saved successfully for {AttachmentId}", attachmentId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error saving document for {AttachmentId}", attachmentId);
                    return Ok(new { error = 1 });
                }
            }
        }

        return Ok(new { error = 0 });
    }

    private async Task SaveDocumentAsync(string attachmentId, string documentUrl)
    {
        var attachment = await _context.DocketAttachments
            .FirstOrDefaultAsync(a => a.Id == attachmentId);

        if (attachment == null) return;

        using var httpClient = new HttpClient();
        var response = await httpClient.GetAsync(documentUrl);
        response.EnsureSuccessStatusCode();

        var localPath = _configuration["Storage:LocalPath"] ?? "./uploads";
        // Include storage bucket in the path: uploads/{bucket}/{storageKey}
        var filePath = Path.Combine(localPath, attachment.StorageBucket, attachment.StorageKey);

        await using var fileStream = System.IO.File.Create(filePath);
        await response.Content.CopyToAsync(fileStream);

        // Update attachment metadata
        attachment.LastEditedAt = DateTime.UtcNow;
        attachment.Version++;
        await _context.SaveChangesAsync();
    }

    private static string GetDocumentType(string mimeType)
    {
        return mimeType switch
        {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => "word",
            "application/msword" => "word",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => "cell",
            "application/vnd.ms-excel" => "cell",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation" => "slide",
            "application/vnd.ms-powerpoint" => "slide",
            "application/pdf" => "pdf",  // Native PDF editor (OnlyOffice 7.2+)
            "text/plain" => "word",
            "application/rtf" => "word",
            _ => "word"
        };
    }

    private static string GetFileExtension(string fileName)
    {
        var ext = Path.GetExtension(fileName)?.TrimStart('.').ToLower();
        return ext ?? "docx";
    }

    private static string GenerateJwtTokenFromObject(object payload, string secret)
    {
        // Create JWT header
        var header = new { alg = "HS256", typ = "JWT" };
        var headerJson = JsonSerializer.Serialize(header);
        var headerBase64 = Base64UrlEncode(Encoding.UTF8.GetBytes(headerJson));

        // Create JWT payload - property names are already camelCase from anonymous objects
        var options = new JsonSerializerOptions
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            WriteIndented = false
        };
        var payloadJson = JsonSerializer.Serialize(payload, options);
        var payloadBase64 = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));

        // Create signature
        var signatureInput = $"{headerBase64}.{payloadBase64}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var signatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureInput));
        var signatureBase64 = Base64UrlEncode(signatureBytes);

        return $"{headerBase64}.{payloadBase64}.{signatureBase64}";
    }

    private static bool ValidateJwtToken(string token, string secret)
    {
        try
        {
            var parts = token.Split('.');
            if (parts.Length != 3) return false;

            var signatureInput = $"{parts[0]}.{parts[1]}";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var expectedSignature = Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureInput)));

            return parts[2] == expectedSignature;
        }
        catch
        {
            return false;
        }
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
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
}

// OnlyOffice configuration DTOs
public class OnlyOfficeConfig
{
    [JsonPropertyName("document")]
    public OnlyOfficeDocument Document { get; set; } = new();

    [JsonPropertyName("documentType")]
    public string DocumentType { get; set; } = "word";

    [JsonPropertyName("editorConfig")]
    public OnlyOfficeEditorConfig EditorConfig { get; set; } = new();

    [JsonPropertyName("token")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Token { get; set; }
}

public class OnlyOfficeDocument
{
    [JsonPropertyName("fileType")]
    public string FileType { get; set; } = string.Empty;

    [JsonPropertyName("key")]
    public string Key { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;

    [JsonPropertyName("permissions")]
    public OnlyOfficePermissions Permissions { get; set; } = new();
}

public class OnlyOfficePermissions
{
    [JsonPropertyName("download")]
    public bool Download { get; set; } = true;

    [JsonPropertyName("edit")]
    public bool Edit { get; set; } = true;

    [JsonPropertyName("print")]
    public bool Print { get; set; } = true;

    [JsonPropertyName("review")]
    public bool Review { get; set; } = true;

    [JsonPropertyName("comment")]
    public bool Comment { get; set; } = true;

    [JsonPropertyName("fillForms")]
    public bool FillForms { get; set; } = true;
}

public class OnlyOfficeEditorConfig
{
    [JsonPropertyName("mode")]
    public string Mode { get; set; } = "view";

    [JsonPropertyName("callbackUrl")]
    public string CallbackUrl { get; set; } = string.Empty;

    [JsonPropertyName("user")]
    public OnlyOfficeUser User { get; set; } = new();

    [JsonPropertyName("customization")]
    public OnlyOfficeCustomization Customization { get; set; } = new();

    [JsonPropertyName("lang")]
    public string Lang { get; set; } = "en";
}

public class OnlyOfficeUser
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class OnlyOfficeCustomization
{
    [JsonPropertyName("autosave")]
    public bool Autosave { get; set; }

    [JsonPropertyName("chat")]
    public bool Chat { get; set; }

    [JsonPropertyName("comments")]
    public bool Comments { get; set; }

    [JsonPropertyName("compactHeader")]
    public bool CompactHeader { get; set; }

    [JsonPropertyName("compactToolbar")]
    public bool CompactToolbar { get; set; }

    [JsonPropertyName("feedback")]
    public bool Feedback { get; set; }

    [JsonPropertyName("forcesave")]
    public bool Forcesave { get; set; }

    [JsonPropertyName("help")]
    public bool Help { get; set; }
}

public class OnlyOfficeCallbackDto
{
    [JsonPropertyName("status")]
    public int Status { get; set; }

    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("key")]
    public string? Key { get; set; }

    [JsonPropertyName("users")]
    public List<string>? Users { get; set; }

    [JsonPropertyName("actions")]
    public List<OnlyOfficeAction>? Actions { get; set; }
}

public class OnlyOfficeAction
{
    [JsonPropertyName("type")]
    public int Type { get; set; }

    [JsonPropertyName("userid")]
    public string? UserId { get; set; }
}
