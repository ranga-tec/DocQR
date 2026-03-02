namespace DocQR.Api.Configuration;

public class StorageSettings
{
    public string Provider { get; set; } = "local"; // "local" or "minio"
    public string LocalPath { get; set; } = "./uploads";
    public MinioSettings? Minio { get; set; }
    public string DocumentsBucket { get; set; } = "docqr-documents";
    public string QrCodesBucket { get; set; } = "docqr-qrcodes";
}

public class MinioSettings
{
    public string Endpoint { get; set; } = "localhost:9000";
    public string AccessKey { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    public bool UseSSL { get; set; } = false;
}
