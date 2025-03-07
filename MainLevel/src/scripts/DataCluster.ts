import { AssetReference, GameObject, InstantiateOptions, Behaviour } from "@needle-tools/engine";
import { DataEntry, EntrySelectedEvent } from "./DataEntry";
import { SelectableObject } from "./SelectableObject";
import { IPersistable, PersistentDataInterface } from "./PersistentDataInterface";

export class DataCluster extends Behaviour implements IPersistable {
  public uuid: string;
  public title: string;
  public dataEntries: DataEntry[] = [];
  public prefab?: AssetReference;
  public instance: GameObject | null = null;
  public selectable: SelectableObject | null = null;
  private dataEntryPrefab?: AssetReference;
  private dataAssetPrefab?: AssetReference;
  private persistentData: PersistentDataInterface | null = null;

  constructor(data: any, prefab?: AssetReference, dataEntryPrefab?: AssetReference, dataAssetPrefab?: AssetReference) {
    super();
    this.uuid = data.UUID || "";
    this.title = data.Title;
    this.prefab = prefab;
    this.dataEntryPrefab = dataEntryPrefab;
    this.dataAssetPrefab = dataAssetPrefab;
    if (data.DataEntries) {
      for (const entryData of data.DataEntries) {
        this.dataEntries.push(new DataEntry(entryData, this.dataEntryPrefab, this.dataAssetPrefab));
      }
    }
  }
  
  // Register with the persistent data interface
  public registerWithPersistentData(persistentData: PersistentDataInterface): void {
    this.persistentData = persistentData;
    persistentData.registerObject(this);
    
    // Register all data entries
    for (const entry of this.dataEntries) {
      entry.registerWithPersistentData(persistentData);
    }
  }
  
  // Implement IPersistable interface
  public getSerializableData(): any {
    // Get serializable data for all entries
    const dataEntries = this.dataEntries.map(entry => {
      return entry.getSerializableData();
    });
    
    return {
      UUID: this.uuid,
      Title: this.title,
      DataEntries: dataEntries
    };
  }
  
  // Update from data
  public updateFromData(data: any): void {
    if (data.Title) this.title = data.Title;
    
    // Update data entries if provided
    if (data.DataEntries) {
      // Match entries by UUID
      for (const entryData of data.DataEntries) {
        const entry = this.dataEntries.find(e => e.uuid === entryData.UUID);
        if (entry) {
          entry.updateFromData(entryData);
        }
      }
    }
  }

  public async load(parent: GameObject, context: any): Promise<void> {
    console.log(`DataCluster: Loading cluster "${this.title}" with UUID ${this.uuid}`);
    console.log(`DataCluster: Number of data entries: ${this.dataEntries.length}`);
    
    if (this.prefab) {
      const options = new InstantiateOptions();
      options.context = context;
      this.instance = await this.prefab.instantiateSynced(options) as GameObject;
      parent.add(this.instance);
      console.log(`DataCluster: Successfully instantiated prefab for "${this.title}"`);
    } else {
      console.error("No prefab provided for DataCluster:", this.title);
      return;
    }

    this.selectable = this.instance.addComponent(SelectableObject);
    
    // Set up event listeners for entry selection
    for (const entry of this.dataEntries) {
      console.log(`DataCluster: Loading entry "${entry.title}" with UUID ${entry.uuid}`);
      await entry.load(this.instance, context);
      entry.onSelected.addEventListener(this.handleEntrySelected);
      
      // Register with persistent data if available
      if (this.persistentData) {
        entry.registerWithPersistentData(this.persistentData);
      }
    }
    
    console.log(`DataCluster: Finished loading cluster "${this.title}"`);
  }
  
  // Handle entry selection
  private handleEntrySelected = (event: EntrySelectedEvent): void => {
    // When an entry is selected, update our data
    if (this.persistentData && this.uuid) {
      this.persistentData.updateObjectData(this.uuid);
    }
    
    // Manage which entries are active
    if (event.isSelected) {
      // When an entry is selected, deactivate all other entries
      for (const entry of this.dataEntries) {
        if (entry !== event.entry && entry.isActive) {
          entry.isActive = false;
        }
      }
    }
  };

  public unload(): void {
    // Unregister from persistent data
    if (this.persistentData && this.uuid) {
      this.persistentData.unregisterObject(this.uuid);
      this.persistentData = null;
    }
    
    for (const entry of this.dataEntries) {
      entry.onSelected.removeEventListener(this.handleEntrySelected);
      entry.unload();
    }
    this.instance?.destroy();
    this.instance = null;
  }
}

