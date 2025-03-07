import { GameObject, AssetReference, InstantiateOptions, EventList, Behaviour } from "@needle-tools/engine";
import { IPersistable, ITransformData, PersistentDataInterface } from "./PersistentDataInterface";
import { Vector3 } from "three";
import { DragControls } from "@needle-tools/engine";
import { PointerEventData } from "@needle-tools/engine";

// Event for position changes
export type PositionChangeEvent = {
  asset: DataAsset;
  newPosition: Vector3;
  oldPosition: Vector3;
};

// Custom component to track position changes
export class PositionTracker extends Behaviour {
  public dataAsset: DataAsset | null = null;
  public dataEntry: any = null; // Can be DataEntry or null
  private lastPosition: Vector3 = new Vector3();
  private lastRotationX: number = 0;
  private lastRotationY: number = 0;
  private lastRotationZ: number = 0;
  private lastScale: Vector3 = new Vector3();
  private checkInterval: number = 1.0; // Check every 1 second (increased from 0.5)
  private timeSinceLastCheck: number = 0;
  private positionChangeThreshold: number = 0.05; // Minimum position change to trigger an update (5cm)
  private rotationChangeThreshold: number = 0.1; // Minimum rotation change to trigger an update (in radians, ~5.7 degrees)
  private scaleChangeThreshold: number = 0.1; // Minimum scale change to trigger an update (10%)
  
  start(): void {
    if (this.gameObject) {
      this.lastPosition.copy(this.gameObject.position);
      this.lastRotationX = this.gameObject.rotation.x;
      this.lastRotationY = this.gameObject.rotation.y;
      this.lastRotationZ = this.gameObject.rotation.z;
      this.lastScale.copy(this.gameObject.scale);
    }
  }
  
  update(): void {
    if (!this.gameObject) return;
    
    this.timeSinceLastCheck += this.context.time.deltaTime;
    
    // Only check periodically to avoid excessive updates
    if (this.timeSinceLastCheck >= this.checkInterval) {
      this.timeSinceLastCheck = 0;
      
      // Check if position has changed beyond the threshold (5cm)
      const positionChanged = 
        Math.abs(this.gameObject.position.x - this.lastPosition.x) > this.positionChangeThreshold ||
        Math.abs(this.gameObject.position.y - this.lastPosition.y) > this.positionChangeThreshold ||
        Math.abs(this.gameObject.position.z - this.lastPosition.z) > this.positionChangeThreshold;
      
      // Check if rotation has changed beyond the threshold (~5.7 degrees)
      const rotationChanged = 
        Math.abs(this.gameObject.rotation.x - this.lastRotationX) > this.rotationChangeThreshold ||
        Math.abs(this.gameObject.rotation.y - this.lastRotationY) > this.rotationChangeThreshold ||
        Math.abs(this.gameObject.rotation.z - this.lastRotationZ) > this.rotationChangeThreshold;
      
      // Check if scale has changed beyond the threshold (10%)
      const scaleChanged = 
        Math.abs(this.gameObject.scale.x - this.lastScale.x) > this.scaleChangeThreshold ||
        Math.abs(this.gameObject.scale.y - this.lastScale.y) > this.scaleChangeThreshold ||
        Math.abs(this.gameObject.scale.z - this.lastScale.z) > this.scaleChangeThreshold;
      
      if (positionChanged || rotationChanged || scaleChanged) {
        // Call the appropriate handler
        if (this.dataAsset) {
          this.dataAsset.onTransformChanged();
        } else if (this.dataEntry) {
          this.dataEntry.onPositionChanged();
        }
        
        // Update last values
        this.lastPosition.copy(this.gameObject.position);
        this.lastRotationX = this.gameObject.rotation.x;
        this.lastRotationY = this.gameObject.rotation.y;
        this.lastRotationZ = this.gameObject.rotation.z;
        this.lastScale.copy(this.gameObject.scale);
      }
    }
  }
}

// Custom component to handle pointer events
class DragEventHandler extends Behaviour {
  public dataAsset: DataAsset | null = null;
  
  onPointerUp(evt: PointerEventData): void {
    if (this.dataAsset) {
      this.dataAsset.onDragEnd();
    }
  }
}

export class DataAsset implements IPersistable {
  public uuid: string;
  public title: string;
  public prompt: string;
  public transformData: ITransformData;
  public url: string;
  public instance: GameObject | null = null;
  public prefab?: AssetReference;
  public modelInstance: GameObject | null = null;
  private persistentData: PersistentDataInterface | null = null;
  private dragControls: DragControls | null = null;
  private eventHandler: DragEventHandler | null = null;
  private positionTracker: PositionTracker | null = null;
  private transformChanged: boolean = false;
  
  // Event that fires when position changes
  public readonly onPositionChanged = new EventList<PositionChangeEvent>();

  constructor(data: any, prefab?: AssetReference) {
    this.uuid = data.UUID || "";
    this.title = data.Title;
    this.prompt = data.Prompt;
    this.transformData = data.transform;
    this.url = data.URL;
    this.prefab = prefab;
  }

  // Register with the persistent data interface
  public registerWithPersistentData(persistentData: PersistentDataInterface): void {
    this.persistentData = persistentData;
    persistentData.registerObject(this);
    
    // Set up position tracking and drag controls if we have an instance
    if (this.instance) {
      this.setupPositionTracking();
      this.setupDragControlsEvents();
    }
  }
  
  // Set up position tracking
  private setupPositionTracking(): void {
    if (!this.instance) return;
    
    // Add position tracker component
    this.positionTracker = this.instance.addComponent(PositionTracker);
    this.positionTracker.dataAsset = this;
    
    console.log(`DataAsset: Set up position tracking for "${this.title}"`);
  }
  
  // Set up drag controls event handling
  private setupDragControlsEvents(): void {
    if (!this.instance) return;
    
    // Find the DragControls component on the instance
    this.dragControls = this.instance.getComponent(DragControls);
    
    if (!this.dragControls) {
      console.warn(`No DragControls found on instance for "${this.title}"`);
      return;
    }
    
    // Add event handler component
    this.eventHandler = this.instance.addComponent(DragEventHandler);
    this.eventHandler.dataAsset = this;
  }
  
  // Called when transform changes (from PositionTracker)
  public onTransformChanged(): void {
    if (!this.instance) return;
    
    // Store old transform for logging
    const oldPosition = this.transformData.position ? [...this.transformData.position] : [0, 0, 0];
    
    // Update transform data
    this.updateTransformDataFromInstance();
    
    // Emit position changed event
    this.onPositionChanged.invoke({
      asset: this,
      newPosition: this.instance.position.clone(),
      oldPosition: new Vector3(oldPosition[0], oldPosition[1], oldPosition[2])
    });
    
    // Update persistent data
    this.saveTransformData();
  }
  
  // Called when dragging finishes
  public onDragEnd(): void {
    if (!this.instance) return;
    
    // Update transform data and save
    this.onTransformChanged();
  }
  
  // Save transform data to persistent storage
  private saveTransformData(): void {
    if (this.persistentData && this.uuid) {
      this.persistentData.updateObjectData(this.uuid);
      this.persistentData.markObjectChanged(this.uuid);
    }
  }
  
  // Implement IPersistable interface
  public getSerializableData(): any {
    // Update transform data from the current instance if available
    if (this.instance) {
      this.updateTransformDataFromInstance();
    }
    
    return {
      Title: this.title,
      Prompt: this.prompt,
      transform: this.transformData,
      URL: this.url
    };
  }
  
  // Update from data
  public updateFromData(data: any): void {
    if (data.Title) this.title = data.Title;
    if (data.Prompt) this.prompt = data.Prompt;
    if (data.transform) this.transformData = data.transform;
    if (data.URL) this.url = data.URL;
    
    // Update the instance if it exists
    if (this.instance && data.transform) {
      this.updateInstanceFromTransformData();
    }
  }
  
  // Update transform data from the instance
  private updateTransformDataFromInstance(): void {
    if (!this.instance) return;
    
    // Store absolute world position since assets are no longer parented
    this.transformData = {
      position: [
        this.instance.position.x,
        this.instance.position.y,
        this.instance.position.z
      ],
      rotation: [
        this.instance.rotation.x * (180 / Math.PI),
        this.instance.rotation.y * (180 / Math.PI),
        this.instance.rotation.z * (180 / Math.PI)
      ],
      scale: [
        this.instance.scale.x,
        this.instance.scale.y,
        this.instance.scale.z
      ]
    };
  }
  
  // Update instance from transform data
  public updateInstanceFromTransformData(): void {
    if (!this.instance || !this.transformData) return;
    
    if (this.transformData.position) {
      // Apply absolute position
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

  public async load(parent: GameObject, context: any): Promise<void> {
    // First, instantiate the prefab (which has DragControls, SelectableObject, MeshRenderer, CubeCollisions)
    if (this.prefab) {
      const options = new InstantiateOptions();
      options.context = context;
      this.instance = await this.prefab.instantiateSynced(options) as GameObject;
      
      // Add the instance to the scene root instead of the parent
      // This makes it a standalone object
      context.scene.add(this.instance);
    } else {
      console.error("No prefab provided for DataAsset:", this.title);
      return;
    }
    
    // Apply transform data (position, rotation, scale)
    if (this.transformData) {
      this.updateInstanceFromTransformData();
    } else {
      // If no transform data, set to default position (near parent's position)
      const parentPosition = parent.position.clone();
      this.instance.position.copy(parentPosition);
    }
    
    // Now load the model from the URL and parent it to the prefab instance
    if (this.url) {
      try {
        const modelAsset = AssetReference.getOrCreate(this.url, this.url, context);
        const modelOptions = new InstantiateOptions();
        modelOptions.context = context;
        this.modelInstance = await modelAsset.instantiate(modelOptions) as GameObject;
        
        // Parent the model to the prefab instance
        this.instance.add(this.modelInstance);
        
        // Reset the model's local position, rotation, and scale
        // This ensures it's positioned correctly relative to the prefab
        this.modelInstance.position.set(0, 0, 0);
        this.modelInstance.rotation.set(0, 0, 0);
        this.modelInstance.scale.set(1, 1, 1);
      } catch (error) {
        console.error(`Failed to load model from URL: ${this.url} for DataAsset: ${this.title}`, error);
      }
    }
    
    // Set up position tracking and drag controls if we have a persistent data interface
    if (this.persistentData) {
      this.setupPositionTracking();
      this.setupDragControlsEvents();
    }
  }

  public unload(): void {
    // Unregister from persistent data
    if (this.persistentData && this.uuid) {
      this.persistentData.unregisterObject(this.uuid);
      this.persistentData = null;
    }
    
    // The modelInstance will be automatically destroyed when the instance is destroyed
    // because it's a child of the instance
    this.instance?.destroy();
    this.instance = null;
    this.modelInstance = null;
    this.dragControls = null;
    this.eventHandler = null;
    this.positionTracker = null;
  }
}