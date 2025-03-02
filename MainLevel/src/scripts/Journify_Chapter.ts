import { Behaviour, PointerEventData, serializable } from "@needle-tools/engine";
import { Vector3, Object3D } from "three";

export class Journify_Chapter extends Behaviour {
  // Hover multiplier for the chapter container.
  private readonly hoverScaleFactor = 1.02;
  private originalParentScale = new Vector3();
  private isHovered = false;

  // Cache for each child entry and its original (base) scale.
  private entries: { go: Object3D; baseScale: Vector3 }[] = [];

  // Callback for chapter click (assigned by manager).
  public onChapterClicked?: (chapter: Journify_Chapter) => void;

  start(): void {
    // Cache parent's original scale.
    this.originalParentScale.copy(this.gameObject.scale);

    // Cache all child objects (entries) and their local scales.
    this.gameObject.children.forEach(child => {
      // Copy the child's current local scale.
      const baseScale = new Vector3().copy(child.scale);
      this.entries.push({ go: child, baseScale });
    });

    this.updateParentScale();
  }

  // Applies hover scaling to the chapter container.
  private updateParentScale(): void {
    if (this.isHovered) {
      this.gameObject.scale.set(
        this.originalParentScale.x * this.hoverScaleFactor,
        this.originalParentScale.y * this.hoverScaleFactor,
        this.originalParentScale.z * this.hoverScaleFactor
      );
    } else {
      this.gameObject.scale.copy(this.originalParentScale);
    }
  }

  onPointerEnter(_args: PointerEventData): void {
    this.isHovered = true;
    this.updateParentScale();
  }

  onPointerExit(_args: PointerEventData): void {
    this.isHovered = false;
    this.updateParentScale();
  }

  onPointerClick(_args: PointerEventData): void {
    if (this.onChapterClicked) {
      this.onChapterClicked(this);
    }
  }

  // Helper function to animate each entry's local scale.
  // targetFunc computes the target scale for an entry.
  private async animateEntriesScale(durationSec: number, targetFunc: (entry: { go: Object3D; baseScale: Vector3 }) => Vector3): Promise<void> {
    const steps = 30;
    // Store each entry's current scale.
    const initialScales = this.entries.map(entry => entry.go.scale.clone());
    for (let i = 0; i <= steps; i++) {
      const alpha = i / steps;
      this.entries.forEach((entry, index) => {
        const targetScale = targetFunc(entry);
        const newScale = new Vector3().lerpVectors(initialScales[index], targetScale, alpha);
        entry.go.scale.set(newScale.x, newScale.y, newScale.z);
      });
      await new Promise(resolve => setTimeout(resolve, (durationSec / steps) * 1000));
    }
  }

  // Animate all child entries to their base scales.
  async show(): Promise<void> {
    await this.animateEntriesScale(1.0, entry => entry.baseScale);
  }

  // Animate all child entries to a zero scale.
  async hide(): Promise<void> {
    await this.animateEntriesScale(1.0, _entry => new Vector3(0, 0, 0));
  }
}
