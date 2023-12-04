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
function movePlayer(moveLat: number, moveLng: number) {
  const { lat, lng } = playerMarker.getLatLng();
  playerMarker.setLatLng(leaflet.latLng(lat + moveLat, lng + moveLng));

  map.setView(playerMarker.getLatLng());
}
northButton.addEventListener("click", () => {
  clearBoard();
  movePlayer(TILE_DEGREES, 0);
  updateBoard();
});
const southButton = document.querySelector("#south")!;
southButton.addEventListener("click", () => {
  clearBoard();
  movePlayer(-TILE_DEGREES, 0);
  updateBoard();
});
const westButton = document.querySelector("#west")!;
westButton.addEventListener("click", () => {
  clearBoard();
  movePlayer(0, -TILE_DEGREES);
  updateBoard();
});
const eastButton = document.querySelector("#east")!;
eastButton.addEventListener("click", () => {
  clearBoard();
  movePlayer(0, TILE_DEGREES);
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
const bus = new EventTarget();

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

      function createCoinButton(coin: Coin) {
        const coinButton = document.createElement("button");
        coinButton.style.backgroundColor = "orange";
        coinButton.innerHTML = `Coin (${coin.i}, ${coin.j}):${coin.serial}`;
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
        return coinButton;
      }

      coins.forEach((coin) => {
        coinList.append(createCoinButton(coin));
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

          coinList.append(createCoinButton(coin));
        }
      });
      container.append(depositButton);
      return container;
    },
    { closeOnClick: false }
  );

  bus.addEventListener(`destroy${i},${j}`, () => {
    map.removeLayer(pit);
  });

  bus.addEventListener(`restore${i},${j}`, () => {
    map.addLayer(pit);
  });

  pit.addTo(map);
}
const caches = new Map();
updateBoard();

function clearBoard() {
  saveCaches();
  const nearbyCells = board.getCellsNearPoint(playerMarker.getLatLng());
  nearbyCells.forEach((cell) => {
    const { i, j } = cell;

    const hasPit = luck([i, j].toString()) < PIT_SPAWN_PROBABILITY;

    if (hasPit) {
      bus.dispatchEvent(new Event(`destroy${i},${j}`));
    }
  });
}

// update board (with cells)
function updateBoard() {
  const nearbyCells = board.getCellsNearPoint(playerMarker.getLatLng());
  nearbyCells.forEach((cell) => {
    const { i, j } = cell;

    const hasPit = luck([i, j].toString()) < PIT_SPAWN_PROBABILITY;
    const hasCache = caches.has(`${i},${j}`);

    if (hasPit && hasCache) {
      bus.dispatchEvent(new Event(`restore${i},${j}`));
    } else if (hasPit) {
      makePit(i, j);
      console.log("created pit");
    }
  });

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
