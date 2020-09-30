export class BatchSyncParam {
    public static readonly StartQueue: string = "start_queue";
    public static readonly DownloadAdapter: string = "download_adapter";
    public static readonly DownloadResponseQueue: string = "download_response_queue";
    public static readonly UploadAdapter: string = "upload_adapter";
    public static readonly UploadResponseQueue: string = "upload_response_queue";
    public static readonly RecoveryQueue: string = "recovery_queue";
    public static readonly IncrementalChanges: string = "incremental_changes";
    public static readonly LastSyncTimeUtc: string = "lastSyncTimeUtc";
    public static readonly StopSyncTimeUtc: string = "stop_sync_time_utc";
    public static readonly InitialSyncInterval: string = "initial_sync_interval";
    public static readonly DownloadResponseMessage: string = "download_response_message";
}