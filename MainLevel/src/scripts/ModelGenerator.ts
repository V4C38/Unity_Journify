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

        console.log(`ModelGenerator: Starting model generation with prompt: "${prompt}"`);
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
                mode: 'cors', // Explicitly set CORS mode
                credentials: 'omit' // Don't send credentials
            });
            
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`ModelGenerator: API response received after ${elapsedTime}s (Status: ${response.status})`);
            
            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error || 'Failed to generate model';
                console.error(`ModelGenerator: API error - ${errorMessage}`);
                
                // Update status text with error
                this.updateStatusText(`Error: ${errorMessage}`);
                
                // Clear error message after a delay
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

            // Ensure the URL has the correct domain and path structure
            const modelUrl = data.modelUrl.startsWith('http') 
                ? data.modelUrl 
                : `https://www.v4c38.com${data.modelUrl.startsWith('/') ? '' : '/'}${data.modelUrl}`;
            
            // Remove any double /api/ in the URL if present
            const cleanModelUrl = modelUrl.replace(/\/api\/api\//g, '/api/');
            
            console.log(`ModelGenerator: Using model URL: ${cleanModelUrl}`);

            // Call the onModelGenerated method with all available data
            this.onModelGenerated(cleanModelUrl, data.prompt || prompt, data.uuid, data.title);
            
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

    public onModelGenerated(modelUrl: string, prompt: string = "", uuid: string = "", title: string = "") {
        console.log(`Model generated: ${modelUrl}`);
        
        // Update status text to show completion
        this.updateStatusText("Model generation complete!");
        
        // Clear status text after a delay
        setTimeout(() => {
            if (!this.isGenerating) {
                this.updateStatusText("");
            }
        }, 3000);
        
        this.isGenerating = false;
        this.saveModelToPersistentData(modelUrl);
        
        // Use a proxy URL or direct URL with CORS mode
        this.spawnModel(modelUrl, prompt, uuid, title);
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

    public async spawnModel(modelURL: string, prompt: string = "", uuid: string = "", title: string = "") {
        if (!this.userArchive) {
            console.error("ModelGenerator: Cannot spawn model - UserArchive reference not set");
            return;
        }

        // Wait for archive to load if needed
        if (!this.userArchive.hasClusters()) {
            console.log("ModelGenerator: Waiting for UserArchive to load...");
            await this.userArchive.loadArchive();
            
            // Double check after loading
            if (!this.userArchive.hasClusters()) {
                const errorMessage = "Cannot spawn model - No data clusters available after loading archive";
                console.error("ModelGenerator:", errorMessage);
                this.updateStatusText(`Error: ${errorMessage}`);
                return;
            }
        }

        // Try to select first cluster if none is selected
        if (!this.userArchive.selectedDataCluster) {
            const errorMessage = "Cannot spawn model - No data cluster selected";
            console.error("ModelGenerator:", errorMessage);
            this.updateStatusText(`Error: ${errorMessage}`);
            return;
        }

        // Get the selected data cluster
        const selectedCluster = this.userArchive.selectedDataCluster;
        if (!selectedCluster) {
            const errorMessage = "Cannot spawn model - No data cluster selected";
            console.error("ModelGenerator:", errorMessage);
            this.updateStatusText(`Error: ${errorMessage}`);
            return;
        }

        // Find or activate an entry in the selected cluster
        let entryToUse = selectedCluster.dataEntries.find(entry => entry.isActive);
        if (!entryToUse) {
            // If no entry is active, try to activate the first one
            if (selectedCluster.dataEntries.length > 0) {
                entryToUse = selectedCluster.dataEntries[0];
                entryToUse.isActive = { newState: true, animate: true };
            } else {
                const errorMessage = "Cannot spawn model - No entries available in selected cluster";
                console.error("ModelGenerator:", errorMessage);
                this.updateStatusText(`Error: ${errorMessage}`);
                return;
            }
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
            // Create the DataAsset
            if (!this.userArchive.dataAssetPrefab) {
                throw new Error("No data asset prefab available");
            }
            
            const dataAsset = await entryToUse.createDataAsset();
            dataAsset.uuid = assetData.UUID;
            dataAsset.modelURL = assetData.URL;
            
            // Add the DataAsset to the active entry
            await entryToUse.addDataAsset(dataAsset);
            
            console.log(`ModelGenerator: Model spawned successfully`);
            this.updateStatusText("Model spawned successfully");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error spawning model";
            console.error("ModelGenerator: Error spawning model -", errorMessage);
            this.updateStatusText(`Error: ${errorMessage}`);
        }
    }
}
