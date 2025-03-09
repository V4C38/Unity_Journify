import { Behaviour, serializable } from "@needle-tools/engine";
import { ModelGenerator } from "./ModelGenerator";

export class PromptInputHandler extends Behaviour {
    
    @serializable(ModelGenerator)
    public modelGenerator: ModelGenerator | null = null;
    
    // Called when the component starts
    start() {
        console.log("PromptInputHandler: start");
        console.log("PromptInputHandler instance ID:", this.gameObject?.uuid);
    }
    
    // Called when the Start Input button is clicked (invoked directly from Unity UI)
    // IMPORTANT: Method name must start with lowercase for Unity UI Button onClick events
    public onStartInput() {
        console.log("PromptInputHandler: onStartInput method called");
        if (this.modelGenerator) {
            console.log("PromptInputHandler: Calling generateTestModel on ModelGenerator");
            this.modelGenerator.generateTestModel();
        } else {
            console.error("PromptInputHandler: ModelGenerator is null");
        }
    }

    // Called when the Submit button is clicked (invoked directly from Unity UI)
    // IMPORTANT: Method name must start with lowercase for Unity UI Button onClick events
    public onSubmit() {
        console.log("PromptInputHandler: onSubmit method called");
        if (this.modelGenerator) {
            console.log("PromptInputHandler: Calling generateTestModel on ModelGenerator");
            this.modelGenerator.generateTestModel();
        } else {
            console.error("PromptInputHandler: ModelGenerator is null");
        }
    }

}

export default PromptInputHandler;