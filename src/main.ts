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

// Game Start ------------------------------------------------------------
let playerCoins: Coin[] = [];
let serialNumber = 0;

function startGame() {
  // clearBoard();
  const playerCoinsMomento = localStorage.getItem("playerCoins");
  if (playerCoinsMomento === "[]" || !playerCoinsMomento) {
    statusPanel.innerHTML = "No coins collected.";
  } else {
    console.log(playerCoinsMomento);
    const coinArray = JSON.parse(playerCoinsMomento) as Coin[];
    playerCoins = coinArray.map(
      (coinData) => new Coin(coinData.i, coinData.j, coinData.serial)
    );
    formatPlayerCoins();
  }

  const serialNumberString = localStorage.getItem("serialNumber");
  if (serialNumberString) {
    serialNumber = parseInt(serialNumberString);
  } else {
    serialNumber = 0;
  }
  console.log(serialNumber);
}

// Navigation Buttons ------------------------------------------------------------
const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  clearBoard();
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
  });
  updateBoard();
});

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

const resetButton = document.querySelector("#reset")!;
resetButton.addEventListener("click", () => {
  const check = confirm("Are you sure you want to reset ALL data?");
  if (check) {
    resetGame();
    alert("Game was successfully reset.");
  } else {
    alert("Game was not reset.");
  }
});

// Helper Functions ------------------------------------------------------------
function movePlayer(moveLat: number, moveLng: number) {
  const { lat, lng } = playerMarker.getLatLng();
  playerMarker.setLatLng(leaflet.latLng(lat + moveLat, lng + moveLng));
  map.setView(playerMarker.getLatLng());
}

// Status Panel ------------------------------------------------------------
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;

function formatPlayerCoins(): void {
  let output = "";
  playerCoins.forEach((coin) => {
    output += `Coin (${coin.i}, ${coin.j}):${coin.serial}, `;
  });
  statusPanel.innerHTML = output;
}

// Pit Creation ------------------------------------------------------------
const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const mapPits: leaflet.Layer[] = [];

function makePit(i: number, j: number) {
  const bounds = board.getCellBounds({ i: i, j: j });
  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  let coins: Coin[] = [];

  if (localStorage.getItem(`${i},${j}`)) {
    const buffer = new Geocache(0, 0, []);
    const momento = localStorage.getItem(`${i},${j}`);
    buffer.fromMomento(momento!);
    coins = buffer.coins;
  } else {
    const numCoins = Math.floor(luck([i, j, "initialValue"].toString()) * 10);
    for (let x = 0; x < numCoins; x++) {
      const newCoin = new Coin(i, j, serialNumber);
      coins.push(newCoin);

      serialNumber += 1;
      localStorage.setItem("serialNumber", serialNumber.toString());
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

      function createCoinButton(c: Coin) {
        const coinButton = document.createElement("button");
        coinButton.style.backgroundColor = "#c99158";
        coinButton.innerHTML = `Coin (${c.i}, ${c.j}):${c.serial}`;
        coinButton.addEventListener("click", () => {
          playerCoins.push(c);
          formatPlayerCoins();

          // FIXME: toMomento() is "not a function"
          // const serializedCoins = playerCoins.map((coin) => coin.toMomento());
          // localStorage.setItem("playerCoins", JSON.stringify(serializedCoins));

          coinButton.remove();

          // remove c from local coins list
          const index = coins.indexOf(c);
          if (index > -1) {
            coins.splice(index, 1);
          }

          saveCache(c.i, c.j, coins);
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
          const depositCoin = playerCoins.pop()!;
          formatPlayerCoins();
          coins.push(depositCoin);

          coinList.append(createCoinButton(depositCoin));
          saveCache(i, j, coins);

          // FIXME: toMomento() is "not a function"
          // const serializedCoins = playerCoins.map((c) => c.toMomento());
          // localStorage.setItem("playerCoins", JSON.stringify(serializedCoins));
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

// Clear & Update Board ------------------------------------------------------------
function clearBoard() {
  mapPits.forEach((layer) => {
    layer.remove();
  });
}

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

// Geocache Map ------------------------------------------------------------
// KEYS should be formatted "i,j"
function saveCache(i: number, j: number, coins: Coin[]) {
  const cache = new Geocache(i, j, coins);
  localStorage.setItem(`${i},${j}`, cache.toMomento());

  localStorage.setItem("playerCoins", JSON.stringify(playerCoins));
}

// Reset Game ------------------------------------------------------------
function resetGame() {
  serialNumber = 0;
  localStorage.clear();

  clearBoard();
  playerMarker.setLatLng(leaflet.latLng(STARTING_LOCATION));
  map.setView(playerMarker.getLatLng());

  startGame();
  updateBoard();
}

// Main ------------------------------------------------------------
startGame();
updateBoard();
