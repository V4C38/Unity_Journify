import { v4 as uuidv4 } from 'uuid';

// Interface for objects that can be persisted
export interface IPersistable {
  uuid: string;
  getSerializableData(): any;
  updateFromData(data: any): void;
}

// Interface for transform data
export interface ITransformData {
  position: number[];
  rotation: number[];
  scale: number[];
}

export class PersistentDataInterface {
  private jsonPath: string;
  private data: any;
  private registeredObjects: Map<string, IPersistable> = new Map();
  private isLoaded: boolean = false;
  private pendingChanges: boolean = false;
  private changedObjects: Set<string> = new Set(); // Track which objects have changed
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private lastSaveTime: number = 0;
  private saveDebounceMs: number = 2000; // Minimum time between saves
  private maxBufferTime: number = 10000; // Maximum time to buffer changes (10 seconds)
  private bufferTimer: ReturnType<typeof setTimeout> | null = null;
  private isSaving: boolean = false; // Flag to prevent concurrent saves
  
  constructor(jsonPath: string, autoSaveIntervalMs: number = 5000) {
    this.jsonPath = jsonPath;
    this.data = null;
    
    // Set up auto-save interval if specified
    if (autoSaveIntervalMs > 0) {
      this.setupAutoSave(autoSaveIntervalMs);
    }
  }
  
  // Set up auto-save interval
  private setupAutoSave(intervalMs: number): void {
    // Clear any existing interval
    if (this.autoSaveInterval !== null) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    // Set up new interval
    this.autoSaveInterval = setInterval(() => {
      if (this.pendingChanges && !this.isSaving) {
        console.log(`Auto-save triggered after ${intervalMs}ms interval`);
        this.saveData();
      }
    }, intervalMs);
  }
  
  // Load data from the external API
  public async loadData(): Promise<boolean> {
    try {
      console.log(`Loading data from API...`);
      const response = await fetch('https://www.v4c38.com/api/data');
      if (!response.ok) {
        console.error(`Failed to load data from API: ${response.statusText}`);
        return false;
      }
      
      this.data = await response.json();
      
      // Debug log to verify the data structure
      console.log(`Successfully loaded data from API`);
      
      this.isLoaded = true;
      this.pendingChanges = false;
      this.changedObjects.clear();
      return true;
    } catch (error) {
      console.error(`Error loading data from API:`, error);
      return false;
    }
  }
  
  // Save data to the external API
  public async saveData(force: boolean = false): Promise<boolean> {
    if (!this.isLoaded) {
      console.warn("Cannot save data: No data loaded");
      return false;
    }
    
    // If already saving, don't start another save
    if (this.isSaving) {
      return true;
    }
    
    // If no changes or no objects have changed, skip save
    if (!this.pendingChanges || this.changedObjects.size === 0) {
      return true;
    }
    
    // Debounce saves to prevent too frequent API calls (unless forced)
    const now = Date.now();
    if (!force && now - this.lastSaveTime < this.saveDebounceMs) {
      // Schedule a save after the debounce period if not already scheduled
      if (this.bufferTimer === null) {
        this.bufferTimer = setTimeout(() => {
          this.bufferTimer = null;
          this.saveData(true); // Force save after debounce
        }, this.saveDebounceMs);
      }
      
      return true; // Return true to indicate "success" even though we're deferring
    }
    
    // Clear any pending buffer timer
    if (this.bufferTimer !== null) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }
    
    // Mark as saving to prevent concurrent saves
    this.isSaving = true;
    
    try {
      console.log(`Saving data to API with ${this.changedObjects.size} changed objects...`);
      
      const jsonString = JSON.stringify(this.data, null, 2);
      
      const response = await fetch('https://www.v4c38.com/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: jsonString
      });
      
      if (response.ok) {
        console.log(`Successfully saved data to API`);
        this.pendingChanges = false;
        this.changedObjects.clear();
        this.lastSaveTime = now;
        this.isSaving = false;
        return true;
      } else {
        console.error(`Failed to save data to API: ${response.statusText}`);
        this.isSaving = false;
        return false;
      }
    } catch (error) {
      console.error(`Error saving data to API:`, error);
      this.isSaving = false;
      return false;
    }
  }
  
  // Mark an object as changed and schedule a save
  public markObjectChanged(uuid: string): void {
    if (!this.isLoaded) return;
    
    // Add to set of changed objects
    this.changedObjects.add(uuid);
    this.pendingChanges = true;
    
    // If we have too many changed objects, trigger a save
    if (this.changedObjects.size >= 10) {
      this.saveData();
      return;
    }
    
    // If no buffer timer is set, set one to ensure changes are saved eventually
    if (this.bufferTimer === null) {
      const bufferTime = Math.min(this.maxBufferTime, Math.max(this.saveDebounceMs * 2, 5000));
      this.bufferTimer = setTimeout(() => {
        this.bufferTimer = null;
        this.saveData(true); // Force save after buffer time
      }, bufferTime);
    }
  }
  
  // Register an object to be tracked for persistence
  public registerObject(object: IPersistable): void {
    if (!object.uuid) {
      object.uuid = uuidv4();
    }
    
    this.registeredObjects.set(object.uuid, object);
  }
  
  // Unregister an object
  public unregisterObject(uuid: string): void {
    this.registeredObjects.delete(uuid);
    this.changedObjects.delete(uuid);
  }
  
  // Update an object's data in the JSON
  public updateObjectData(uuid: string): void {
    if (!this.isLoaded) return;
    
    const object = this.registeredObjects.get(uuid);
    if (!object) return;
    
    // Get the serializable data from the object
    const objectData = object.getSerializableData();
    
    // Find and update the object in the data structure
    const updated = this.updateDataRecursively(this.data, uuid, objectData);
    
    if (updated) {
      // Mark that we have pending changes
      this.markObjectChanged(uuid);
    }
  }
  
  // Recursively search and update an object in the data structure
  private updateDataRecursively(data: any, uuid: string, newData: any): boolean {
    // If this is an array, check each element
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        
        // If this item has a UUID and it matches, update it
        if (item && item.UUID === uuid) {
          // Preserve the UUID
          newData.UUID = uuid;
          data[i] = { ...item, ...newData };
          return true;
        }
        
        // Otherwise, recursively check this item
        if (typeof item === 'object' && item !== null) {
          if (this.updateDataRecursively(item, uuid, newData)) {
            return true;
          }
        }
      }
    }
    // If this is an object, check each property
    else if (typeof data === 'object' && data !== null) {
      // If this object has a UUID and it matches, update it
      if (data.UUID === uuid) {
        // Preserve the UUID
        newData.UUID = uuid;
        Object.assign(data, newData);
        return true;
      }
      
      // Otherwise, recursively check each property
      for (const key in data) {
        const value = data[key];
        if (typeof value === 'object' && value !== null) {
          if (this.updateDataRecursively(value, uuid, newData)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  // Get data for a specific object by UUID
  public getObjectData(uuid: string): any | null {
    if (!this.isLoaded) return null;
    
    // Check if the requested UUID is the root object's UUID
    if (this.data && this.data.UUID === uuid) {
      return this.data;
    }
    
    // Otherwise, search recursively
    return this.findDataRecursively(this.data, uuid);
  }
  
  // Recursively search for an object in the data structure
  private findDataRecursively(data: any, uuid: string): any | null {
    // If this is an array, check each element
    if (Array.isArray(data)) {
      for (const item of data) {
        // If this item has a UUID and it matches, return it
        if (item && item.UUID === uuid) {
          return item;
        }
        
        // Otherwise, recursively check this item
        if (typeof item === 'object' && item !== null) {
          const result = this.findDataRecursively(item, uuid);
          if (result !== null) {
            return result;
          }
        }
      }
    }
    // If this is an object, check each property
    else if (typeof data === 'object' && data !== null) {
      // If this object has a UUID and it matches, return it
      if (data.UUID === uuid) {
        return data;
      }
      
      // Otherwise, recursively check each property
      for (const key in data) {
        const value = data[key];
        if (typeof value === 'object' && value !== null) {
          const result = this.findDataRecursively(value, uuid);
          if (result !== null) {
            return result;
          }
        }
      }
    }
    
    return null;
  }
  
  public getData(): any {
    return this.data;
  }
  
  public dispose(): void {
    // Save any pending changes before disposing
    if (this.pendingChanges) {
      console.log(`Saving pending changes before disposing`);
      this.saveData(true);
    }
    
    // Clear auto-save interval
    if (this.autoSaveInterval !== null) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    // Clear buffer timer
    if (this.bufferTimer !== null) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }
    
    this.registeredObjects.clear();
    this.changedObjects.clear();
    this.pendingChanges = false;
  }
} 