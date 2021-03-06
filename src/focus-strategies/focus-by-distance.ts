import { Direction, isHorizontal } from '../model';

class PotentialElement {
  public rect: ClientRect;
  public percentInShadow = 0;
  public primaryDistance = Infinity;
  public secondaryDistance = Infinity;

  constructor(public el: HTMLElement) {
    this.rect = this.el.getBoundingClientRect();
  }

  public calcPercentInShadow(refRect: ClientRect, dir: Direction) {
    if (isHorizontal(dir)) {
      this.percentInShadow =
        Math.min(this.rect.bottom, refRect.bottom) - Math.max(this.rect.top, refRect.top);
    } else {
      this.percentInShadow =
        Math.min(this.rect.right, refRect.right) - Math.max(this.rect.left, refRect.left);
    }
  }

  public calcPrimaryDistance(refRect: ClientRect, dir: Direction) {
    switch (dir) {
      case Direction.LEFT:
        this.primaryDistance = refRect.left - this.rect.right;
        break;
      case Direction.RIGHT:
        this.primaryDistance = this.rect.left - refRect.right;
        break;
      case Direction.UP:
        this.primaryDistance = refRect.top - this.rect.bottom;
        break;
      case Direction.DOWN:
        this.primaryDistance = this.rect.top - refRect.bottom;
        break;
      default:
        throw new Error(`Invalid direction ${dir}`);
    }
  }

  public calcSecondaryDistance(refRect: ClientRect, dir: Direction) {
    if (isHorizontal(dir)) {
      const refCenter = refRect.top + refRect.height / 2;
      const isAbove = this.rect.bottom < refCenter;

      this.secondaryDistance = isAbove ? refCenter - this.rect.bottom : this.rect.top - refCenter;
    } else {
      const refCenter = refRect.left + refRect.width / 2;
      const isLeft = this.rect.right < refCenter;

      this.secondaryDistance = isLeft ? refCenter - this.rect.right : this.rect.left - refCenter;
    }
  }
}

export class ElementFinder {
  private shortlisted: PotentialElement[];

  constructor(
    private dir: Direction,
    private refRect: ClientRect,
    candidates: HTMLElement[],
    private prevEl?: HTMLElement,
  ) {
    this.shortlisted = candidates.map(candidate => new PotentialElement(candidate));
  }

  public find() {
    this.shortlisted = this.getElementsInDirection();
    this.shortlisted = this.shortlisted.filter(el => el.rect.width && el.rect.height);
    if (!this.shortlisted.length) {
      return null;
    }

    this.shortlisted.forEach(el => el.calcPercentInShadow(this.refRect, this.dir));

    const hasElementsInShadow = this.shortlisted.some(el => el.percentInShadow > 0);
    // Case: No elements in shadow
    //                   +------+
    //                   |      |
    //                   +------+
    // +---------+ --------------
    // |  X ->   |
    // +---------+---------------
    //              +------+   +------+
    //              |   X  |   |      |
    //              |      |   |      |
    //              +------+   +------+
    if (!hasElementsInShadow) {
      if (isHorizontal(this.dir)) {
        return null;
      }

      this.shortlisted.forEach(el => el.calcPrimaryDistance(this.refRect, this.dir));
      const shortestPrimaryDist = this.getShortestPrimaryDist(this.shortlisted);

      this.shortlisted = this.shortlisted.filter(el => el.primaryDistance === shortestPrimaryDist);
      this.shortlisted.forEach(el => el.calcSecondaryDistance(this.refRect, this.dir));

      //return the closest element on secondary axis
      return this.shortlisted.reduce(
        (prev, curr) => (curr.secondaryDistance <= prev.secondaryDistance ? curr : prev),
      ).el;
    }

    this.shortlisted = this.shortlisted.filter(el => el.percentInShadow > 0);
    this.shortlisted.forEach(el => el.calcPrimaryDistance(this.refRect, this.dir));
    const shortestDist = this.getShortestPrimaryDist(this.shortlisted);

    this.shortlisted = this.shortlisted.filter(el => el.primaryDistance === shortestDist);

    // Case: Multiple elements in shadow
    // +---------+ -------------------------
    // |         |                +------+
    // |         |                |      |
    // |  X ->   |                |      |
    // |         |                +------+
    // |         |   +------+
    // +---------+--------------------------
    //               |      |
    //               +------+
    if (this.shortlisted.length === 1) {
      return this.shortlisted[0].el;
    }

    // Case: Mutiple elements in shadow with equal distance
    // +---------++------+
    // |         ||      |
    // |         ||      |
    // |  X ->   |+------+
    // |         ||      |
    // |         ||      |
    // +---------++------+
    if (this.prevEl && this.shortlisted.some(el => el.el === this.prevEl)) {
      return this.prevEl;
    }

    if (isHorizontal(this.dir)) {
      //return top most element
      return this.shortlisted.reduce((prev, curr) => (curr.rect.top < prev.rect.top ? curr : prev))
        .el;
    } else {
      //return top left element
      return this.shortlisted.reduce(
        (prev, curr) => (curr.rect.left < prev.rect.left ? curr : prev),
      ).el;
    }
  }

  private getElementsInDirection() {
    return this.shortlisted.filter(el => {
      switch (this.dir) {
        case Direction.LEFT:
          return el.rect.right <= this.refRect.left;
        case Direction.RIGHT:
          return el.rect.left >= this.refRect.right;
        case Direction.UP:
          return el.rect.bottom <= this.refRect.top;
        case Direction.DOWN:
          return el.rect.top >= this.refRect.bottom;
        default:
          throw new Error(`Invalid direction ${this.dir}`);
      }
    });
  }

  private getShortestPrimaryDist(elements: PotentialElement[]) {
    let shortestDist = elements[0].primaryDistance;
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].primaryDistance < shortestDist) {
        shortestDist = elements[i].primaryDistance;
      }
    }
    return shortestDist;
  }
}
