import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board } from "./board.ts";
import { Coin } from "./coin.ts";
import { Geocache } from "./geocache.ts";

// Constants
const NULL_ISLAND = {
  lat: 0,
  lng: 0,
};

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 5;
const PIT_SPAWN_PROBABILITY = 0.1;

// Map Creation
const mapContainer = document.querySelector<HTMLElement>("#map")!;

const STARTING_LOCATION = NULL_ISLAND;

const map = leaflet.map(mapContainer, {
  center: leaflet.latLng(STARTING_LOCATION),
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

const playerMarker = leaflet.marker(leaflet.latLng(STARTING_LOCATION));
playerMarker.bindTooltip("Current Position: ");
playerMarker.addTo(map);

// Navigation Buttons
const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
  });
});

const northButton = document.querySelector("#north")!;
northButton.addEventListener("click", () => {
  const { lat, lng } = playerMarker.getLatLng();
  playerMarker.setLatLng(leaflet.latLng(lat + TILE_DEGREES, lng));
  map.setView(playerMarker.getLatLng());
  updateBoard();
});
const southButton = document.querySelector("#south")!;
southButton.addEventListener("click", () => {
  const { lat, lng } = playerMarker.getLatLng();
  playerMarker.setLatLng(leaflet.latLng(lat - TILE_DEGREES, lng));
  map.setView(playerMarker.getLatLng());
  updateBoard();
});
const westButton = document.querySelector("#west")!;
westButton.addEventListener("click", () => {
  const { lat, lng } = playerMarker.getLatLng();
  playerMarker.setLatLng(leaflet.latLng(lat, lng - TILE_DEGREES));
  map.setView(playerMarker.getLatLng());
  updateBoard();
});
const eastButton = document.querySelector("#east")!;
eastButton.addEventListener("click", () => {
  const { lat, lng } = playerMarker.getLatLng();
  playerMarker.setLatLng(leaflet.latLng(lat, lng + TILE_DEGREES));
  map.setView(playerMarker.getLatLng());
  updateBoard();
});

// Status panel
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins collected.";

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

const playerCoins: Coin[] = [];

function formatPlayerCoins(): void {
  let output = "";
  playerCoins.forEach((coin) => {
    output += `Coin (${coin.i}, ${coin.j}):${coin.serial}, `;
  });
  statusPanel.innerHTML = output;
}

let serialNumber = 0;

function makePit(i: number, j: number) {
  const bounds = board.getCellBounds({ i: i, j: j });

  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  let value = Math.floor(luck([i, j, "initialValue"].toString()) * 10);
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

      container.innerHTML = `<div>Pit (${i},${j})<br>Currently has <span id="value">${value}</span> coins.</div>`;

      coins.forEach((coin) => {
        const coinButton = document.createElement("button");
        coinButton.style.backgroundColor = "orange";
        coinButton.innerHTML = `Coin (${coin.i}, ${coin.j}):${coin.serial}`;
        coinList.append(coinButton);

        coinButton.addEventListener("click", () => {
          value--;
          container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            value.toString();

          playerCoins.push(coin);
          formatPlayerCoins();

          coinButton.remove();

          const index = coins.indexOf(coin);
          if (index > -1) {
            coins.splice(index, 1);
          }
        });
      });
      container.append(coinList);

      // FIXME: depositing coins does not immediately refresh coinList (visual bug)
      const depositButton = document.createElement("button");
      depositButton.innerHTML = "Deposit Coin";
      depositButton.style.backgroundColor = "blue";
      depositButton.addEventListener("click", () => {
        if (playerCoins.length > 0) {
          value++;
          container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            value.toString();

          const coin = playerCoins.pop()!;
          formatPlayerCoins();
          coins.push(coin);
        }
      });
      container.append(depositButton);
      return container;
    },
    { closeOnClick: false }
  );

  pit.addTo(map);
}
const caches = new Map();
updateBoard();

// update board (with cells)
function updateBoard() {
  const nearbyCells = board.getCellsNearPoint(playerMarker.getLatLng());
  nearbyCells.forEach((cell) => {
    if (
      !caches.has(`${cell.i},${cell.j}`) &&
      luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY
    ) {
      makePit(cell.i, cell.j);
    }
  });
  saveCaches();

  playerMarker.setTooltipContent(
    `Current Position: ${playerMarker
      .getLatLng()
      .lat.toFixed(4)}, ${playerMarker.getLatLng().lng.toFixed(4)}`
  );
}

// KEYS should be formatted "i,j"
function saveCaches() {
  const nearbyCells = board.getCellsNearPoint(playerMarker.getLatLng());
  nearbyCells.forEach((cell) => {
    const cache = new Geocache(cell.i, cell.j, []);
    caches.set(`${cell.i},${cell.j}`, cache.toMomento());
  });
}
