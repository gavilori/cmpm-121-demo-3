import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import "./board.ts";
import { Board } from "./board.ts";

const NULL_ISLAND = {
  lat: 0,
  lng: 0,
};

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
  center: leaflet.latLng(NULL_ISLAND),
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      "&copy; <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
  })
  .addTo(map);

const playerMarker = leaflet.marker(leaflet.latLng(NULL_ISLAND));
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
  });
});

let points = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

class Coin {
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

const playerCoins: Coin[] = [];

let serialNumber = 0;

function makePit(i: number, j: number) {
  board.createCell({ i: i, j: j });
  const bounds = board.getCellBounds({ i: i, j: j });

  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  let value = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
  const coins: Coin[] = [];

  for (let x = 0; x < value; x++) {
    const newCoin = new Coin(i, j, serialNumber);
    coins.push(newCoin);
    serialNumber += 1;
  }

  pit.bindPopup(
    () => {
      const container = document.createElement("div");

      const coinList = document.createElement("div");

      coinList.style.overflowY = "scroll";
      coinList.style.height = "200px";

      container.innerHTML += `
                <div>There is a pit here at "${i},${j}". It has <span id="value">${value}</span> coins.</div>`;
      // container.innerHTML += `<button id="collect">collect</button> <button id="deposit">deposit</button>`;

      coins.forEach((coin) => {
        const coinButton = document.createElement("button");
        coinButton.innerHTML = `Coin (${coin.i}, ${coin.j}):${coin.serial}`;
        coinList.append(coinButton);

        coinButton.addEventListener("click", () => {
          value--;
          container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            value.toString();

          points++;
          statusPanel.innerHTML = `${points} coins accumulated`;

          playerCoins.push(coin);

          coinButton.remove();

          const index = coins.indexOf(coin);
          if (index > -1) {
            coins.splice(index, 1);
          }
        });
      });
      container.append(coinList);

      const depositButton = document.createElement("button");
      depositButton.innerHTML = "Deposit Coin";
      depositButton.addEventListener("click", () => {
        if (points > 0) {
          value++;
          container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            value.toString();

          points--;
          statusPanel.innerHTML = `${points} coins accumulated`;

          const coin = playerCoins.pop()!;
          coins.push(coin);
        }
      });
      container.append(depositButton);

      // const collect = container.querySelector<HTMLButtonElement>("#collect")!;
      // collect.addEventListener("click", () => {
      //   if (value > 0) {
      //     value--;
      //     points++;
      //   }
      //   container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
      //     value.toString();
      //   statusPanel.innerHTML = `${points} points accumulated`;
      // });

      // const deposit = container.querySelector<HTMLButtonElement>("#deposit")!;
      // deposit.addEventListener("click", () => {
      //   if (points > 0) {
      //     value++;
      //     points--;
      //   }
      //   container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
      //     value.toString();
      //   statusPanel.innerHTML = `${points} coins accumulated`;
      // });
      return container;
    },
    { closeOnClick: false }
  );

  pit.addTo(map);
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
      makePit(i, j);
    }
  }
}
