import { GameObject, AssetReference, InstantiateOptions, EventList, Behaviour } from "@needle-tools/engine";
import { IPersistable, ITransformData, PersistentDataInterface } from "./PersistentDataInterface";
import { Vector3, Object3D } from "three";
import { DragControls } from "@needle-tools/engine";
import { PointerEventData } from "@needle-tools/engine";
import * as TWEEN from "three/examples/jsm/libs/tween.module.js";

// Event for position changes
export type PositionChangeEvent = {
  asset: DataAsset;
  newPosition: Vector3;
  oldPosition: Vector3;
};

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
  private transformChanged: boolean = false;
  private handleDragEnd: ((dragControls: DragControls, object: Object3D, eventData: PointerEventData | null) => void) | null = null;
  private visibilityTween: TWEEN.Tween<any> | null = null;
  private targetScale: Vector3 = new Vector3(1, 1, 1);
  
  private _isActive: boolean = true;

  public get isActive(): boolean {
    return this._isActive;
  }

  public set isActive(value: boolean) {
    if (this._isActive !== value) {
      this._isActive = value;
      
      // Update instance visibility if it exists
      if (this.instance) {
        this.instance.visible = value;
      }
      
      // Update persistent data if active state changes
      if (this.persistentData && this.uuid) {
        this.persistentData.updateObjectData(this.uuid);
      }
    }
  }
  
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
    
    // Set up drag controls if we have an instance
    if (this.instance) {
      this.setupDragControlsEvents();
    }
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
    
    // Add event handler component if it doesn't exist
    if (!this.eventHandler) {
      this.eventHandler = this.instance.addComponent(DragEventHandler);
      this.eventHandler.dataAsset = this;
    }
  }
  
  // Called when transform changes
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
    
    // Create a copy of transform data without scale for serialization
    const transformDataForSerialization = {
      position: this.transformData.position,
      rotation: this.transformData.rotation
      // Intentionally omitting scale as requested
    };
    
    return {
      UUID: this.uuid,
      Title: this.title,
      Prompt: this.prompt,
      transform: transformDataForSerialization,
      URL: this.url,
      IsActive: this._isActive
    };
  }
  
  // Update from data
  public updateFromData(data: any): void {
    if (data.Title) this.title = data.Title;
    if (data.Prompt) this.prompt = data.Prompt;
    if (data.transform) this.transformData = data.transform;
    if (data.URL) this.url = data.URL;
    
    // For backward compatibility, handle IsActive if present
    if (data.IsActive !== undefined) {
      this._isActive = data.IsActive;
      
      // Update instance visibility if it exists
      if (this.instance) {
        this.instance.visible = this._isActive;
      }
    }
    
    // Update the instance if it exists
    if (this.instance && data.transform) {
      this.updateInstanceFromTransformData();
      
      // Store the target scale from the transform data
      if (data.transform.scale) {
        this.targetScale = new Vector3(
          data.transform.scale[0],
          data.transform.scale[1],
          data.transform.scale[2]
        );
      }
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
      // Still track scale internally but don't save it to JSON
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
      
      // Store the target scale from the transform data
      if (this.transformData.scale) {
        this.targetScale = new Vector3(
          this.transformData.scale[0],
          this.transformData.scale[1],
          this.transformData.scale[2]
        );
      }
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
    
    // Set up drag controls if we have a persistent data interface
    if (this.persistentData) {
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
  }

  /**
   * Sets the active state of the asset with animation
   * @param active Whether the asset should be active
   * @param duration Animation duration in seconds
   */
  public setIsActiveWithAnimation(active: boolean, duration: number = 0.5): void {
    if (!this.instance) return;
    
    // Update the isActive property
    this._isActive = active;
    
    // Cancel any existing animation
    if (this.visibilityTween) {
      this.visibilityTween.stop();
      this.visibilityTween = null;
    }
    
    // If we're showing the asset
    if (active) {
      // Make it visible immediately
      this.instance.visible = true;
      
      // Create a scale-up animation
      const currentScale = this.instance.scale.clone();
      const targetScaleObj = { 
        x: this.targetScale.x, 
        y: this.targetScale.y, 
        z: this.targetScale.z 
      };
      
      this.visibilityTween = new TWEEN.Tween({ 
        x: currentScale.x, 
        y: currentScale.y, 
        z: currentScale.z 
      })
        .to(targetScaleObj, duration * 1000)
        .easing(TWEEN.Easing.Elastic.Out)
        .onUpdate((obj) => {
          if (this.instance) {
            this.instance.scale.set(obj.x, obj.y, obj.z);
          }
        })
        .start();
    } 
    // If we're hiding the asset
    else {
      // Create a scale-down animation
      const currentScale = this.instance.scale.clone();
      
      this.visibilityTween = new TWEEN.Tween({ 
        x: currentScale.x, 
        y: currentScale.y, 
        z: currentScale.z 
      })
        .to({ x: 0, y: 0, z: 0 }, duration * 1000)
        .easing(TWEEN.Easing.Back.In)
        .onUpdate((obj) => {
          if (this.instance) {
            this.instance.scale.set(obj.x, obj.y, obj.z);
          }
        })
        .onComplete(() => {
          // Hide the asset after the animation completes
          if (this.instance) {
            this.instance.visible = false;
          }
        })
        .start();
    }
    
    // Make sure TWEEN updates are called
    const updateTween = () => {
      TWEEN.update();
      if (this.visibilityTween) {
        requestAnimationFrame(updateTween);
      }
    };
    requestAnimationFrame(updateTween);
  }
  
  /**
   * @deprecated Use setIsActiveWithAnimation instead
   */
  public setVisibilityWithAnimation(visible: boolean, duration: number = 0.5): void {
    this.setIsActiveWithAnimation(visible, duration);
  }
}