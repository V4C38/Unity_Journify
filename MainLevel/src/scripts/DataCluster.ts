import { AssetReference, GameObject, InstantiateOptions } from "@needle-tools/engine";
import { DataEntry } from "./DataEntry";
import { SelectableObject } from "./SelectableObject";

export class DataCluster {
  public title: string;
  public dataEntries: DataEntry[] = [];
  public prefab?: AssetReference;
  public instance: GameObject | null = null;
  public selectable: SelectableObject | null = null;
  private dataEntryPrefab?: AssetReference;
  private dataAssetPrefab?: AssetReference;

  constructor(data: any, prefab?: AssetReference, dataEntryPrefab?: AssetReference, dataAssetPrefab?: AssetReference) {
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

  public async load(parent: GameObject, context: any): Promise<void> {
    if (this.prefab) {
      const options = new InstantiateOptions();
      options.context = context;
      this.instance = await this.prefab.instantiateSynced(options) as GameObject;
      parent.add(this.instance);
    } else {
      console.error("No prefab provided for DataCluster:", this.title);
      return;
    }
    this.selectable = this.instance.addComponent(SelectableObject);
    for (const entry of this.dataEntries) {
      await entry.load(this.instance, context);
    }
  }

  public unload(): void {
    for (const entry of this.dataEntries) {
      entry.unload();
    }
    this.instance?.destroy();
    this.instance = null;
  }
}
