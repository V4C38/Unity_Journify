import { Behaviour, serializable, AssetReference } from "@needle-tools/engine";
import { DataCluster } from "./DataCluster";
import { DataEntry } from "./DataEntry";
import { PersistentDataInterface } from "./PersistentDataInterface";
import { Material } from "three";

export class UserArchive extends Behaviour {
    @serializable(AssetReference)
    public dataClusterPrefab?: AssetReference;
    
    @serializable(AssetReference)
    public dataEntryPrefab?: AssetReference;
    
    @serializable(AssetReference)
    public dataAssetPrefab?: AssetReference;

    @serializable(Material)
    public activeMaterial?: Material;

    @serializable(Material)
    public inactiveMaterial?: Material;

    private dataClusters: DataCluster[] = [];
    public selectedDataCluster: DataCluster | null = null;
    private persistentData: PersistentDataInterface | null = null;
    
    private autoSaveInterval: number | null = null;
    private readonly AUTOSAVE_DELAY = 10000; // 10 seconds in milliseconds

    start() {
        if (!this.dataClusterPrefab || !this.dataEntryPrefab || !this.dataAssetPrefab) {
            console.error("[UserArchive] All prefabs must be set in Unity Inspector");
            return;
        }
        console.log("[UserArchive] Starting archive initialization");
        this.loadArchive();
        this.startAutoSave();
    }

    onDestroy() {
        this.stopAutoSave();
    }

    private startAutoSave() {
        if (this.autoSaveInterval !== null) {
            return;
        }
        console.log("[UserArchive] Starting autosave (10s interval)");
        this.autoSaveInterval = window.setInterval(() => {
            this.saveArchive();
        }, this.AUTOSAVE_DELAY);
    }

    private stopAutoSave() {
        if (this.autoSaveInterval !== null) {
            window.clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
            console.log("[UserArchive] Autosave stopped");
        }
    }

    public async createDataCluster(): Promise<DataCluster> {
        if (!this.dataClusterPrefab || !this.dataEntryPrefab || !this.dataAssetPrefab) {
            throw new Error("[UserArchive] All prefabs must be set before creating a cluster");
        }
        const cluster = new DataCluster(this.dataClusterPrefab, this.dataEntryPrefab, this.dataAssetPrefab);
        cluster.setMaterials(this.activeMaterial, this.inactiveMaterial);
        this.gameObject.addComponent(cluster);
        return cluster;
    }

    public async loadArchive(): Promise<void> {
        if (!this.dataClusterPrefab || !this.dataEntryPrefab || !this.dataAssetPrefab) {
            throw new Error("[UserArchive] All prefabs must be set before loading the archive");
        }

        console.log("[UserArchive] Loading archive...");
        this.persistentData = new PersistentDataInterface();

        const success = await this.persistentData.loadData();
        if (!success) {
            console.error("[UserArchive] Failed to load archive from API");
            return;
        }

        const jsonData = this.persistentData.getData();
        if (!jsonData || !jsonData.DataClusters) {
            console.error("[UserArchive] Invalid data format: DataClusters array is missing");
            return;
        }

        console.log(`[UserArchive] Loading ${jsonData.DataClusters.length} clusters`);
        for (const clusterData of jsonData.DataClusters) {
            const cluster = await this.createDataCluster();
            
            await cluster.load(
                clusterData.UUID,
                clusterData.Title,
                [] // We'll add entries after cluster is loaded
            );

            if (clusterData.DataEntries) {
                console.log(`[UserArchive] Loading ${clusterData.DataEntries.length} entries for cluster ${clusterData.Title}`);
                for (const entryData of clusterData.DataEntries) {
                    const entry = await cluster.createDataEntry();
                    
                    // Create transform data for the entry
                    const entryTransform = {
                        position: entryData.Location,
                        rotation: [0, 0, 0], // Default rotation as it's not in the JSON
                        scale: [1, 1, 1] // Default scale
                    };
                    
                    await cluster.addDataEntry(entry, entryTransform);

                    // Load assets for this entry if they exist
                    if (entryData.DataAssets) {
                        for (const assetData of entryData.DataAssets) {
                            const asset = await entry.createDataAsset();
                            asset.uuid = assetData.UUID;
                            asset.modelURL = assetData.URL;
                            
                            // Create transform data for loading
                            const transform = {
                                position: assetData.transform.position,
                                rotation: assetData.transform.rotation,
                                scale: [1, 1, 1]  // Default scale
                            };
                            
                            // Load the asset first
                            await asset.load(this.context, transform, assetData.URL);
                            // Then add it to the entry (which won't trigger another load since the asset is already loaded)
                            await entry.addDataAsset(asset);
                        }
                    }
                }
            }

            this.dataClusters.push(cluster);
        }

        if (this.dataClusters.length > 0) {
            this.selectedDataCluster = this.dataClusters[0];
            console.log("[UserArchive] Archive loaded successfully");
        }
    }

    public hasClusters(): boolean {
        return this.dataClusters.length > 0;
    }

    // --------------------------------------------------------------------------

    // Cluster Management will be handled in the future

    public async addNewEntry() {
        // If no cluster exists or none is selected, create a new one
        if (!this.selectedDataCluster) {
            if (!this.hasClusters()) {
                const newCluster = await this.createDataCluster();
                await newCluster.load(
                    crypto.randomUUID(),
                    "New Cluster",
                    []
                );
                this.dataClusters.push(newCluster);
            }
            this.selectedDataCluster = this.dataClusters[0];
        }

        // Create and add the new entry to the selected cluster
        const newEntry = await this.selectedDataCluster.createDataEntry();
        const entryTransform = {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
        };
        
        await this.selectedDataCluster.addDataEntry(newEntry, entryTransform);
        
        // Set the materials
        newEntry.setMaterials(this.activeMaterial || null, this.inactiveMaterial || null);
        
        // Trigger the selection through the entry's isActive property
        newEntry.isActive = { newState: true, animate: true };
    }

    public async removeSelectedEntry() {
        if (!this.selectedDataCluster) {
            console.warn("[UserArchive] No cluster selected, cannot remove entry");
            return;
        }

        const selectedEntry = this.selectedDataCluster.selectedDataEntry;
        if (!selectedEntry) {
            console.warn("[UserArchive] No entry selected to remove");
            return;
        }

        // Unload all assets in the entry
        for (const asset of selectedEntry.dataAssets) {
            await asset.unload();
        }

        // Remove the entry from the cluster
        await this.selectedDataCluster.removeDataEntry(selectedEntry);
    }
    
    // --------------------------------------------------------------------------


    public async unloadArchive(): Promise<void> {
        console.log("[UserArchive] Unloading archive...");
        for (const cluster of this.dataClusters) {
            await cluster.unload();
        }
        this.dataClusters = [];
        this.selectedDataCluster = null;

        if (this.persistentData) {
            this.persistentData.dispose();
            this.persistentData = null;
        }
        console.log("[UserArchive] Archive unloaded");
    }

    public async saveArchive(): Promise<void> {
        if (!this.persistentData) {
            console.error("[UserArchive] Cannot save archive: No persistent data interface");
            return;
        }

        console.log("[UserArchive] Saving archive...");
        const saveData = {
            UUID: crypto.randomUUID(), // Generate a unique ID for this save
            DataClusters: this.dataClusters.map(cluster => ({
                UUID: cluster.id,
                Title: cluster.name,
                DataEntries: cluster.dataEntries.map(entry => ({
                    UUID: entry.id,
                    Title: entry.name || "Untitled Entry",
                    Location: [
                        entry.gameObject.position.x,
                        entry.gameObject.position.y,
                        entry.gameObject.position.z
                    ],
                    DataAssets: entry.dataAssets.map(asset => ({
                        UUID: asset.uuid,
                        Title: asset.name || "Untitled Asset",
                        Prompt: asset.prompt,
                        transform: {
                            position: [
                                asset.gameObject.position.x,
                                asset.gameObject.position.y,
                                asset.gameObject.position.z
                            ],
                            rotation: [
                                asset.gameObject.rotation.x * (180 / Math.PI),
                                asset.gameObject.rotation.y * (180 / Math.PI),
                                asset.gameObject.rotation.z * (180 / Math.PI)
                            ]
                        },
                        URL: asset.modelURL,
                        IsActive: asset.activeInHierarchy
                    }))
                }))
            }))
        };

        await this.persistentData.saveData(saveData);
        console.log("[UserArchive] Archive saved successfully");
    }
}
