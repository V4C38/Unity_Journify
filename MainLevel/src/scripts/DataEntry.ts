import { AssetReference, GameObject, InstantiateOptions, syncField, EventList, Behaviour } from "@needle-tools/engine";
import { DataAsset, PositionChangeEvent } from "./DataAsset";
import { SelectableObject } from "./SelectableObject";
import { IPersistable, PersistentDataInterface } from "./PersistentDataInterface";
import { Vector3 } from "three";
import { DragControls } from "@needle-tools/engine";
import { PointerEventData } from "@needle-tools/engine";

// Define the event type for entry selection
export type EntrySelectedEvent = {
  entry: DataEntry;
  isSelected: boolean;
};

// Custom component to handle pointer events for DataEntry
class EntryDragEventHandler extends Behaviour {
  public dataEntry: DataEntry | null = null;
  
  onPointerUp(evt: PointerEventData): void {
    if (this.dataEntry) {
      this.dataEntry.onDragEnd();
    }
  }
}

export class DataEntry implements IPersistable {
  public uuid: string;
  public title: string;
  public dataAssets: DataAsset[] = [];
  public prefab?: AssetReference;
  public instance: GameObject | null = null;
  public selectable: SelectableObject | null = null;
  private dataAssetPrefab?: AssetReference;
  public location: number[] | null = null;
  private persistentData: PersistentDataInterface | null = null;
  private positionChanged: boolean = false;
  private dragControls: DragControls | null = null;
  private eventHandler: EntryDragEventHandler | null = null;

  // Event that fires when this entry is selected
  public readonly onSelected = new EventList<EntrySelectedEvent>();

  private _isActive: boolean = false;

  public get isActive(): boolean {
    return this._isActive;
  }

  public set isActive(value: boolean) {
    if (this._isActive !== value) {
      this._isActive = value;
      this.updateAssetsVisibility();
      
      // Update persistent data if active state changes
      if (this.persistentData && this.uuid) {
        this.persistentData.updateObjectData(this.uuid);
      }
    }
  }

  constructor(data: any, prefab?: AssetReference, dataAssetPrefab?: AssetReference) {
    this.uuid = data.UUID || "";
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
  
  // Register with the persistent data interface
  public registerWithPersistentData(persistentData: PersistentDataInterface): void {
    this.persistentData = persistentData;
    persistentData.registerObject(this);
    
    // Register all data assets
    for (const asset of this.dataAssets) {
      asset.registerWithPersistentData(persistentData);
      
      // Listen for position changes on assets
      asset.onPositionChanged.addEventListener(this.handleAssetPositionChanged);
    }
    
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
      this.eventHandler = this.instance.addComponent(EntryDragEventHandler);
      this.eventHandler.dataEntry = this;
    }
  }
  
  // Called when position changes
  public onPositionChanged(): void {
    if (!this.instance || !this.location) return;
    
    // Get current position
    const currentPosition = [
      this.instance.position.x,
      this.instance.position.y,
      this.instance.position.z
    ];
    
    // Update location
    this.location = currentPosition;
    this.positionChanged = true;
    
    // Save position data
    this.savePositionData();
  }
  
  // Save position data to persistent storage
  private savePositionData(): void {
    if (this.persistentData && this.uuid) {
      this.persistentData.updateObjectData(this.uuid);
      this.persistentData.markObjectChanged(this.uuid);
    }
  }
  
  // Handle asset position changes
  private handleAssetPositionChanged = (event: PositionChangeEvent): void => {
    // Mark this entry as changed when any of its assets change position
    this.positionChanged = true;
    
    // Update persistent data
    if (this.persistentData && this.uuid) {
      this.persistentData.updateObjectData(this.uuid);
    }
  };
  
  // Implement IPersistable interface
  public getSerializableData(): any {
    // Update location from instance if available
    if (this.instance) {
      this.location = [
        this.instance.position.x,
        this.instance.position.y,
        this.instance.position.z
      ];
    }
    
    // Get serializable data for all assets
    const dataAssets = this.dataAssets.map(asset => {
      return asset.getSerializableData();
    });
    
    return {
      UUID: this.uuid,
      Title: this.title,
      Location: this.location,
      DataAssets: dataAssets
    };
  }
  
  // Update from data
  public updateFromData(data: any): void {
    if (data.Title) this.title = data.Title;
    
    if (data.Location) this.location = data.Location;
    
    // Update the instance position if it exists
    if (this.instance && data.Location) {
      this.instance.position.set(
        data.Location[0],
        data.Location[1],
        data.Location[2]
      );
      
      console.log(`DataEntry: Updated position to [${data.Location[0]}, ${data.Location[1]}, ${data.Location[2]}] for "${this.title}"`);
    }
    
    // Update data assets if provided
    if (data.DataAssets) {
      // Match assets by UUID
      for (const assetData of data.DataAssets) {
        const asset = this.dataAssets.find(a => a.uuid === assetData.UUID);
        if (asset) {
          asset.updateFromData(assetData);
        }
      }
    }
    
    // For backward compatibility, handle IsActive if present
    if (data.IsActive !== undefined) {
      this._isActive = data.IsActive;
      this.updateAssetsVisibility();
      console.log(`DataEntry: Updated active state to ${this._isActive} for "${this.title}"`);
    }
  }

  private updateAssetsVisibility(): void {
    for (const asset of this.dataAssets) {
      if (asset.instance) {
        asset.setIsActiveWithAnimation(this._isActive);
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
    this.selectable.onSelectionChanged.addEventListener(this.handleSelectionChanged);
    
    // Set up drag controls if we have a persistent data interface
    if (this.persistentData) {
      this.setupDragControlsEvents();
    }
    
    for (const asset of this.dataAssets) {
      await asset.load(this.instance, context);
      
      // Register with persistent data if available
      if (this.persistentData) {
        asset.registerWithPersistentData(this.persistentData);
        asset.onPositionChanged.addEventListener(this.handleAssetPositionChanged);
      }
    }
    
    // Set visibility for all assets after they're loaded
    this.updateAssetsVisibility();
  }

  private handleSelectionChanged = (event: { object: SelectableObject; isSelected: boolean }) => {
    // Always emit the selection event when the selection state changes
    // This ensures the DataCluster can properly manage which entries are active
    this.onSelected.invoke({ entry: this, isSelected: event.isSelected });
    
    // Update our active state to match the selection state
    if (this._isActive !== event.isSelected) {
      this.isActive = event.isSelected;
      
      // Mark as pending changes but don't force save immediately
      // The debounce mechanism will handle saving at appropriate intervals
    }
  };

  // Called when dragging finishes
  public onDragEnd(): void {
    if (!this.instance) return;
    
    // Update position data and save
    this.onPositionChanged();
  }

  public unload(): void {
    if (this.selectable) {
      this.selectable.onSelectionChanged.removeEventListener(this.handleSelectionChanged);
    }
    
    // Unregister from persistent data
    if (this.persistentData && this.uuid) {
      this.persistentData.unregisterObject(this.uuid);
      
      // Remove event listeners
      for (const asset of this.dataAssets) {
        asset.onPositionChanged.removeEventListener(this.handleAssetPositionChanged);
      }
      
      this.persistentData = null;
    }
    
    for (const asset of this.dataAssets) {
      asset.unload();
    }
    this.instance?.destroy();
    this.instance = null;
    this.dragControls = null;
    this.eventHandler = null;
  }
}
