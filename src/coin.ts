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

  toMomento(): string {
    return JSON.stringify(this);
  }

  fromMomento(momento: string): void {
    const obj = JSON.parse(momento) as Coin;
    this.i = obj.i;
    this.j = obj.j;
    this.serial = obj.serial;
  }
}
