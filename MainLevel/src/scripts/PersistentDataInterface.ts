import { v4 as uuidv4 } from 'uuid';

export class PersistentDataInterface {
  private API_URL: string = "https://www.v4c38.com/api/data";
  private isSaving: boolean = false;
  private data: any = null;

  constructor() {
    this.data = null;
    console.log("[PersistentData] Interface initialized");
  }

  private getCurrentUsername(): string {
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    return usernameInput ? usernameInput.value : 'Anonymous';
  }

  public async saveData(data?: any): Promise<boolean> {
    if (this.isSaving) {
      console.warn("[PersistentData] Save operation already in progress");
      return false;
    }

    this.isSaving = true;
    try {
      const username = this.getCurrentUsername();
      console.log(`[PersistentData] Saving data to API for user: ${username}`);
      
      const dataToSave = {
        ...data || this.data,
        username: username,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSave)
      });

      if (!response.ok) {
        console.error(`[PersistentData] Failed to save data: ${response.statusText}`);
        return false;
      }

      console.log("[PersistentData] Data saved successfully");
      this.data = dataToSave;
      return true;
    } catch (error) {
      console.error('[PersistentData] Error saving data:', error);
      return false;
    } finally {
      this.isSaving = false;
    }
  }

  public async loadData(): Promise<boolean> {
    try {
      const username = this.getCurrentUsername();
      console.log(`[PersistentData] Loading data from API for user: ${username}`);
      
      const response = await fetch(this.API_URL);
      if (!response.ok) {
        console.error(`[PersistentData] Failed to load data: ${response.statusText}`);
        return false;
      }

      this.data = await response.json();
      console.log("[PersistentData] Data loaded successfully");
      return true;
    } catch (error) {
      console.error('[PersistentData] Error loading data:', error);
      return false;
    }
  }

  public getData(): any {
    return this.data;
  }

  public dispose(): void {
    console.log("[PersistentData] Disposing interface");
    // Save any pending changes before disposing
    if (!this.isSaving && this.data) {
      this.saveData(this.data);
    }
  }
} 