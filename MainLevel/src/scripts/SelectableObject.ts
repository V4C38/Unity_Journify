import { Behaviour, serializable, EventList } from "@needle-tools/engine";
import { Vector3 } from "three";

// Event type for selection change events
export type SelectionChangeEvent = {
    object: SelectableObject;
    isSelected: boolean;
};

export class SelectableObject extends Behaviour {
    // Original scale of the object
    private originalScale: Vector3 = new Vector3(1, 1, 1);
    
    // Current target scale
    private targetScale: Vector3 = new Vector3(1, 1, 1);
    
    // Current scale velocity for smooth damping
    private scaleVelocity: Vector3 = new Vector3(0, 0, 0);
    
    // Hover scale factor (102%)
    @serializable()
    private hoverScaleFactor: number = 1.02;
    
    // Animation duration in seconds
    @serializable()
    private animationDuration: number = 0.2;
    
    // Whether the object is currently hovered
    private isHovered: boolean = false;
    
    // Whether the object is currently selected
    @serializable()
    private _isSelected: boolean = false;
    
    // Event that fires when selection state changes
    public readonly onSelectionChanged = new EventList<SelectionChangeEvent>();
    
    // Getter and setter for isSelected to emit events when changed
    public get isSelected(): boolean {
        return this._isSelected;
    }
    
    public set isSelected(value: boolean) {
        if (this._isSelected !== value) {
            this._isSelected = value;
            // Emit selection change event
            this.onSelectionChanged.invoke({
                object: this,
                isSelected: value
            });
        }
    }
    
    // Cache the original scale when the component starts
    start() {
        // Cache the original scale of the object
        if (this.gameObject && this.gameObject.scale) {
            // Create a new Vector3 to ensure we have a clean copy
            this.originalScale = new Vector3().copy(this.gameObject.scale);
            this.targetScale = new Vector3().copy(this.originalScale);
        }
    }
    
    // Update is called once per frame
    update() {
        this.animateScale();
    }
    
    // Set hover state to true
    onPointerEnter() {
        this.setHovered(true);
    }
    
    // Set hover state to false
    onPointerExit() {
        this.setHovered(false);
    }
    
    // Handle click to toggle selection
    onPointerClick() {
        this.isSelected = !this.isSelected;
    }
    
    // Set the hover state and update the target scale
    private setHovered(hovered: boolean) {
        if (this.isHovered === hovered) return;
        
        this.isHovered = hovered;
        this.updateTargetScale();
    }
    
    // Update the target scale based on hover state
    private updateTargetScale() {
        if (!this.gameObject) return;
        
        if (this.isHovered) {
            // Set target scale to 102% of original scale when hovered
            this.targetScale.set(
                this.originalScale.x * this.hoverScaleFactor,
                this.originalScale.y * this.hoverScaleFactor,
                this.originalScale.z * this.hoverScaleFactor
            );
        } else {
            // Set target scale back to original scale when not hovered
            this.targetScale.copy(this.originalScale);
        }
    }
    
    // Animate the scale smoothly towards the target scale
    private animateScale() {
        if (!this.gameObject) return;
        
        const smoothTime = this.animationDuration * 0.5; // Adjust for desired feel
        
        // Smoothly interpolate current scale to target scale
        this.smoothDamp(
            this.gameObject.scale, 
            this.targetScale, 
            this.scaleVelocity, 
            smoothTime
        );
    }
    
    // Implementation of SmoothDamp for Vector3 (similar to Unity's Vector3.SmoothDamp)
    private smoothDamp(current: Vector3, target: Vector3, velocity: Vector3, smoothTime: number): void {
        const deltaTime = this.context.time.deltaTime;
        
        // Prevent division by zero
        smoothTime = Math.max(0.0001, smoothTime);
        
        // Calculate smooth damp for each component
        const omega = 2.0 / smoothTime;
        const x = omega * deltaTime;
        const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
        
        const changeX = current.x - target.x;
        const changeY = current.y - target.y;
        const changeZ = current.z - target.z;
        
        const originalX = target.x;
        const originalY = target.y;
        const originalZ = target.z;
        
        // Clamp maximum speed
        const maxChange = Number.MAX_VALUE;
        
        const maxChangeX = maxChange * smoothTime;
        const maxChangeY = maxChange * smoothTime;
        const maxChangeZ = maxChange * smoothTime;
        
        const clampedChangeX = Math.max(-maxChangeX, Math.min(maxChangeX, changeX));
        const clampedChangeY = Math.max(-maxChangeY, Math.min(maxChangeY, changeY));
        const clampedChangeZ = Math.max(-maxChangeZ, Math.min(maxChangeZ, changeZ));
        
        target.x = current.x - clampedChangeX;
        target.y = current.y - clampedChangeY;
        target.z = current.z - clampedChangeZ;
        
        const tempX = (velocity.x + omega * clampedChangeX) * deltaTime;
        const tempY = (velocity.y + omega * clampedChangeY) * deltaTime;
        const tempZ = (velocity.z + omega * clampedChangeZ) * deltaTime;
        
        velocity.x = (velocity.x - omega * tempX) * exp;
        velocity.y = (velocity.y - omega * tempY) * exp;
        velocity.z = (velocity.z - omega * tempZ) * exp;
        
        current.x = target.x + (clampedChangeX + tempX) * exp;
        current.y = target.y + (clampedChangeY + tempY) * exp;
        current.z = target.z + (clampedChangeZ + tempZ) * exp;
        
        // Restore target values
        target.x = originalX;
        target.y = originalY;
        target.z = originalZ;
    }
}
