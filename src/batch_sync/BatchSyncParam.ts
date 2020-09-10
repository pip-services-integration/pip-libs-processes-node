export class BatchSyncParam {
    public static readonly StartQueue: string = "StartQueue";
    public static readonly DownloadAdapter: string = "DownloadAdapter";
    public static readonly DownloadResponseQueue: string = "DownloadResponseQueue";
    public static readonly UploadAdapter: string = "UploadAdapter";
    public static readonly UploadResponseQueue: string = "UploadResponseQueue";
    public static readonly RecoveryQueue: string = "RecoveryQueue";
    public static readonly IncrementalChanges: string = "IncrementalChanges";
    public static readonly LastSyncTimeUtc: string = "LastSyncTimeUtc";
    public static readonly StopSyncTimeUtc: string = "StopSyncTimeUtc";
    public static readonly InitialSyncInterval: string = "InitialSyncInterval";
    public static readonly DownloadResponseMessage: string = "DownloadResponseMessage";
}