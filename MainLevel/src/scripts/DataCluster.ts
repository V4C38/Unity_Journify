import { AssetReference, GameObject, InstantiateOptions, Behaviour } from "@needle-tools/engine";
import { DataEntry } from "./DataEntry";
import { TriggerInteraction } from "./TriggerInteraction";

export class DataCluster extends Behaviour {
  public dataEntries: DataEntry[] = [];
  public selectedDataEntry: DataEntry | null = null;
  declare public gameObject: GameObject;  // Using declare to avoid overwriting base property
  private prefab: AssetReference;
  private dataEntryPrefab: AssetReference;
  private dataAssetPrefab: AssetReference;
  
  private uuid: string = "";
  private title: string = "";
  private _isActive: boolean = true; // Active by default, right now there will only be one cluster
  private entryIds: Map<DataEntry, string> = new Map();

  constructor(prefab: AssetReference, dataEntryPrefab: AssetReference, dataAssetPrefab: AssetReference) {
    super();
    if (!prefab || !dataEntryPrefab || !dataAssetPrefab) {
      throw new Error("[DataCluster] All prefabs (cluster, entry, asset) are required in constructor");
    }
    this.prefab = prefab;
    this.dataEntryPrefab = dataEntryPrefab;
    this.dataAssetPrefab = dataAssetPrefab;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public get id(): string {
    return this.uuid;
  }

  public get name(): string {
    return this.title;
  }

  public set isActive(value: { newState: boolean; animate: boolean }) {
    console.log(`[DataCluster] ${this.title} - Setting active state to ${value.newState}`);
    this._isActive = value.newState;
    for (const entry of this.dataEntries) {
      entry.isActive = { newState: value.newState, animate: value.animate };
    }
  }

  public async load(uuid: string, title: string, dataEntries: DataEntry[]): Promise<void> {
    if (!this.prefab) {
      console.error("[DataCluster] No prefab set for DataCluster");
      return;
    }

    this.uuid = uuid;
    this.title = title;
    console.log(`[DataCluster] Loading cluster "${title}" (${uuid})`);

    // Instantiate the prefab
    const options = new InstantiateOptions();
    options.context = this.context;
    this.gameObject = await this.prefab.instantiateSynced(options) as GameObject;

    // Load all data entries
    for (const entry of dataEntries) {
      await this.addDataEntry(entry);
    }
    console.log(`[DataCluster] Cluster "${title}" loaded with ${dataEntries.length} entries`);
  }

  public async unload(): Promise<void> {
    console.log(`[DataCluster] Unloading cluster "${this.title}"`);
    // Unload all data entries
    for (const entry of this.dataEntries) {
      await entry.unload();
    }
    this.dataEntries = [];
    this.selectedDataEntry = null;
    this.entryIds.clear();

    // Destroy the game object
    if (this.gameObject) {
      this.gameObject.destroy();
    }
    console.log(`[DataCluster] Cluster "${this.title}" unloaded`);
  }

  public async addDataEntry(dataEntry: DataEntry, transform?: any): Promise<void> {
    this.dataEntries.push(dataEntry);
    if (this.gameObject) {
      // Generate a unique ID
      const entryId = Math.random().toString(36).substring(7);
      this.entryIds.set(dataEntry, entryId);

      // Use provided transform or default to origin
      const entryTransform = transform || {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      };

      await dataEntry.load(entryId, entryTransform, []);
      console.log(`[DataCluster] Added new entry (${entryId}) to cluster "${this.title}"`);

      // Set up selection change handler
      if (dataEntry.triggerInteraction) {
        dataEntry.triggerInteraction.onSelectionStateChanged.addEventListener((event) => {
          this.onSelectedDataEntryChanged(dataEntry);
        });
      }
    }
  }

  public async removeDataEntry(dataEntry: DataEntry): Promise<void> {
    const index = this.dataEntries.indexOf(dataEntry);
    if (index !== -1) {
      const entryId = this.entryIds.get(dataEntry);
      if (this.selectedDataEntry === dataEntry) {
        this.selectedDataEntry = null;
      }
      await dataEntry.unload();
      this.dataEntries.splice(index, 1);
      this.entryIds.delete(dataEntry);
      console.log(`[DataCluster] Removed entry (${entryId}) from cluster "${this.title}"`);
    }
  }

  public getDataEntry(id: string): DataEntry | undefined {
    for (const [entry, entryId] of this.entryIds) {
      if (entryId === id) {
        return entry;
      }
    }
    return undefined;
  }

  public getSelectedDataEntry(): DataEntry | null {
    return this.selectedDataEntry;
  }

  private onSelectedDataEntryChanged(selectedEntry: DataEntry): void {
    const entryId = this.entryIds.get(selectedEntry);
    console.log(`[DataCluster] Selected entry changed to ${entryId} in cluster "${this.title}"`);
    this.selectedDataEntry = selectedEntry;
    
    // Deactivate all other entries
    for (const entry of this.dataEntries) {
      if (entry !== selectedEntry) {
        entry.isActive = { newState: false, animate: true };
      }
    }
  }

  public async createDataEntry(): Promise<DataEntry> {
    const entry = new DataEntry(this.dataEntryPrefab, this.dataAssetPrefab);
    this.gameObject.addComponent(entry);
    return entry;
  }
}

