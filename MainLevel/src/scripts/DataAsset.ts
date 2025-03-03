import { GameObject, AssetReference, InstantiateOptions } from "@needle-tools/engine";

export class DataAsset {
  public title: string;
  public prompt: string;
  public transformData: { position: number[]; rotation: number[]; scale: number[] };
  public url: string;
  public instance: GameObject | null = null;

  constructor(data: any) {
    this.title = data.Title;
    this.prompt = data.Prompt;
    this.transformData = data.transform;
    this.url = data.URL;
  }

  public async load(parent: GameObject, context: any): Promise<void> {
    const asset = AssetReference.getOrCreate(this.url, this.url, context);
    const options = new InstantiateOptions();
    options.context = context;
    this.instance = await asset.instantiate(options) as GameObject;
    parent.add(this.instance);
    const obj3D = this.instance as any;
    if (obj3D.transform) {
      if (this.transformData.position) obj3D.transform.position.set(...this.transformData.position);
      if (this.transformData.rotation) obj3D.transform.rotation.set(...this.transformData.rotation);
      if (this.transformData.scale) obj3D.transform.scale.set(...this.transformData.scale);
    }
  }

  public unload(): void {
    this.instance?.destroy();
    this.instance = null;
  }
}
