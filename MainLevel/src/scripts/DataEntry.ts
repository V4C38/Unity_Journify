import { AssetReference, GameObject, InstantiateOptions, Behaviour } from "@needle-tools/engine";
import { DataAsset } from "./DataAsset";
import { TriggerInteraction } from "./TriggerInteraction";

export class DataEntry extends Behaviour {
  public dataAssets: DataAsset[] = [];
  declare public gameObject: GameObject;  // Using declare to avoid overwriting base property
  private prefab: AssetReference;
  private dataAssetPrefab: AssetReference;
  
  public triggerInteraction: TriggerInteraction | null = null;
  private transform: any = null;
  private uuid: string = "";

  private _isActive: boolean = false;

  constructor(prefab: AssetReference, dataAssetPrefab: AssetReference) {
    super();
    if (!prefab || !dataAssetPrefab) {
      throw new Error("[DataEntry] Both prefab and dataAssetPrefab are required in constructor");
    }
    this.prefab = prefab;
    this.dataAssetPrefab = dataAssetPrefab;
  }

  public get id(): string {
    return this.uuid;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  // when the triggerInteraction is selected, set isActive to true / false if unselected
  public set isActive(value: { newState: boolean; animate: boolean }) {
    if (this._isActive === value.newState) {
      return;
    }
    
    console.log(`[DataEntry] ${this.uuid} - Setting active state to ${value.newState}`);
    this._isActive = value.newState;
    
    // Update all data assets
    for (const asset of this.dataAssets) {
      asset.isActive = value;
    }
  }

  public async load(uuid: string, transform: any, dataAssets: DataAsset[]): Promise<void> {
    if (!this.prefab) {
      console.error("[DataEntry] No prefab set for DataEntry");
      return;
    }

    console.log(`[DataEntry] Loading entry ${uuid}`);
    this.uuid = uuid;
    this.transform = transform;

    // Instantiate the prefab
    const options = new InstantiateOptions();
    options.context = this.context;
    this.gameObject = await this.prefab.instantiateSynced(options) as GameObject;

    // Apply transform if provided
    if (transform) {
      if (transform.position) {
        this.gameObject.position.set(
          transform.position[0],
          transform.position[1],
          transform.position[2]
        );
      }
      if (transform.rotation) {
        this.gameObject.rotation.set(
          transform.rotation[0] * (Math.PI / 180),
          transform.rotation[1] * (Math.PI / 180),
          transform.rotation[2] * (Math.PI / 180)
        );
      }
      if (transform.scale) {
        this.gameObject.scale.set(
          transform.scale[0],
          transform.scale[1],
          transform.scale[2]
        );
      }
    }

    // Add TriggerInteraction component
    this.triggerInteraction = this.gameObject.addComponent(TriggerInteraction);
    const selectionHandler = (event: { isSelected: boolean }) => {
      this.isActive = { newState: event.isSelected, animate: true };
    };
    this.triggerInteraction.onSelectionStateChanged.addEventListener(selectionHandler);

    // Load all data assets
    this.dataAssets = dataAssets;
    for (const asset of this.dataAssets) {
      // Create a transform for the asset based on its current position in the array
      const assetTransform = {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      };
      await asset.load(this.context, assetTransform, asset.modelURL);
    }
    console.log(`[DataEntry] Entry ${uuid} loaded with ${dataAssets.length} assets`);
  }

  public async unload(): Promise<void> {
    console.log(`[DataEntry] Unloading entry ${this.uuid}`);
    // Unload all data assets
    for (const asset of this.dataAssets) {
      await asset.unload();
    }
    this.dataAssets = [];

    // Clean up trigger interaction
    if (this.triggerInteraction) {
      this.triggerInteraction.onSelectionStateChanged.removeAllEventListeners();
      this.triggerInteraction = null;
    }

    // Destroy the game object
    if (this.gameObject) {
      this.gameObject.destroy();
    }
    console.log(`[DataEntry] Entry ${this.uuid} unloaded`);
  }

  public async addDataAsset(dataAsset: DataAsset): Promise<void> {
    this.dataAssets.push(dataAsset);
    
    // Only load if not already loaded
    if (!dataAsset.gameObject) {
      // Create a transform for the new asset
      const assetTransform = {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      };
      await dataAsset.load(this.context, assetTransform, dataAsset.modelURL);
    }
    
    dataAsset.isActive = { newState: this._isActive, animate: true };
    console.log(`[DataEntry] Added new asset to entry ${this.uuid}`);
  }

  public async removeDataAsset(dataAsset: DataAsset): Promise<void> {
    const index = this.dataAssets.indexOf(dataAsset);
    if (index !== -1) {
      await dataAsset.unload();
      this.dataAssets.splice(index, 1);
      console.log(`[DataEntry] Removed asset from entry ${this.uuid}`);
    }
  }

  public async createDataAsset(): Promise<DataAsset> {
    const asset = new DataAsset(this.dataAssetPrefab);
    // Only add the component if it's not already added
    if (!this.gameObject.getComponent(DataAsset)) {
      this.gameObject.addComponent(asset);
    }
    return asset;
  }
}

