using System.Security.Claims;
using DocQR.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace DocQR.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
[Authorize]
[Produces("application/json")]
public class AdminController : ControllerBase
{
    private static readonly string[] ActiveWorkloadStatuses =
    {
        "open",
        "in_review",
        "forwarded",
        "pending_approval",
        "approved",
        "rejected"
    };

    private readonly AppDbContext _context;
    private readonly ILogger<AdminController> _logger;

    public AdminController(AppDbContext context, ILogger<AdminController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("stats")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult> GetStats()
    {
        if (!HasAdminAccess())
        {
            return Forbid();
        }

        var baseQuery = _context.Dockets.Where(d => d.DeletedAt == null);

        var totalDocketsTask = baseQuery.CountAsync();
        var openDocketsTask = baseQuery.CountAsync(d => ActiveWorkloadStatuses.Contains(d.Status));
        var closedDocketsTask = baseQuery.CountAsync(d => d.Status == "closed");
        var archivedDocketsTask = baseQuery.CountAsync(d => d.Status == "archived");

        var statusBreakdownTask = baseQuery
            .GroupBy(d => d.Status)
            .Select(g => new
            {
                status = g.Key,
                count = g.Count()
            })
            .ToListAsync();

        var typeBreakdownTask = baseQuery
            .GroupBy(d => d.DocketTypeId)
            .Select(g => new
            {
                docketTypeId = g.Key,
                count = g.Count()
            })
            .ToListAsync();

        var departmentBreakdownTask = baseQuery
            .GroupBy(d => d.CurrentDepartmentId)
            .Select(g => new
            {
                departmentId = g.Key,
                count = g.Count()
            })
            .ToListAsync();

        var docketTypesTask = _context.DocketTypes
            .Select(dt => new { dt.Id, dt.Name })
            .ToListAsync();

        var departmentsTask = _context.Departments
            .Select(d => new { d.Id, d.Name, d.Code })
            .ToListAsync();

        await Task.WhenAll(
            totalDocketsTask,
            openDocketsTask,
            closedDocketsTask,
            archivedDocketsTask,
            statusBreakdownTask,
            typeBreakdownTask,
            departmentBreakdownTask,
            docketTypesTask,
            departmentsTask);

        var typeNameById = docketTypesTask.Result.ToDictionary(dt => dt.Id, dt => dt.Name);
        var departmentNameById = departmentsTask.Result.ToDictionary(
            d => d.Id,
            d => string.IsNullOrWhiteSpace(d.Code) ? d.Name : $"{d.Name} ({d.Code})");

        return Ok(new
        {
            totals = new
            {
                totalDockets = totalDocketsTask.Result,
                openDockets = openDocketsTask.Result,
                closedDockets = closedDocketsTask.Result,
                archivedDockets = archivedDocketsTask.Result
            },
            byStatus = statusBreakdownTask.Result
                .OrderByDescending(x => x.count)
                .ThenBy(x => x.status)
                .ToList(),
            byType = typeBreakdownTask.Result
                .Select(x => new
                {
                    x.docketTypeId,
                    typeName = x.docketTypeId != null && typeNameById.TryGetValue(x.docketTypeId, out var name)
                        ? name
                        : "Uncategorized",
                    x.count
                })
                .OrderByDescending(x => x.count)
                .ThenBy(x => x.typeName)
                .ToList(),
            byDepartment = departmentBreakdownTask.Result
                .Select(x => new
                {
                    x.departmentId,
                    departmentName = x.departmentId != null && departmentNameById.TryGetValue(x.departmentId, out var name)
                        ? name
                        : "Unassigned",
                    x.count
                })
                .OrderByDescending(x => x.count)
                .ThenBy(x => x.departmentName)
                .ToList()
        });
    }

    [HttpGet("audit-logs")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult> GetAuditLogs(
        [FromQuery] string? userId,
        [FromQuery] string? action,
        [FromQuery] string? resourceType,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20)
    {
        if (!HasAdminAccess())
        {
            return Forbid();
        }

        var normalizedPage = Math.Max(1, page);
        var normalizedLimit = Math.Clamp(limit, 1, 100);

        try
        {
            var query = _context.AuditLogs
                .AsNoTracking()
                .Include(l => l.User)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(userId))
            {
                query = query.Where(l => l.UserId == userId);
            }

            if (!string.IsNullOrWhiteSpace(action))
            {
                query = query.Where(l => EF.Functions.ILike(l.Action, action));
            }

            if (!string.IsNullOrWhiteSpace(resourceType))
            {
                query = query.Where(l => EF.Functions.ILike(l.ResourceType, resourceType));
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchPattern = $"%{search.Trim()}%";
                query = query.Where(l =>
                    (l.ResourceId != null && EF.Functions.ILike(l.ResourceId, searchPattern)) ||
                    (l.RequestPath != null && EF.Functions.ILike(l.RequestPath, searchPattern)) ||
                    (l.Action != null && EF.Functions.ILike(l.Action, searchPattern)) ||
                    (l.ResourceType != null && EF.Functions.ILike(l.ResourceType, searchPattern)) ||
                    EF.Functions.ILike(l.Details, searchPattern));
            }

            var total = await query.CountAsync();

            var data = await query
                .OrderByDescending(l => l.CreatedAt)
                .Skip((normalizedPage - 1) * normalizedLimit)
                .Take(normalizedLimit)
                .Select(l => new
                {
                    id = l.Id,
                    userId = l.UserId,
                    action = l.Action,
                    resourceType = l.ResourceType,
                    resourceId = l.ResourceId,
                    docketId = l.DocketId,
                    attachmentId = l.AttachmentId,
                    requestPath = l.RequestPath,
                    requestMethod = l.RequestMethod,
                    details = l.Details,
                    createdAt = l.CreatedAt,
                    user = l.User == null
                        ? null
                        : new
                        {
                            id = l.User.Id,
                            username = l.User.Username,
                            email = l.User.Email,
                            firstName = l.User.FirstName,
                            lastName = l.User.LastName
                        }
                })
                .ToListAsync();

            return Ok(new
            {
                data,
                meta = new
                {
                    page = normalizedPage,
                    limit = normalizedLimit,
                    total,
                    totalPages = (int)Math.Ceiling((double)total / normalizedLimit)
                }
            });
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            _logger.LogWarning(ex, "Audit log table missing. Returning empty audit log response.");
            return Ok(new
            {
                data = Array.Empty<object>(),
                meta = new
                {
                    page = normalizedPage,
                    limit = normalizedLimit,
                    total = 0,
                    totalPages = 0
                }
            });
        }
    }

    [HttpGet("reports/sla")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult> GetSlaReport()
    {
        if (!HasAdminAccess())
        {
            return Forbid();
        }

        var baseQuery = _context.Dockets.Where(d => d.DeletedAt == null);
        var now = DateTime.UtcNow;
        var activeQuery = baseQuery.Where(d => d.Status != "closed" && d.Status != "archived");

        var onTrackTask = activeQuery
            .CountAsync(d => d.SlaStatus == "on_track" || d.DueDate == null || d.DueDate > now.AddDays(1));

        var atRiskTask = activeQuery
            .CountAsync(d => d.SlaStatus == "at_risk" || (d.DueDate != null && d.DueDate >= now && d.DueDate <= now.AddDays(1)));

        var overdueTask = activeQuery
            .CountAsync(d => d.SlaStatus == "overdue" || (d.DueDate != null && d.DueDate < now));

        var overdueItemsTask = activeQuery
            .Where(d => d.SlaStatus == "overdue" || (d.DueDate != null && d.DueDate < now))
            .OrderBy(d => d.DueDate)
            .ThenBy(d => d.CreatedAt)
            .Take(50)
            .Select(d => new
            {
                id = d.Id,
                docketNumber = d.DocketNumber,
                subject = d.Subject,
                dueDate = d.DueDate,
                status = d.Status,
                currentAssignee = d.CurrentAssignee == null
                    ? null
                    : new
                    {
                        id = d.CurrentAssignee.Id,
                        username = d.CurrentAssignee.Username,
                        firstName = d.CurrentAssignee.FirstName,
                        lastName = d.CurrentAssignee.LastName
                    }
            })
            .ToListAsync();

        await Task.WhenAll(onTrackTask, atRiskTask, overdueTask, overdueItemsTask);

        return Ok(new
        {
            summary = new
            {
                onTrack = onTrackTask.Result,
                atRisk = atRiskTask.Result,
                overdue = overdueTask.Result
            },
            overdueItems = overdueItemsTask.Result
        });
    }

    [HttpGet("reports/workload")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult> GetWorkloadReport()
    {
        if (!HasAdminAccess())
        {
            return Forbid();
        }

        var activeQuery = _context.Dockets
            .Where(d => d.DeletedAt == null && ActiveWorkloadStatuses.Contains(d.Status));

        var byUserRaw = await activeQuery
            .Where(d => d.CurrentAssigneeId != null)
            .GroupBy(d => d.CurrentAssigneeId)
            .Select(g => new
            {
                userId = g.Key!,
                docketCount = g.Count()
            })
            .ToListAsync();

        var byDepartmentRaw = await activeQuery
            .Where(d => d.CurrentDepartmentId != null)
            .GroupBy(d => d.CurrentDepartmentId)
            .Select(g => new
            {
                departmentId = g.Key!,
                docketCount = g.Count()
            })
            .ToListAsync();

        var userIds = byUserRaw.Select(x => x.userId).Distinct().ToList();
        var departmentIds = byDepartmentRaw.Select(x => x.departmentId).Distinct().ToList();

        var usersTask = _context.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.FirstName,
                u.LastName
            })
            .ToListAsync();

        var departmentsTask = _context.Departments
            .Where(d => departmentIds.Contains(d.Id))
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.Code
            })
            .ToListAsync();

        await Task.WhenAll(usersTask, departmentsTask);

        var userById = usersTask.Result.ToDictionary(u => u.Id, u => u);
        var departmentById = departmentsTask.Result.ToDictionary(d => d.Id, d => d);

        var byUser = byUserRaw
            .Select(item =>
            {
                userById.TryGetValue(item.userId, out var user);
                var displayName = user == null
                    ? "Unknown user"
                    : (!string.IsNullOrWhiteSpace(user.FirstName)
                        ? $"{user.FirstName} {user.LastName}".Trim()
                        : user.Username);

                return new
                {
                    item.userId,
                    userName = displayName,
                    item.docketCount
                };
            })
            .OrderByDescending(x => x.docketCount)
            .ThenBy(x => x.userName)
            .ToList();

        var byDepartment = byDepartmentRaw
            .Select(item =>
            {
                departmentById.TryGetValue(item.departmentId, out var department);
                var displayName = department == null
                    ? "Unknown department"
                    : string.IsNullOrWhiteSpace(department.Code)
                        ? department.Name
                        : $"{department.Name} ({department.Code})";

                return new
                {
                    item.departmentId,
                    departmentName = displayName,
                    item.docketCount
                };
            })
            .OrderByDescending(x => x.docketCount)
            .ThenBy(x => x.departmentName)
            .ToList();

        return Ok(new
        {
            byUser,
            byDepartment
        });
    }

    [HttpGet("reports/turnaround")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult> GetTurnaroundReport()
    {
        if (!HasAdminAccess())
        {
            return Forbid();
        }

        var closed = await _context.Dockets
            .Where(d =>
                d.DeletedAt == null &&
                d.ClosedAt != null &&
                (d.Status == "closed" || d.Status == "archived"))
            .OrderByDescending(d => d.ClosedAt)
            .Take(1000)
            .Select(d => new
            {
                id = d.Id,
                docketNumber = d.DocketNumber,
                subject = d.Subject,
                createdAt = d.CreatedAt,
                closedAt = d.ClosedAt,
                docketType = d.DocketType == null
                    ? null
                    : new
                    {
                        id = d.DocketType.Id,
                        name = d.DocketType.Name
                    }
            })
            .ToListAsync();

        var items = closed
            .Where(x => x.closedAt.HasValue)
            .Select(x => new
            {
                x.id,
                x.docketNumber,
                x.subject,
                x.createdAt,
                x.closedAt,
                x.docketType,
                turnaroundHours = (x.closedAt!.Value - x.createdAt).TotalHours
            })
            .ToList();

        var averageTurnaroundHours = items.Count > 0
            ? items.Average(i => i.turnaroundHours)
            : 0;

        return Ok(new
        {
            summary = new
            {
                sampleSize = items.Count,
                averageTurnaroundHours
            },
            items = items.Take(100)
        });
    }

    private bool HasAdminAccess()
    {
        var hasAdminRole = User.Claims.Any(c =>
            c.Type == ClaimTypes.Role &&
            string.Equals(c.Value, "admin", StringComparison.OrdinalIgnoreCase));

        if (hasAdminRole)
        {
            return true;
        }

        var hasAdminPermission = User.Claims.Any(c =>
            c.Type == "permission" &&
            (string.Equals(c.Value, "admin:access", StringComparison.OrdinalIgnoreCase) ||
             string.Equals(c.Value, "*", StringComparison.OrdinalIgnoreCase)));

        return hasAdminPermission;
    }
}
