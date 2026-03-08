using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Npgsql;
using DocQR.Api.Data;
using DocQR.Api.Services;
using DocQR.Api.Configuration;

var builder = WebApplication.CreateBuilder(args);

// Configuration
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<StorageSettings>(builder.Configuration.GetSection("Storage"));

// Database
var rawConnectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? builder.Configuration["DATABASE_URL"]
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
var connectionString = NormalizePostgresConnectionString(rawConnectionString);
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()
    ?? throw new InvalidOperationException("JWT settings not found.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// Services
builder.Services.AddHttpClient();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IStorageService, StorageService>();
builder.Services.AddScoped<IQrCodeService, QrCodeService>();
builder.Services.AddScoped<IDocketService, DocketService>();
builder.Services.AddScoped<INotificationDeliveryService, NotificationDeliveryService>();

// Controllers
builder.Services.AddControllers();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
            ?? new[] { "http://localhost:5173" };
        policy.WithOrigins(origins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "DOCQR API (.NET)",
        Version = "v1",
        Description = "Hybrid Physical-to-Digital Document Workflow System API - .NET Core Backend"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "DOCQR API v1");
        c.RoutePrefix = "api/docs";
    });
}

app.UseRouting();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    timestamp = DateTime.UtcNow.ToString("o"),
    service = "docqr-dotnet"
}));

// Backward-compatible QR scan endpoint for previously generated /scan/{token} URLs
app.MapGet("/scan/{token}", async (string token, IDocketService docketService) =>
{
    var docket = await docketService.GetDocketByQrTokenAsync(token);
    return docket is null
        ? Results.NotFound(new { message = "Docket not found or QR code expired" })
        : Results.Ok(docket);
});

// Startup banner
var port = builder.Configuration.GetValue<int>("Port", 5000);
app.Urls.Add($"http://0.0.0.0:{port}");

Console.WriteLine(@$"
╔═══════════════════════════════════════════════════════════════╗
║                DOCQR v2 .NET Core Service                      ║
╠═══════════════════════════════════════════════════════════════╣
║  Environment:  {app.Environment.EnvironmentName,-46}║
║  Port:         {port,-46}║
║  Swagger:      /api/docs                                       ║
║  Health:       /health                                         ║
╚═══════════════════════════════════════════════════════════════╝
");

app.Run();

static string NormalizePostgresConnectionString(string rawConnectionString)
{
    if (string.IsNullOrWhiteSpace(rawConnectionString))
    {
        throw new InvalidOperationException("Database connection string is empty.");
    }

    if (!rawConnectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
        !rawConnectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        return rawConnectionString;
    }

    var uri = new Uri(rawConnectionString);
    var userInfoParts = uri.UserInfo.Split(':', 2);
    var builder = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.IsDefaultPort ? 5432 : uri.Port,
        Database = uri.AbsolutePath.Trim('/'),
        Username = userInfoParts.Length > 0 ? Uri.UnescapeDataString(userInfoParts[0]) : string.Empty,
        Password = userInfoParts.Length > 1 ? Uri.UnescapeDataString(userInfoParts[1]) : string.Empty
    };

    var query = uri.Query.TrimStart('?');
    if (!string.IsNullOrWhiteSpace(query))
    {
        foreach (var pair in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var keyValue = pair.Split('=', 2);
            var key = Uri.UnescapeDataString(keyValue[0]).ToLowerInvariant();
            var value = keyValue.Length > 1 ? Uri.UnescapeDataString(keyValue[1]) : string.Empty;

            if (key is "sslmode" && Enum.TryParse<SslMode>(value, true, out var sslMode))
            {
                builder.SslMode = sslMode;
                continue;
            }

            if (key is "pooling" && bool.TryParse(value, out var pooling))
            {
                builder.Pooling = pooling;
            }
        }
    }

    return builder.ConnectionString;
}
