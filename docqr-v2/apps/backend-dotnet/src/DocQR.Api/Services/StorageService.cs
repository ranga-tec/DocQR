using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;
using DocQR.Api.Configuration;

namespace DocQR.Api.Services;

public interface IStorageService
{
    Task UploadFileAsync(string bucket, string key, byte[] data, string contentType);
    Task<Stream> GetFileAsync(string bucket, string key);
    Task DeleteFileAsync(string bucket, string key);
    Task<bool> FileExistsAsync(string bucket, string key);
    string GetDocumentsBucket();
    string GetQrCodesBucket();
}

public class StorageService : IStorageService
{
    private readonly StorageSettings _settings;
    private readonly IMinioClient? _minioClient;
    private readonly ILogger<StorageService> _logger;

    public StorageService(IOptions<StorageSettings> settings, ILogger<StorageService> logger)
    {
        _settings = settings.Value;
        _logger = logger;

        if (_settings.Provider == "minio" && _settings.Minio != null)
        {
            _minioClient = new MinioClient()
                .WithEndpoint(_settings.Minio.Endpoint)
                .WithCredentials(_settings.Minio.AccessKey, _settings.Minio.SecretKey)
                .WithSSL(_settings.Minio.UseSSL)
                .Build();

            // Ensure buckets exist
            EnsureBucketsExist().GetAwaiter().GetResult();
        }
        else
        {
            // Ensure local directories exist
            Directory.CreateDirectory(Path.Combine(_settings.LocalPath, _settings.DocumentsBucket));
            Directory.CreateDirectory(Path.Combine(_settings.LocalPath, _settings.QrCodesBucket));
        }
    }

    private async Task EnsureBucketsExist()
    {
        if (_minioClient == null) return;

        foreach (var bucket in new[] { _settings.DocumentsBucket, _settings.QrCodesBucket })
        {
            var exists = await _minioClient.BucketExistsAsync(new BucketExistsArgs().WithBucket(bucket));
            if (!exists)
            {
                await _minioClient.MakeBucketAsync(new MakeBucketArgs().WithBucket(bucket));
                _logger.LogInformation("Created bucket: {Bucket}", bucket);
            }
        }
    }

    public string GetDocumentsBucket() => _settings.DocumentsBucket;
    public string GetQrCodesBucket() => _settings.QrCodesBucket;

    public async Task UploadFileAsync(string bucket, string key, byte[] data, string contentType)
    {
        if (_minioClient != null)
        {
            using var stream = new MemoryStream(data);
            await _minioClient.PutObjectAsync(new PutObjectArgs()
                .WithBucket(bucket)
                .WithObject(key)
                .WithStreamData(stream)
                .WithObjectSize(data.Length)
                .WithContentType(contentType));
        }
        else
        {
            var filePath = GetLocalPath(bucket, key);
            var directory = Path.GetDirectoryName(filePath);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }
            await File.WriteAllBytesAsync(filePath, data);
        }
    }

    public async Task<Stream> GetFileAsync(string bucket, string key)
    {
        if (_minioClient != null)
        {
            var memoryStream = new MemoryStream();
            await _minioClient.GetObjectAsync(new GetObjectArgs()
                .WithBucket(bucket)
                .WithObject(key)
                .WithCallbackStream(stream => stream.CopyTo(memoryStream)));
            memoryStream.Position = 0;
            return memoryStream;
        }
        else
        {
            var filePath = GetLocalPath(bucket, key);
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException($"File not found: {key}");
            }
            return new FileStream(filePath, FileMode.Open, FileAccess.Read);
        }
    }

    public async Task DeleteFileAsync(string bucket, string key)
    {
        if (_minioClient != null)
        {
            await _minioClient.RemoveObjectAsync(new RemoveObjectArgs()
                .WithBucket(bucket)
                .WithObject(key));
        }
        else
        {
            var filePath = GetLocalPath(bucket, key);
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
            }
        }
    }

    public async Task<bool> FileExistsAsync(string bucket, string key)
    {
        if (_minioClient != null)
        {
            try
            {
                await _minioClient.StatObjectAsync(new StatObjectArgs()
                    .WithBucket(bucket)
                    .WithObject(key));
                return true;
            }
            catch
            {
                return false;
            }
        }
        else
        {
            var filePath = GetLocalPath(bucket, key);
            return await Task.FromResult(File.Exists(filePath));
        }
    }

    private string GetLocalPath(string bucket, string key)
    {
        return Path.Combine(_settings.LocalPath, bucket, key);
    }
}
