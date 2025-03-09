import { Behaviour, serializable, AssetReference, GameObject } from "@needle-tools/engine";
import { DataCluster } from "./DataCluster";
import { PersistentDataInterface } from "./PersistentDataInterface";

export class UserArchive extends Behaviour {
    @serializable()
    public jsonPath: string = "UserArchive.json"; // Place in MainLevel folder

    @serializable(AssetReference)
    public dataClusterPrefab?: AssetReference;

    @serializable(AssetReference)
    public dataEntryPrefab?: AssetReference;

    @serializable(AssetReference)
    public dataAssetPrefab?: AssetReference;
    
    @serializable()
    public autoSaveIntervalMs: number = 30000; // Reduced frequency - save every 30 seconds by default
    
    @serializable()
    public debugLogging: boolean = true; // Enable debug logging
    
    @serializable()
    public enableAutoSave: boolean = false; // Disable auto-save by default

    private dataClusters: DataCluster[] = [];
    public selectedDataCluster: DataCluster | null = null;
    private persistentData: PersistentDataInterface | null = null;
    private saveInterval: number | null = null;

    // Get the first available data cluster
    public getFirstDataCluster(): DataCluster | null {
        return this.dataClusters.length > 0 ? this.dataClusters[0] : null;
    }

    // Check if there are any data clusters
    public hasDataClusters(): boolean {
        return this.dataClusters.length > 0;
    }

    start() {
        if (this.debugLogging) {
            console.log("UserArchive: Starting...");
        }
        
        this.loadArchive();
        
        // Set up save before page unload
        this.setupBeforeUnloadSave();
    }
    
    onDestroy() {
        // Clean up resources
        this.clearSaveInterval();
        
        if (this.persistentData) {
            if (this.debugLogging) {
                console.log("UserArchive: Disposing persistent data interface");
            }
            this.persistentData.dispose();
            this.persistentData = null;
        }
        
        this.unloadArchive();
    }
    
    private clearSaveInterval(): void {
        if (this.saveInterval !== null) {
            window.clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
    }
    
    private setupSaveInterval(): void {
        // Clear any existing interval
        this.clearSaveInterval();
        
        // Only set up auto-save if enabled
        if (this.enableAutoSave && this.autoSaveIntervalMs > 0) {
            if (this.debugLogging) {
                console.log(`UserArchive: Setting up auto-save interval (${this.autoSaveIntervalMs}ms)`);
            }
            
            this.saveInterval = window.setInterval(() => {
                if (this.persistentData) {
                    if (this.debugLogging) {
                        console.log("UserArchive: Auto-saving data");
                    }
                    this.persistentData.saveData();
                }
            }, this.autoSaveIntervalMs);
        } else {
            if (this.debugLogging) {
                console.log("UserArchive: Auto-save is disabled");
            }
        }
    }

    public async loadArchive(): Promise<void> {
        if (this.debugLogging) {
            console.log(`UserArchive: Loading archive from ${this.jsonPath}`);
        }
        
        // Create the persistent data interface
        this.persistentData = new PersistentDataInterface(this.jsonPath, this.autoSaveIntervalMs);
        
        // Load the data
        const success = await this.persistentData.loadData();
        if (!success) {
            console.error(`Failed to load archive from ${this.jsonPath}`);
            return;
        }
        
        // Get the data from the interface
        if (this.debugLogging) {
            console.log("UserArchive: Attempting to get root data with UUID 123e4567-e89b-12d3-a456-426614174000");
        }
        
        const jsonData = this.persistentData.getObjectData("123e4567-e89b-12d3-a456-426614174000"); // Root UUID
        if (!jsonData) {
            console.error("Failed to get root data from persistent data interface");
            return;
        }
        
        if (this.debugLogging) {
            console.log("UserArchive: Successfully loaded data", jsonData);
            console.log("UserArchive: Number of data clusters:", jsonData.DataClusters?.length || 0);
        }
        
        // Create and load data clusters
        if (!jsonData.DataClusters || !Array.isArray(jsonData.DataClusters)) {
            console.error("Invalid data format: DataClusters is missing or not an array");
            return;
        }
        
        for (const clusterData of jsonData.DataClusters) {
            if (this.debugLogging) {
                console.log(`UserArchive: Creating cluster "${clusterData.Title}" with UUID ${clusterData.UUID}`);
            }
            
            const cluster = new DataCluster(clusterData, this.dataClusterPrefab, this.dataEntryPrefab, this.dataAssetPrefab);
            await cluster.load(this.gameObject, this.context);
            
            // Register with persistent data
            if (this.persistentData) {
                cluster.registerWithPersistentData(this.persistentData);
            }
            
            this.dataClusters.push(cluster);
        }
        
        console.log(`Loaded ${this.dataClusters.length} data clusters from ${this.jsonPath}`);
        
        // Set up auto-save interval if enabled
        this.setupSaveInterval();
    }

    public unloadArchive(): void {
        if (this.debugLogging) {
            console.log("UserArchive: Unloading archive");
        }
        
        for (const cluster of this.dataClusters) {
            cluster.unload();
        }
        this.dataClusters = [];
        this.selectedDataCluster = null;
    }
    
    // Force save the current state to the JSON file
    public async saveArchive(): Promise<boolean> {
        if (!this.persistentData) {
            console.error("Cannot save archive: No persistent data interface");
            return false;
        }
        
        if (this.debugLogging) {
            console.log("UserArchive: Manually saving archive");
        }
        
        return await this.persistentData.saveData();
    }
    
    // Export the current state as JSON (useful for debugging)
    public exportArchiveAsJSON(): string {
        if (!this.persistentData) {
            console.error("Cannot export archive: No persistent data interface");
            return "{}";
        }
        
        return JSON.stringify(this.persistentData.getData(), null, 2);
    }

    // Add a method to save before page unload
    public setupBeforeUnloadSave(): void {
        window.addEventListener('beforeunload', (event) => {
            if (this.persistentData && this.persistentData['pendingChanges']) {
                if (this.debugLogging) {
                    console.log("UserArchive: Saving before page unload");
                }
                // Force a synchronous save attempt
                this.saveArchive();
                
                // This message might be shown to the user by the browser
                event.returnValue = "You have unsaved changes. Are you sure you want to leave?";
                return event.returnValue;
            }
        });
    }
}
