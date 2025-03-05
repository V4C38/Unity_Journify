import { AssetReference, GameObject, InstantiateOptions } from "@needle-tools/engine";
import { DataAsset } from "./DataAsset";
import { SelectableObject } from "./SelectableObject";

export class DataEntry {
  public title: string;
  public dataAssets: DataAsset[] = [];
  public prefab?: AssetReference;
  public instance: GameObject | null = null;
  public selectable: SelectableObject | null = null;
  private dataAssetPrefab?: AssetReference;
  public location: number[] | null = null;

  constructor(data: any, prefab?: AssetReference, dataAssetPrefab?: AssetReference) {
    this.title = data.Title;
    this.prefab = prefab;
    this.dataAssetPrefab = dataAssetPrefab;
    this.location = data.Location || null;
    if (data.DataAssets) {
      for (const assetData of data.DataAssets) {
        this.dataAssets.push(new DataAsset(assetData, this.dataAssetPrefab));
      }
    }
  }

  public async load(parent: GameObject, context: any): Promise<void> {
    if (this.prefab) {
      const options = new InstantiateOptions();
      options.context = context;
      this.instance = await this.prefab.instantiateSynced(options) as GameObject;
      parent.add(this.instance);
      
      // Set the position of the instance based on the location property
      if (this.location && this.instance) {
        this.instance.position.set(this.location[0], this.location[1], this.location[2]);
      }
    } else {
      console.error("No prefab provided for DataEntry:", this.title);
      return;
    }
    this.selectable = this.instance.addComponent(SelectableObject);
    for (const asset of this.dataAssets) {
      await asset.load(this.instance, context);
    }
  }

  public unload(): void {
    for (const asset of this.dataAssets) {
      asset.unload();
    }
    this.instance?.destroy();
    this.instance = null;
  }
}
