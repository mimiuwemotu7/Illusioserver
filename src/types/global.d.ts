declare global {
    var mintWatcherStatus: 'initializing' | 'running' | 'failed' | undefined;
    var marketcapUpdaterStatus: 'initializing' | 'running' | 'failed' | 'disabled' | undefined;
    var metadataEnricherStatus: 'initializing' | 'running' | 'failed' | undefined;
}

export {};
