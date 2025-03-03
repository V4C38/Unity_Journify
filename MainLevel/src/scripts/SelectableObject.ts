import { Behaviour } from "@needle-tools/engine";

export class SelectableObject extends Behaviour {
  public isHovered: boolean = false;
  public isSelected: boolean = false;

  private onMouseEnter(): void {
    this.isHovered = true;
  }

  private onMouseExit(): void {
    this.isHovered = false;
  }

  private onMouseDown(): void {
    this.isSelected = !this.isSelected;
  }
}
