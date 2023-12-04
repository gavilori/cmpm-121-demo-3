import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board } from "./board.ts";
import { Coin } from "./coin.ts";
import { Geocache } from "./geocache.ts";

// Constants ------------------------------------------------------------
const NULL_ISLAND = {
  lat: 0,
  lng: 0,
};

// const MERRILL_CLASSROOM = {
//   lat: 36.9995,
//   lng: -122.0533,
// };

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 5;
const PIT_SPAWN_PROBABILITY = 0.1;

// Map Creation ------------------------------------------------------------
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

// Navigation Buttons ------------------------------------------------------------
const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
  });
});

function movePlayer(moveLat: number, moveLng: number) {
  const { lat, lng } = playerMarker.getLatLng();
  playerMarker.setLatLng(leaflet.latLng(lat + moveLat, lng + moveLng));
  map.setView(playerMarker.getLatLng());
}

const northButton = document.querySelector("#north")!;
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

// Status panel ------------------------------------------------------------
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins collected.";

function formatPlayerCoins(): void {
  let output = "";
  playerCoins.forEach((coin) => {
    output += `Coin (${coin.i}, ${coin.j}):${coin.serial}, `;
  });
  statusPanel.innerHTML = output;
}

// Pit Creation ------------------------------------------------------------
const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const caches = new Map<string, string>();
const playerCoins: Coin[] = [];
const mapPits: leaflet.Layer[] = [];

let serialNumber = 0;

function makePit(i: number, j: number) {
  const bounds = board.getCellBounds({ i: i, j: j });
  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  let coins: Coin[] = [];

  if (caches.has(`${i},${j}`)) {
    const momento = caches.get(`${i},${j}`);
    const buffer = new Geocache(0, 0, []);
    buffer.fromMomento(momento!);
    coins = buffer.coins;
  } else {
    const numCoins = Math.floor(luck([i, j, "initialValue"].toString()) * 10);
    for (let x = 0; x < numCoins; x++) {
      const newCoin = new Coin(i, j, serialNumber);
      coins.push(newCoin);
      serialNumber += 1;
    }
  }

  pit.bindPopup(
    () => {
      const container = document.createElement("div");

      const coinList = document.createElement("div");

      coinList.style.overflowY = "scroll";
      coinList.style.height = "200px";
      coinList.style.width = "250px";

      container.innerHTML = `<div>Pit (${i},${j})</div>`;

      function createCoinButton(coin: Coin) {
        const coinButton = document.createElement("button");
        coinButton.style.backgroundColor = "#c99158";
        coinButton.innerHTML = `Coin (${coin.i}, ${coin.j}):${coin.serial}`;
        coinButton.addEventListener("click", () => {
          playerCoins.push(coin);
          formatPlayerCoins();

          coinButton.remove();

          // remove coin from local coins list
          const index = coins.indexOf(coin);
          if (index > -1) {
            coins.splice(index, 1);
          }

          saveCache(coin.i, coin.j, coins);
          console.log(caches.get(`${coin.i},${coin.j}`));
        });

        return coinButton;
      }

      coins.forEach((coin) => {
        coinList.append(createCoinButton(coin));
      });
      container.append(coinList);

      const depositButton = document.createElement("button");
      depositButton.innerHTML = "Deposit Coin";
      depositButton.style.backgroundColor = "#5fa7d6";
      depositButton.addEventListener("click", () => {
        if (playerCoins.length > 0) {
          const coin = playerCoins.pop()!;
          formatPlayerCoins();
          coins.push(coin);

          coinList.append(createCoinButton(coin));
          saveCache(i, j, coins);
        }
      });
      container.append(depositButton);

      saveCache(i, j, coins);
      return container;
    },
    { closeOnClick: false }
  );

  mapPits.push(pit);
  pit.addTo(map);
}

updateBoard();

// clear board
function clearBoard() {
  mapPits.forEach((layer) => {
    layer.remove();
  });
}

// update board (with cells) ------------------------------------------------------------
function updateBoard() {
  const nearbyCells = board.getCellsNearPoint(playerMarker.getLatLng());
  nearbyCells.forEach((cell) => {
    const { i, j } = cell;
    if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
      makePit(i, j);
    }
  });

  const playerLat = playerMarker.getLatLng().lat / TILE_DEGREES;
  const playerLng = playerMarker.getLatLng().lng / TILE_DEGREES;

  playerMarker.setTooltipContent(
    `Current Position: ${playerLat.toFixed(0)}, ${playerLng.toFixed(0)}`
  );
}

// KEYS should be formatted "i,j"
function saveCache(i: number, j: number, coins: Coin[]) {
  const cache = new Geocache(i, j, coins);
  caches.set(`${i},${j}`, cache.toMomento());
}
