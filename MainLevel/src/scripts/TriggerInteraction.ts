import { Behaviour, serializable, EventList } from "@needle-tools/engine";
import { Vector3 } from "three";

// Event type for selection change events
export type TriggeredEvent = {
    object: TriggerInteraction;
};

// Event type for selection change events
export type SelectionStateChangedEvent = {
    object: TriggerInteraction;
    isSelected: boolean;
};

export class TriggerInteraction extends Behaviour {
    // If true, the object has no state / ie is not toggleable
    @serializable()
    public isTriggerOnly: boolean = false;
    
    // Event that fires when isTriggerOnly true and the object is clicked
    public readonly onTriggered = new EventList<TriggeredEvent>();

    // The current state of the selection if is not just a trigger
    private _isSelected: boolean = false;
    
    // Event that fires when _isSelected changes
    public readonly onSelectionStateChanged = new EventList<SelectionStateChangedEvent>();

    private _isHovered: boolean = false;

    private originalScale: Vector3 = new Vector3(1, 1, 1);
    private targetScale: Vector3 = new Vector3(1, 1, 1);
    private scaleVelocity: Vector3 = new Vector3(0, 0, 0);

    @serializable()
    public hoverScaleFactor: number = 1.015;

    @serializable()
    public animationDuration: number = 0.2;

    // Cache the original scale when the component starts
    start() {
        if (this.gameObject) {
            // Store the original scale
            this.originalScale.copy(this.gameObject.scale);
            this.targetScale.copy(this.originalScale);
        } else {
            console.error("TriggerInteraction: No gameObject found");
        }
    }

    // Getter and setter for isSelected to emit events when changed
    public get isSelected(): boolean {
        return this._isSelected;
    }

    public set isSelected(value: boolean) {
        if (this._isSelected !== value) {
            this._isSelected = value;
            this.onSelectionStateChanged.invoke({
                object: this,
                isSelected: value
            });
        }
    }

    // Set hover state to true
    onPointerEnter() {
        this.setHovered(true);
    }
    
    // Set hover state to false
    onPointerExit() {
        this.setHovered(false);
    }
    
    // Handle click to toggle selection or trigger event
    onPointerClick() {
        if (this.isTriggerOnly) {
            this.onTriggered.invoke({
                object: this
            });
        } else {
            this.isSelected = !this.isSelected;
        }
    }

    // Set the hover state and update the target scale
    private setHovered(hovered: boolean) {
        if (this._isHovered === hovered) return;
        this._isHovered = hovered;

        if (hovered) {
            this.targetScale.set(
                this.originalScale.x * this.hoverScaleFactor,
                this.originalScale.y * this.hoverScaleFactor,
                this.originalScale.z * this.hoverScaleFactor
            );
        } else {
            this.targetScale.copy(this.originalScale);
        }
    }

    update() {
        this.animateScale();
    }

    private animateScale() {
        if (!this.gameObject) return;
        
        const smoothTime = this.animationDuration * 0.5;
        
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
