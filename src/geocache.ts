/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Coin } from "./coin";

interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

export class Geocache implements Momento<string> {
  i: number;
  j: number;
  coins: Coin[];

  constructor(i: number, j: number, coins: Coin[]) {
    this.i = i;
    this.j = j;
    this.coins = coins;
  }

  toMomento(): string {
    return JSON.stringify(this);
  }
  fromMomento(momento: string): void {
    const obj = JSON.parse(momento);
    this.i = obj.i;
    this.j = obj.j;
    this.coins = obj.coins;
  }
}
