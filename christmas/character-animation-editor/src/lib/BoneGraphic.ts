import { Container, FederatedPointerEvent, Graphics } from "pixi.js";

export class BoneGraphic extends Container {
  public boneShape: Graphics;
  public rotationHandle: Graphics;
  public scaleHandle: Graphics;
  public name: string;
  private _length: number;
  private _isSelected: boolean = false;
  private _isDragging: boolean = false;
  private _isVisible: boolean = true;

  private static readonly COLORS = {
    DEFAULT: 0xff0000,
    SELECTED: 0x00ff00,
    DRAGGING: 0x0000ff,
    ROTATION_HANDLE: 0x0000ff,
    SCALE_HANDLE: 0x00ff00,
    ORIGIN: 0xffff00,
  };

  private static readonly ALPHA = {
    ACTIVE: 0.9,
    INACTIVE: 0.7,
    HANDLE: 0.6,
  };

  constructor(name: string, length: number) {
    super();
    this._length = length;
    this.name = name;

    this.boneShape = new Graphics();
    this.rotationHandle = new Graphics();
    this.scaleHandle = new Graphics();

    this.addChild(this.boneShape);
    this.addChild(this.rotationHandle);
    this.addChild(this.scaleHandle);

    this.draw();
    this.setupInteractivity();
  }

  private draw(): void {
    if (!this._isVisible) {
      this.boneShape.clear();
      this.rotationHandle.clear();
      this.scaleHandle.clear();
      return;
    }

    const boneWidth = this._length * 0.2;
    const boneColor = this.getBoneColor();
    const boneAlpha = this.getBoneAlpha();

    // Draw bone shape along positive x-axis
    this.boneShape.clear();
    this.boneShape
      .moveTo(0, 0)
      .lineTo(this._length / 2, boneWidth / 2)
      .lineTo(this._length, 0)
      .lineTo(this._length / 2, -boneWidth / 2)
      .lineTo(0, 0)
      .fill({ color: boneColor, alpha: boneAlpha })
      .stroke({ color: boneColor, width: 2, alpha: BoneGraphic.ALPHA.ACTIVE });

    // Draw origin
    this.boneShape.circle(0, 0, 5).fill({ color: BoneGraphic.COLORS.ORIGIN });

    // Draw rotation handle
    this.rotationHandle.clear();
    this.rotationHandle.circle(this._length, 0, 7).fill({
      color: BoneGraphic.COLORS.ROTATION_HANDLE,
      alpha: BoneGraphic.ALPHA.HANDLE,
    });

    // Draw scale handle
    this.scaleHandle.clear();
    this.scaleHandle.circle(this._length * 0.75, this._length * 0.15, 7).fill({
      color: BoneGraphic.COLORS.SCALE_HANDLE,
      alpha: BoneGraphic.ALPHA.HANDLE,
    });

    this.alpha = this._isSelected
      ? BoneGraphic.ALPHA.ACTIVE
      : BoneGraphic.ALPHA.INACTIVE;
    this.zIndex = this._isSelected ? 1 : 0;
  }

  public setVisible(visible: boolean): void {
    this._isVisible = visible;
    this.draw();
  }

  private getBoneColor(): number {
    if (this._isDragging) return BoneGraphic.COLORS.DRAGGING;
    return this._isSelected
      ? BoneGraphic.COLORS.SELECTED
      : BoneGraphic.COLORS.DEFAULT;
  }

  private getBoneAlpha(): number {
    return this._isSelected
      ? BoneGraphic.ALPHA.ACTIVE
      : BoneGraphic.ALPHA.INACTIVE;
  }

  private setupInteractivity(): void {
    this.boneShape.eventMode = "static";
    this.boneShape.cursor = "move";

    this.rotationHandle.eventMode = "static";
    this.rotationHandle.cursor = "pointer";

    this.scaleHandle.eventMode = "static";
    this.scaleHandle.cursor = "pointer";
  }

  public startDrag(event: FederatedPointerEvent): void {
    this._isDragging = true;
    this.draw();
  }

  public endDrag(): void {
    this._isDragging = false;
    this.draw();
  }

  public startRotate(event: FederatedPointerEvent): void {
    this.rotationHandle.alpha = 1;
  }

  public endRotate(): void {
    this.rotationHandle.alpha = BoneGraphic.ALPHA.HANDLE;
  }

  public startScale(event: FederatedPointerEvent): void {
    this.scaleHandle.alpha = 1;
  }

  public endScale(): void {
    this.scaleHandle.alpha = BoneGraphic.ALPHA.HANDLE;
  }

  public setSelected(selected: boolean): void {
    this._isSelected = selected;
    this.draw();
  }

  get length(): number {
    return this._length;
  }

  set length(value: number) {
    this._length = value;
    this.draw();
  }
}
