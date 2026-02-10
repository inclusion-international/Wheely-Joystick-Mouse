//Code by Sako bachelor project, including fixes by Deinhofer.

// =======================================================
// FABI-COMPATIBLE PUCK.JS MAIN (SUPPORTS S,SS,L,SL,LS,SSS,LL)
// + QUEUED RX NOTIFY (no interleaving)
// + AT GET TILT
// =======================================================

var DEBUG = 1;

// -------------------------
// TILT CONFIG
// -------------------------
let tiltConfig = {
  deadzone: 8,
  sensitivity: 0.6,
  maxSpeed: 20
};

let storedTilt = require("Storage").read("tiltConfig");
if (storedTilt) {
  try { tiltConfig = JSON.parse(storedTilt); }
  catch (e) { console.log("Error loading tiltConfig", e); }
}

// -------------------------
// MODULES
// -------------------------
var HID = require("ble_hid_combo");
var eddystone = require("ble_eddystone");
//var SWBtn = require("SWBtn.js");
var SWBtn = require("https://inclusion-international.github.io/Wheely-Joystick-Mouse/src/Espruino/SWBtn.js");
//var AHRS = require("AHRS.js");
var AHRS = require("https://inclusion-international.github.io/Wheely-Joystick-Mouse/src/Espruino/AHRS.js");

//Default timing of button press patterns
SWBtn.prototype.C =
{
  B: 50
  , L: 0.500
  , P: 500
  , D: 10
};

// -------------------------
// BUTTON COMMAND STORAGE
// BM slots:
// 1=S, 2=SS, 3=L, 4=SL, 5=LS, 6=SSS, 7=LL
// -------------------------
const MAX_BM = 7;

var defaultStoreCommands = {
  "1": "AT CL",
  "2": "AT CD",
  "3": "AT CR",
  "4": "AT KP A",
  "5": "AT KP E",
  "6": "AT KP N",
  "7": "AT KP O"
};

var storeCommands = JSON.parse(
  require("Storage").read("storeCommands") ||
  JSON.stringify(defaultStoreCommands)
);

function saveCommands() {
  require("Storage").write("storeCommands", JSON.stringify(storeCommands));
}

let selectedBM = 1;

// -------------------------
// QUEUED BLE NOTIFY (PUCK -> UI)
// prevents interleaving of multiple replies
// -------------------------
let _rxQueue = [];
let _rxSending = false;

function sendRX(msg) {
  _rxQueue.push(String(msg));
  if (_rxSending) return;
  _rxSending = true;

  const CHUNK = 20;

  function sendNextMessage() {
    if (_rxQueue.length === 0) {
      _rxSending = false;
      return;
    }

    const full = _rxQueue.shift();
    let i = 0;

    function sendChunk() {
      const part = full.substr(i, CHUNK);
      i += CHUNK;

      const bytes = new Uint8Array(part.length);
      for (let k = 0; k < part.length; k++) bytes[k] = part.charCodeAt(k);

      NRF.updateServices({
        0xBCDE: { 0xABCE: { value: bytes, notify: true } }
      });

      if (i < full.length) {
        setTimeout(sendChunk, 40);
      } else {
        setTimeout(sendNextMessage, 40);
      }
    }

    sendChunk();
  }

  sendNextMessage();
}

// -------------------------
// BLE SERVICES
// -------------------------
NRF.setServices({
  0xBCDE: {

    // UI -> PUCK (Write)
    0xABCD: {
      writable: true,
      writeWithoutResponse: true,
      maxLen: 50,
      onWrite: function (evt) {
        var cmd = "";
        new Uint8Array(evt.data).forEach(b => cmd += String.fromCharCode(b));
        cmd = cmd.trim();

        if (DEBUG) console.log("AT RX Received:", cmd);

        // AT ID
        if (cmd === "AT ID") {
          sendRX("FABI v3.7, Device=Puck.js\nOK\n");
          return;
        }

        // AT GET TILT
        if (cmd === "AT GET TILT") {
          let out =
            "DZ " + tiltConfig.deadzone + "\n" +
            "SENS " + tiltConfig.sensitivity + "\n" +
            "MAX " + tiltConfig.maxSpeed + "\n" +
            "OK\n";
          sendRX(out);
          return;
        }

        // AT BM <n>
        if (cmd.startsWith("AT BM")) {
          let n = parseInt(cmd.split(" ")[2]);
          if (n >= 1 && n <= MAX_BM) {
            selectedBM = n;
            sendRX("OK\n");
          } else {
            sendRX("ERR\n");
          }
          return;
        }

        // AT LA (list actions)
        if (cmd === "AT LA") {
          let out = "";
          for (let k = 1; k <= MAX_BM; k++) {
            out += "AT BM " + k + "\n";
            out += (storeCommands[String(k)] || "AT CL") + "\n";
          }
          out += "OK\n";
          sendRX(out);
          return;
        }

        // AT SET DZ/SENS/MAX
        if (cmd.startsWith("AT SET")) {
          let p = cmd.split(" ");
          let key = p[2];
          let val = parseFloat(p[3]);

          if (key === "DZ") tiltConfig.deadzone = val;
          if (key === "SENS") tiltConfig.sensitivity = val;
          if (key === "MAX") tiltConfig.maxSpeed = val;

          require("Storage").write("tiltConfig", JSON.stringify(tiltConfig));
          sendRX("OK\n");
          return;
        }

        // STORE ACTION (any other AT ...)
        if (cmd.startsWith("AT ")) {
          storeCommands[String(selectedBM)] = cmd;
          saveCommands();
          sendRX("OK\n");
          return;
        }

        sendRX("ERR\n");
      }
    },

    // PUCK -> UI (Notify)
    0xABCE: {
      value: new Uint8Array(0),
      readable: true,
      notify: true,
      maxLen: 50
    }
  }
}, {
  hid: HID.report,
  advertise: [0xBCDE]
});

// -------------------------
// ADVERTISING
// -------------------------
NRF.setAdvertising([
  {},
  [
    2, 1, 6,
    3, 3, 0x12, 0x18,
    3, 0x19, 0xc0, 0x03
  ],
  [eddystone.get("https://l1nq.com/jtNjc")]
]);

// -------------------------
// BUTTON EXECUTION
// -------------------------
function executeCommand(cmd) {
  let p = cmd.split(" ");

  try {
    if (p[1] === "CL") HID.clickButton(HID.BUTTON.LEFT);
    else if (p[1] === "CR") HID.clickButton(HID.BUTTON.RIGHT);
    else if (p[1] === "CD") {
      HID.clickButton(HID.BUTTON.LEFT);
      setTimeout(() => HID.clickButton(HID.BUTTON.LEFT), 100);
    }
    else if (p[1] === "WU") HID.scroll(1);
    else if (p[1] === "WD") HID.scroll(-1);
    else if (p[1] === "KP") {
      let k = p.slice(2).join(" ");
      if (HID.KEY[k]) HID.tapKey(HID.KEY[k]);
    }
  } catch (err) {
    console.log("Cannot send HID function, connected as HID device? Reason: " + err.message);
  }
}

// -------------------------
// BUTTON PATTERN → BM SLOT
// -------------------------
var myButton = new SWBtn(function (pattern) {
  let map = {
    "S": "1",
    "SS": "2",
    "L": "3",
    "SL": "4",
    "LS": "5",
    "SSS": "6",
    "LL": "7"
  };

  let key = map[pattern];
  if (!key) return;

  let cmd = storeCommands[key];
  if (cmd) {
    console.log("Button press: " + pattern + " -> " + cmd);
    executeCommand(cmd);
  }
});

// -------------------------
// TILT MOUSE
// -------------------------
function moveMouse(a) {
  let x = 0, y = 0;

  if (Math.abs(a.roll) > tiltConfig.deadzone)
    y = Math.sign(a.roll) * Math.min(
      (Math.abs(a.roll) - tiltConfig.deadzone) * tiltConfig.sensitivity,
      tiltConfig.maxSpeed
    );

  if (Math.abs(a.pitch) > tiltConfig.deadzone)
    x = Math.sign(a.pitch) * Math.min(
      (Math.abs(a.pitch) - tiltConfig.deadzone) * tiltConfig.sensitivity,
      tiltConfig.maxSpeed
    );

  try {
    if (x || y) HID.moveMouse(x, y, 0);
  } catch (err) {
    //console.log("Cannot send HID.moveMouse, Reason: "+err);
  }
}

//Store tiltInterval function
var tiltInterval = null;

// Handle BLE connection events
NRF.on("connect", (addr) => {
  digitalPulse(LED2, 1, 500);
  console.log("Connected to:", addr);
  // Disable security for simplicity
  NRF.setSecurity({ mitm: false, display: false, keyboard: false });

  AHRS.init();
  tiltInterval = setInterval(() => {
    if (!NRF.getSecurityStatus().connected) {
      clearInterval(tiltInterval);
      tiltInterval = null;
      return;
    }
    moveMouse(AHRS.getOrientationDegree());
    //mouse updaet rate of 25 seems to be enough, in case of 50 there are transmission errors.
  }, 25);
});

// Handle BLE disconnection events
NRF.on('disconnect', function (reason) {
  console.log("Disconnected, reason:", reason);
  // Turn off accelerometer to save power when not connected
  digitalPulse(LED3, 1, 500);
  Puck.accelOff();
  // Stop checking tilt level for mouse movement or keyboard input
  if (tiltInterval) {
    clearInterval(tiltInterval);
    tiltInterval = null;
  }
});

//Set to Serial1.setConsole if connected via serial interface
//Serial1.setConsole(true);
console.log("FABI-compatible Puck.js ready (queued RX + GET TILT).");
console.log("i am");