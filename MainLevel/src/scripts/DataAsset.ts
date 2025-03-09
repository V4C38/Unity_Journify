import { GameObject, AssetReference, InstantiateOptions, Behaviour } from "@needle-tools/engine";

export class DataAsset extends Behaviour {
  public uuid: string = "";
  public prompt: string = "";
  declare public gameObject: GameObject;  // Using declare to avoid overwriting base property
  private prefab: AssetReference;
  public modelURL: string = "";

  private _isActive: boolean = false;
  private modelInstance: GameObject | null = null;

  constructor(prefab: AssetReference) {
    super();
    if (!prefab) {
      throw new Error("[DataAsset] Prefab is required in constructor");
    }
    this.prefab = prefab;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public set isActive(value: { newState: boolean; animate: boolean }) {
    if (this._isActive === value.newState) {
      return;
    }
    
    console.log(`[DataAsset] ${this.uuid} - Setting active state to ${value.newState}`);
    this._isActive = value.newState;
    
    // Set visibility for both the container and the model instance
    if (this.gameObject) {
      this.gameObject.visible = value.newState;
    }
    if (this.modelInstance) {
      this.modelInstance.visible = value.newState;
    }
  }

  public get activeInHierarchy(): boolean {
    return this._isActive && this.gameObject?.parent != null;
  }

  // This is called from DataEntry with the data to create the asset
  public async load(context: any, transform: any, modelURL: string): Promise<void> {
    console.log(`[DataAsset] Loading asset with model URL: ${modelURL}`);
    this.modelURL = modelURL;

    // First, instantiate the prefab
    if (!this.prefab) {
      console.error("[DataAsset] No prefab set for DataAsset");
      throw new Error("No prefab set for DataAsset");
    }

    try {
      const options = new InstantiateOptions();
      options.context = context;
      console.log("[DataAsset] Attempting to instantiate prefab...");
      this.gameObject = await this.prefab.instantiateSynced(options) as GameObject;
      
      // Set initial visibility state
      this.gameObject.visible = this._isActive;
      console.log("[DataAsset] Prefab instantiated successfully");

      // Load the model from URL if provided
      if (this.modelURL) {
        try {
          console.log(`[DataAsset] Creating AssetReference for model URL: ${this.modelURL}`);
          const modelAsset = AssetReference.getOrCreate(this.modelURL, this.modelURL, context);
          if (!modelAsset) {
            throw new Error("Failed to create AssetReference for model");
          }

          const modelOptions = new InstantiateOptions();
          modelOptions.context = context;
          
          console.log("[DataAsset] Attempting to instantiate model...");
          this.modelInstance = await modelAsset.instantiate(modelOptions) as GameObject;
          if (!this.modelInstance) {
            throw new Error("Model instantiation returned null");
          }

          this.gameObject.add(this.modelInstance);
          
          // Set initial visibility state for model instance
          this.modelInstance.visible = this._isActive;
          
          // Reset the model's local transform
          this.modelInstance.position.set(0, 0, 0);
          this.modelInstance.rotation.set(0, 0, 0);
          this.modelInstance.scale.set(1, 1, 1);

          // Apply transform data after model is loaded and added
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
                transform.rotation[0] * (Math.PI / 180), // Convert from degrees to radians
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

          console.log(`[DataAsset] Model loaded successfully: ${modelURL}`);
        } catch (error) {
          console.error(`[DataAsset] Failed to load model from URL: ${modelURL}`, error);
          throw error;
        }
      } else {
        console.warn("[DataAsset] No model URL provided");
      }
    } catch (error) {
      console.error("[DataAsset] Failed to load asset:", error);
      throw error;
    }
  }

  // this is called when the asset is removed from the scene
  public async unload(): Promise<void> {
    console.log(`[DataAsset] Unloading asset with model URL: ${this.modelURL}`);
    if (this.modelInstance) {
      this.gameObject.remove(this.modelInstance);
      this.modelInstance.destroy();
      this.modelInstance = null;
    }

    if (this.gameObject) {
      this.gameObject.destroy();
    }
    console.log(`[DataAsset] Asset unloaded successfully`);
  }
  
}