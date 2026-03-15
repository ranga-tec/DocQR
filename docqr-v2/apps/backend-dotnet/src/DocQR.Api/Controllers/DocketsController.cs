using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using DocQR.Api.DTOs;
using DocQR.Api.Services;

namespace DocQR.Api.Controllers;

[ApiController]
[Route("api/v1/dockets")]
[Produces("application/json")]
public class DocketsController : ControllerBase
{
    private readonly IDocketService _docketService;
    private readonly IQrCodeService _qrCodeService;
    private readonly ILogger<DocketsController> _logger;

    public DocketsController(
        IDocketService docketService,
        IQrCodeService qrCodeService,
        ILogger<DocketsController> logger)
    {
        _docketService = docketService;
        _qrCodeService = qrCodeService;
        _logger = logger;
    }

    [HttpGet]
    [Authorize]
    [ProducesResponseType(typeof(DocketListResponseDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DocketListResponseDto>> GetDockets(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] int? limit = null,  // Alias for pageSize
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] bool assignedToMe = false,
        [FromQuery] string? sort = null)
    {
        var forbidden = EnsurePermission("docket:view");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var effectivePageSize = limit ?? pageSize;
        var result = await _docketService.GetDocketsAsync(
            userId,
            page,
            effectivePageSize,
            status,
            search,
            assignedToMe,
            IsElevatedUser());
        // Wrap in data property with nested data array for frontend compatibility
        return Ok(new
        {
            data = new
            {
                data = result.Items,
                total = result.Total,
                page = result.Page,
                pageSize = result.PageSize,
                totalPages = result.TotalPages
            }
        });
    }

    [HttpGet("{id}")]
    [Authorize]
    [ProducesResponseType(typeof(DocketResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DocketResponseDto>> GetDocket(string id)
    {
        var forbidden = EnsurePermission("docket:view");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var docket = await _docketService.GetDocketByIdAsync(id, userId, IsElevatedUser());

        if (docket == null)
        {
            return NotFound(new { message = "Docket not found" });
        }

        return Ok(docket);
    }

    [HttpGet("qr/{qrToken}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(DocketResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DocketResponseDto>> GetDocketByQrToken(string qrToken)
    {
        var docket = await _docketService.GetDocketByQrTokenAsync(qrToken);

        if (docket == null)
        {
            return NotFound(new { message = "Docket not found or QR code expired" });
        }

        return Ok(docket);
    }

    [HttpPost]
    [Authorize]
    [ProducesResponseType(typeof(DocketResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DocketResponseDto>> CreateDocket([FromBody] CreateDocketDto dto)
    {
        var forbidden = EnsurePermission("docket:create");
        if (forbidden != null)
        {
            return forbidden;
        }

        try
        {
            var userId = GetCurrentUserId();
            var docket = await _docketService.CreateDocketAsync(dto, userId);
            return CreatedAtAction(nameof(GetDocket), new { id = docket.Id }, docket);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("{id}")]
    [Authorize]
    [ProducesResponseType(typeof(DocketResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DocketResponseDto>> UpdateDocket(string id, [FromBody] UpdateDocketDto dto)
    {
        var forbidden = EnsurePermission("docket:update");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var docket = await _docketService.UpdateDocketAsync(id, dto, userId);

        if (docket == null)
        {
            return NotFound(new { message = "Docket not found" });
        }

        return Ok(docket);
    }

    [HttpDelete("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteDocket(string id)
    {
        var forbidden = EnsurePermission("docket:delete");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var deleted = await _docketService.DeleteDocketAsync(id, userId);

        if (!deleted)
        {
            return NotFound(new { message = "Docket not found" });
        }

        return Ok(new { message = "Docket deleted successfully" });
    }

    [HttpPost("{id}/forward")]
    [Authorize]
    [ProducesResponseType(typeof(DocketResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DocketResponseDto>> ForwardDocket(string id, [FromBody] ForwardDocketDto dto)
    {
        var forbidden = EnsurePermission("docket:forward");
        if (forbidden != null)
        {
            return forbidden;
        }

        try
        {
            var userId = GetCurrentUserId();
            var docket = await _docketService.ForwardDocketAsync(id, dto, userId);

            if (docket == null)
            {
                return NotFound(new { message = "Docket not found" });
            }

            return Ok(docket);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/accept")]
    [Authorize]
    [ProducesResponseType(typeof(DocketResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DocketResponseDto>> AcceptDocket(string id, [FromBody] AcceptDocketDto? dto)
    {
        var forbidden = EnsurePermission("docket:view");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var docket = await _docketService.AcceptDocketAsync(id, userId, dto?.Notes);

        if (docket == null)
        {
            return NotFound(new { message = "Docket not found" });
        }

        return Ok(docket);
    }

    [HttpPost("{id}/close")]
    [Authorize]
    [ProducesResponseType(typeof(DocketResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DocketResponseDto>> CloseDocket(string id)
    {
        var forbidden = EnsurePermission("docket:close");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var docket = await _docketService.CloseDocketAsync(id, userId);

        if (docket == null)
        {
            return NotFound(new { message = "Docket not found" });
        }

        return Ok(docket);
    }

    [HttpPost("{id}/regenerate-qr")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> RegenerateQrToken(string id, [FromQuery] int hours = 24)
    {
        var forbidden = EnsurePermission("docket:update");
        if (forbidden != null)
        {
            return forbidden;
        }

        try
        {
            var token = await _docketService.GenerateQrTokenAsync(id, hours);
            return Ok(new { qrToken = token, expiresIn = $"{hours} hours" });
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("{id}/qr")]
    [HttpGet("{id}/qr-code")]
    [Authorize]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> GetQrCodeImage(string id)
    {
        var forbidden = EnsurePermission("docket:view");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var docket = await _docketService.GetDocketByIdAsync(id, userId, IsElevatedUser());

        if (docket == null || string.IsNullOrEmpty(docket.QrToken))
        {
            return NotFound(new { message = "Docket not found or no QR token" });
        }

        // Generate QR payload URL (public API endpoint for token lookup)
        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var qrUrl = $"{baseUrl}/api/v1/dockets/qr/{docket.QrToken}";

        var qrBytes = _qrCodeService.GenerateQrCode(qrUrl);
        return File(qrBytes, "image/png", $"qr-{docket.ReferenceNumber}.png");
    }

    // Comments endpoints
    [HttpGet("{id}/comments")]
    [Authorize]
    [ProducesResponseType(typeof(List<CommentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CommentDto>>> GetComments(string id)
    {
        var forbidden = EnsurePermission("docket:view");
        if (forbidden != null)
        {
            return forbidden;
        }

        var comments = await _docketService.GetCommentsAsync(id);
        return Ok(comments);
    }

    [HttpPost("{id}/comments")]
    [Authorize]
    [ProducesResponseType(typeof(CommentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CommentDto>> AddComment(string id, [FromBody] CreateCommentDto dto)
    {
        var forbidden = EnsurePermission("docket:comment");
        if (forbidden != null)
        {
            return forbidden;
        }

        try
        {
            var userId = GetCurrentUserId();
            var comment = await _docketService.AddCommentAsync(id, dto, userId);
            return CreatedAtAction(nameof(GetComments), new { id }, comment);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // History endpoint
    [HttpGet("{id}/history")]
    [Authorize]
    [ProducesResponseType(typeof(List<DocketHistoryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<DocketHistoryDto>>> GetHistory(string id)
    {
        var forbidden = EnsurePermission("docket:view");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var docket = await _docketService.GetDocketByIdAsync(id, userId, IsElevatedUser());

        if (docket == null)
        {
            return NotFound(new { message = "Docket not found" });
        }

        var history = await _docketService.GetHistoryAsync(id, userId, IsElevatedUser());

        return Ok(history);
    }

    // Actions endpoint - returns available workflow actions
    [HttpGet("{id}/actions")]
    [Authorize]
    [ProducesResponseType(typeof(List<DocketActionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<DocketActionDto>>> GetAvailableActions(string id)
    {
        var forbidden = EnsurePermission("docket:view");
        if (forbidden != null)
        {
            return forbidden;
        }

        var userId = GetCurrentUserId();
        var docket = await _docketService.GetDocketByIdAsync(id, userId, IsElevatedUser());

        if (docket == null)
        {
            return NotFound(new { message = "Docket not found" });
        }

        // Return available actions based on current status
        var actions = new List<DocketActionDto>();

        switch (docket.Status.ToLower())
        {
            case "open":
                actions.Add(new DocketActionDto { Action = "forward", Label = "Forward", Description = "Forward to another user" });
                actions.Add(new DocketActionDto { Action = "close", Label = "Close", Description = "Close the docket" });
                break;
            case "forwarded":
                actions.Add(new DocketActionDto { Action = "accept", Label = "Accept", Description = "Accept the docket" });
                actions.Add(new DocketActionDto { Action = "forward", Label = "Forward", Description = "Forward to another user" });
                break;
            case "in_review":
                actions.Add(new DocketActionDto { Action = "close", Label = "Close", Description = "Close the docket" });
                actions.Add(new DocketActionDto { Action = "forward", Label = "Forward", Description = "Forward to another user" });
                break;
        }

        // Keep action list aligned with implemented action endpoints and permission checks
        // to avoid showing buttons that would fail with 403/404.
        actions = actions
            .Where(action => IsActionPermitted(action.Action))
            .ToList();

        return Ok(actions);
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

    private ActionResult? EnsurePermission(string permission)
    {
        return HasPermission(permission) ? null : Forbid();
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

    private bool IsActionPermitted(string action)
    {
        return action.ToLowerInvariant() switch
        {
            "forward" => HasPermission("docket:forward"),
            "close" => HasPermission("docket:close"),
            "accept" => HasPermission("docket:view"),
            _ => false
        };
    }
}

public class DocketActionDto
{
    public string Action { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class AcceptDocketDto
{
    public string? Notes { get; set; }
}
