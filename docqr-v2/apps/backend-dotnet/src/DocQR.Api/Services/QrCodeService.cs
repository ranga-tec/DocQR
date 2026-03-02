using System.Security.Cryptography;
using QRCoder;

namespace DocQR.Api.Services;

public interface IQrCodeService
{
    byte[] GenerateQrCode(string data, int pixelsPerModule = 10);
    string GenerateSecureToken(int length = 32);
    string ComputeHash(byte[] data, string algorithm = "SHA256");
}

public class QrCodeService : IQrCodeService
{
    private readonly ILogger<QrCodeService> _logger;

    public QrCodeService(ILogger<QrCodeService> logger)
    {
        _logger = logger;
    }

    public byte[] GenerateQrCode(string data, int pixelsPerModule = 10)
    {
        using var qrGenerator = new QRCodeGenerator();
        using var qrCodeData = qrGenerator.CreateQrCode(data, QRCodeGenerator.ECCLevel.M);
        using var qrCode = new PngByteQRCode(qrCodeData);
        return qrCode.GetGraphic(pixelsPerModule);
    }

    public string GenerateSecureToken(int length = 32)
    {
        var bytes = new byte[length];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", "");
    }

    public string ComputeHash(byte[] data, string algorithm = "SHA256")
    {
        using var hasher = algorithm.ToUpperInvariant() switch
        {
            "SHA256" => SHA256.Create(),
            "SHA512" => SHA512.Create() as HashAlgorithm,
            "MD5" => MD5.Create(),
            _ => throw new ArgumentException($"Unsupported hash algorithm: {algorithm}")
        };

        var hashBytes = hasher.ComputeHash(data);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}
