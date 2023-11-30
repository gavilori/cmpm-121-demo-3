import leaflet from "leaflet";

interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;
  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;

    this.knownCells = new Map();
    for (let i = 0; i < this.tileWidth; i++) {
      for (let j = 0; j < this.tileWidth; j++) {
        this.knownCells.set(`${i},${j}`, { i: i, j: j });
      }
    }
  }
  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    // ...
    return this.knownCells.get(key)!;
  }
  getCellForPoint(point: leaflet.LatLng): Cell {
    return this.getCanonicalCell({
      i: point.lat,
      j: point.lng,
    });
  }
  /*
  getCellBounds(cell: Cell): leaflet.LatLngBounds | null {
    // ...
    return null;
  }
  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);
    // ...
    return resultCells;
  }
  */
}
