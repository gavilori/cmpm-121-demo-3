export class Coin {
  i: number;
  j: number;
  serial: number;

  constructor(i: number, j: number, serial: number) {
    this.i = i;
    this.j = j;
    this.serial = serial;
  }

  toString(): string {
    return `coin (${this.i},${this.j}):${this.serial}`;
  }
}
