import { GameObject, AssetReference, InstantiateOptions } from "@needle-tools/engine";

export class DataAsset {
  public title: string;
  public prompt: string;
  public transformData: { position: number[]; rotation: number[]; scale: number[] };
  public url: string;
  public instance: GameObject | null = null;
  public prefab?: AssetReference;

  constructor(data: any, prefab?: AssetReference) {
    this.title = data.Title;
    this.prompt = data.Prompt;
    this.transformData = data.transform;
    this.url = data.URL;
    this.prefab = prefab;
  }

  public async load(parent: GameObject, context: any): Promise<void> {
    if (this.prefab) {
      const options = new InstantiateOptions();
      options.context = context;
      this.instance = await this.prefab.instantiateSynced(options) as GameObject;
    } else {
      // Fallback to the old method if no prefab is provided
      const asset = AssetReference.getOrCreate(this.url, this.url, context);
      const options = new InstantiateOptions();
      options.context = context;
      this.instance = await asset.instantiate(options) as GameObject;
    }
    
    parent.add(this.instance);
    
    // In Needle Engine, position/rotation/scale are properties directly on the GameObject/Object3D
    if (this.transformData.position) {
      this.instance.position.set(
        this.transformData.position[0],
        this.transformData.position[1],
        this.transformData.position[2]
      );
    }
    
    if (this.transformData.rotation) {
      this.instance.rotation.set(
        this.transformData.rotation[0] * (Math.PI / 180),
        this.transformData.rotation[1] * (Math.PI / 180),
        this.transformData.rotation[2] * (Math.PI / 180)
      );
    }
    
    if (this.transformData.scale) {
      this.instance.scale.set(
        this.transformData.scale[0],
        this.transformData.scale[1],
        this.transformData.scale[2]
      );
    }
  }

  public unload(): void {
    this.instance?.destroy();
    this.instance = null;
  }
}
