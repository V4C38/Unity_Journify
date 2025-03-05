import { Behaviour, serializable, AssetReference, GameObject } from "@needle-tools/engine";
import { DataCluster } from "./DataCluster";

export class UserArchive extends Behaviour {
    @serializable()
    public jsonPath: string = "UserArchive.json"; // Place in MainLevel folder

    @serializable(AssetReference)
    public dataClusterPrefab?: AssetReference;

    @serializable(AssetReference)
    public dataEntryPrefab?: AssetReference;

    @serializable(AssetReference)
    public dataAssetPrefab?: AssetReference;

    private dataClusters: DataCluster[] = [];
    public selectedDataCluster: DataCluster | null = null;

    start() {
        this.loadArchive();
    }

    public async loadArchive(): Promise<void> {
        const response = await fetch(this.jsonPath);
        const jsonData = await response.json();
        for (const clusterData of jsonData.DataClusters) {
            const cluster = new DataCluster(clusterData, this.dataClusterPrefab, this.dataEntryPrefab, this.dataAssetPrefab);
            await cluster.load(this.gameObject, this.context);
            this.dataClusters.push(cluster);
        }
    }

    public unloadArchive(): void {
        for (const cluster of this.dataClusters) {
        cluster.unload();
        }
        this.dataClusters = [];
        this.selectedDataCluster = null;
    }
}
