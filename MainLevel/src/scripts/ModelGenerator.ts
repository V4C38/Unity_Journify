import { Behaviour, serializable, GameObject, Text } from "@needle-tools/engine";
import { UserArchive } from "./UserArchive";
import { DataAsset } from "./DataAsset";
import { v4 as uuidv4 } from 'uuid';

// Define a minimal interface for the Text component
interface TextComponent {
    text: string;
}

export class ModelGenerator extends Behaviour {
    // Status update callback
    private onStatusUpdate: ((status: string) => void) | null = null;
    
    // Reference to the status text UI element
    @serializable(Text)
    public statusTextObject: Text | null = null;
    
    // Flag to track if generation is in progress
    private isGenerating: boolean = false;
    
    @serializable(UserArchive)
    public userArchive: UserArchive | null = null;

    // Progress simulation timeouts
    private progressTimeouts: ReturnType<typeof setTimeout>[] = [];

    start() {
        console.log("ModelGenerator: Initializing...");
        console.log("ModelGenerator: UserArchive reference:", this.userArchive);
    }

    onDestroy() {
        this.clearProgressTimeouts();
    }

    public generateTestModel() {
        console.log("ModelGenerator: generateTestModel");
        this.generateModel("A cartoony tree.");
    }

    public async generateModel(prompt: string, statusCallback?: (status: string) => void): Promise<string> {
        if (this.isGenerating) {
            throw new Error("Model generation already in progress");
        }

        if (!this.userArchive) {
            throw new Error("UserArchive reference not set");
        }

        // Cache the current selections at the start
        const selectedCluster = this.userArchive.selectedDataCluster;
        if (!selectedCluster) {
            throw new Error("No data cluster selected");
        }

        const selectedEntry = selectedCluster.getSelectedDataEntry();
        if (!selectedEntry) {
            throw new Error("No entry selected");
        }

        // Store the IDs for verification later
        const targetClusterId = selectedCluster.id;
        const targetEntryId = selectedEntry.id;

        console.log(`ModelGenerator: Starting model generation with prompt: "${prompt}" for entry ${targetEntryId}`);
        this.onStatusUpdate = statusCallback || null;
        this.isGenerating = true;
        
        // Clear any existing progress timeouts
        this.clearProgressTimeouts();
        
        // Simulate progress updates
        const progressUpdates = [
            { message: 'Optimizing prompt with AI...', delay: 1000 },
            { message: 'Generating reference image...', delay: 3000 },
            { message: 'Processing image with Stability AI...', delay: 6000 },
            { message: 'Creating 3D model from image...', delay: 10000 },
            { message: 'Finalizing model and textures...', delay: 15000 }
        ];
        
        // Set up progress update simulation
        progressUpdates.forEach(update => {
            const timeout = setTimeout(() => {
                if (this.isGenerating) {
                    this.updateStatusText(update.message);
                    if (this.onStatusUpdate) {
                        this.onStatusUpdate(update.message);
                    }
                }
            }, update.delay);
            this.progressTimeouts.push(timeout);
        });
        
        try {
            console.log("ModelGenerator: Sending request to v4c38.com REST API");
            const startTime = Date.now();
            const response = await fetch('https://www.v4c38.com/api/model', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt }),
                mode: 'cors',
                credentials: 'omit'
            });
            
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`ModelGenerator: API response received after ${elapsedTime}s (Status: ${response.status})`);
            
            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error || 'Failed to generate model';
                console.error(`ModelGenerator: API error - ${errorMessage}`);
                
                this.updateStatusText(`Error: ${errorMessage}`);
                
                setTimeout(() => {
                    if (!this.isGenerating) {
                        this.updateStatusText("");
                    }
                }, 5000);
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log("ModelGenerator: Model generated successfully", {
                modelUrl: data.modelUrl,
                uuid: data.uuid,
                title: data.title,
                prompt: data.prompt
            });

            const modelUrl = data.modelUrl.startsWith('http') 
                ? data.modelUrl 
                : `https://www.v4c38.com${data.modelUrl.startsWith('/') ? '' : '/'}${data.modelUrl}`;
            
            const cleanModelUrl = modelUrl.replace(/\/api\/api\//g, '/api/');
            
            console.log(`ModelGenerator: Using model URL: ${cleanModelUrl}`);

            // Pass the cached cluster and entry IDs to onModelGenerated
            this.onModelGenerated(cleanModelUrl, data.prompt || prompt, data.uuid, data.title, targetClusterId, targetEntryId);
            
            return cleanModelUrl;
        } catch (error) {
            console.error("ModelGenerator: Error generating 3D model:", error);
            this.isGenerating = false;
            throw error;
        } finally {
            this.clearProgressTimeouts();
        }
    }

    private clearProgressTimeouts() {
        // Clear all progress simulation timeouts
        this.progressTimeouts.forEach(timeout => clearTimeout(timeout));
        this.progressTimeouts = [];
    }

    public onModelGenerated(modelUrl: string, prompt: string = "", uuid: string = "", title: string = "", targetClusterId: string, targetEntryId: string) {
        console.log(`Model generated: ${modelUrl} for entry ${targetEntryId}`);
        
        this.updateStatusText("Model generation complete!");
        
        setTimeout(() => {
            if (!this.isGenerating) {
                this.updateStatusText("");
            }
        }, 3000);
        
        this.isGenerating = false;
        this.saveModelToPersistentData(modelUrl);
        
        // Pass the cached IDs to spawnModel
        this.spawnModel(modelUrl, prompt, uuid, title, targetClusterId, targetEntryId);
    }

    public downloadModel(modelUrl: string, filename: string = "model.glb") {
        try {
            // Extract the model filename from the URL
            const modelFilename = modelUrl.split('/').pop();
            if (!modelFilename) {
                throw new Error("Invalid model URL");
            }
            
            // Construct the download URL
            const downloadUrl = `https://www.v4c38.com/api/download?file=${encodeURIComponent(modelFilename)}`;
            
            // Create a temporary anchor element to trigger the download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`Model download initiated: ${filename}`);
        } catch (error) {
            console.error("Error downloading model:", error);
            throw error;
        }
    }

    // Update the status text UI
    private updateStatusText(status: string) {
        if (!this.statusTextObject) return;
        
        try {
            this.statusTextObject.text = status;
            
            // Show/hide based on whether there's text
            if (status && status.length > 0) {
                this.statusTextObject.gameObject.visible = true;
            } else {
                this.statusTextObject.gameObject.visible = false;
            }
        } catch (error) {
            console.warn("ModelGenerator: Error updating status text:", error);
        }
    }
    
    // Function to sanitize file name
    private sanitizeFileName(input: string): string {
        return input.trim().replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    }

    public saveModelToPersistentData(modelURL: string) {
        // IGNORE THIS FOR NOW
    }

    public async spawnModel(modelURL: string, prompt: string = "", uuid: string = "", title: string = "", targetClusterId: string, targetEntryId: string) {
        if (!this.userArchive) {
            console.error("ModelGenerator: Cannot spawn model - UserArchive reference not set");
            return;
        }

        // Wait for archive to load if needed
        if (!this.userArchive.hasClusters()) {
            console.log("ModelGenerator: Waiting for UserArchive to load...");
            await this.userArchive.loadArchive();
        }

        // Since we cached the IDs at generation start, verify the cluster is still valid
        if (this.userArchive.selectedDataCluster?.id !== targetClusterId) {
            const errorMessage = `Cannot spawn model - Target cluster ${targetClusterId} is not selected or no longer exists`;
            console.error("ModelGenerator:", errorMessage);
            this.updateStatusText(`Error: ${errorMessage}`);
            return;
        }

        const targetCluster = this.userArchive.selectedDataCluster;
        
        // Get the target entry by ID
        const targetEntry = targetCluster.getDataEntry(targetEntryId);
        if (!targetEntry) {
            const errorMessage = `Cannot spawn model - Target entry ${targetEntryId} no longer exists`;
            console.error("ModelGenerator:", errorMessage);
            this.updateStatusText(`Error: ${errorMessage}`);
            return;
        }

        // Create a new DataAsset for the model
        const assetData = {
            UUID: uuid || uuidv4(),
            Title: title || `Generated Model ${new Date().toLocaleTimeString()}`,
            Prompt: prompt || "Generated model",
            URL: modelURL,
            TransformData: {
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
            }
        };

        try {
            if (!this.userArchive.dataAssetPrefab) {
                throw new Error("No data asset prefab available");
            }
            
            const dataAsset = await targetEntry.createDataAsset();
            dataAsset.uuid = assetData.UUID;
            dataAsset.modelURL = assetData.URL;
            dataAsset.prompt = assetData.Prompt;
            
            // Add the DataAsset to the target entry
            await targetEntry.addDataAsset(dataAsset);
            
            // Set visibility based on whether the target entry is currently selected
            const currentlySelectedEntry = targetCluster.getSelectedDataEntry();
            const shouldBeVisible = currentlySelectedEntry?.id === targetEntryId;
            dataAsset.isActive = { newState: shouldBeVisible, animate: true };
            
            console.log(`ModelGenerator: Model spawned successfully (visible: ${shouldBeVisible}, added to entry: ${targetEntryId})`);
            this.updateStatusText("Model spawned successfully");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error spawning model";
            console.error("ModelGenerator: Error spawning model -", errorMessage);
            this.updateStatusText(`Error: ${errorMessage}`);
        }
    }
}
