// SWButton-UI main.js
// Code based on bachelor project of Yuqing and ASSIST HEIDI course SS2024 and modified by Deinhofer

// This code sets up a BLE HID device that can execute stored commands based on button press patterns.
// Commands can be configured via a custom BLE service.
// Supported commands include key presses and mouse actions.

const DEBUG=0; //enable to see console.log messages

// Load necessary modules
// ble_hid_combo provides combined keyboard and mouse HID functionality
var HID = require("ble_hid_combo");

//needed for adversting eddystone URL: URL to configuration website
var eddystone = require("ble_eddystone");

// SWButton.js is a custom javascript module and handles button press patterns (single, double, long press).
// SWButton.js must be stored in the device's storage with the name 'SWButton' using the Espruino IDE.
//var SWBtn = require("SWButton");
var SWBtn=require("https://inclusion-international.github.io/Wheely-Joystick-Mouse/src/Espruino/SWBtn.js");

// Default commands for button press patterns
// S - single press: left click, SS - double press: double click, L - long press: right click
// These can be overridden by stored commands in persistent storage
var defaultStoreCommands = { "S": "AT CL", "SS": "AT CD", "L": "AT CR" };
var storeCommands = { "S": "", "SS": "", "L": "" };

// Read stored commands for each button press pattern from persistent storage
function loadStoredCommands() {
    var stored = require("Storage").read("storeCommands");
    if (stored) {
        storeCommands = JSON.parse(stored);

        console.log("storeCommands = {\n" +
            `    "S": "${storeCommands.S}",\n` +
            `    "SS": "${storeCommands.SS}",\n` +
            `    "L": "${storeCommands.L}"\n` +
            "};");

    } else {
        console.log("storeCommands missing, creating default commands.");
        require("Storage").write("storeCommands", JSON.stringify(defaultStoreCommands));
        loadStoredCommands();
    }
}

// Stores a command for a given button press pattern
function storeCommand(command, pressType) {
    if (!["S", "SS", "L"].includes(pressType)) {
        console.log("Invalid pressType:", pressType);
        return;
    }

    storeCommands[pressType] = String(command).trim();

    try {
        require("Storage").write("storeCommands", JSON.stringify(storeCommands));
        console.log("Successfully updated storeCommands:", JSON.stringify(storeCommands));
    } catch (e) {
        console.log("Storage write failed:", e);
    }
}

// Create additional BLE service for receiving commands
// Command format: S: AT KP A
// S - single press, SS - double press, L - long press
// Example commands: "AT KP A", "AT CL", "AT WU"
// Supported commands: KP (key press), CL (left click), CR (right click), CM (middle click), CD (double click), WU (wheel up), WD (wheel down), DRAG (mouse drag)
var receivedCmd = "";
NRF.setServices({
    0xBCDE: {
        0xABCD: {
            value: "test message",
            writable: true,
            onWrite: function (evt) {
                receivedCmd = "";
                // Convert received data to string
                var n = new Uint8Array(evt.data);
                n.forEach((elem) => receivedCmd += String.fromCharCode(elem));
                receivedCmd = receivedCmd.trim();

                if (!receivedCmd) {
                    console.log("Empty command received, ignoring.");
                    return;
                }
                console.log("RCV cmd: "+receiveCmd);

                // Basic validation of command format
                if (!receivedCmd.includes(":")) {
                    console.log("Invalid command format (missing ':'):", receivedCmd);
                    return;
                }

                // Split into press type and command
                let parts = receivedCmd.split(":");
                if (parts.length === 2) {
                    let pressType = parts[0].trim();
                    let command = parts[1].trim();

                    if (!["S", "SS", "L"].includes(pressType)) {
                        console.log("Unknown press type:", pressType);
                        return;
                    }

                    // Store the command
                    storeCommand(command, pressType);
                } else {
                    console.log("Invalid command format:", receivedCmd);
                }
            }
        },
      0xABCE: {
        value: "Read message",
        readable: true,
        notify: true,
        onRead: function (evt) {
          return "Assistive Puck Device";
        }
      }
    }
}, {// Add HID service
    // Advertise 0xBCDE service alongside HID
    hid: HID.report,
    advertise: [0xBCDE]
});

//NRF.setAdvertising must be called additionally in case we are connected to Windows 11
NRF.setAdvertising([
    {}, // include original Advertising packet
    [   // second packet containing 'appearance'
        2, 1, 6,  // standard Bluetooth flags
        3, 3, 0x12, 0x18, // HID Service
        3, 0x19, 0xc0, 0x03 // : 0xc0 Generic HID, 0xC1 Keyboard, 0xC2 Mouse, 0xc3 Joystick
    ],
    // URL to configuration website
    [eddystone.get("https://l1nq.com/jtNjc")]
]);

// Move mouse action with error handling
function moveMouseAction(x, y, b) {
    try {
        HID.moveMouse(x, y, b);
    } catch (err) {
        digitalPulse(LED1, 1, 300);
        if(DEBUG==1) console.log("Cannot send mouse function, connected as HID device? Reason: " + err.message);
      }
}

function clickButtonAction(b) {
    try {
        HID.clickButton(b);
    } catch (err) {
        digitalPulse(LED1, 1, 300);
        if(DEBUG==1) console.log("Cannot send mouse click, connected as HID device? Reason: " + err.message);
    }
}

function tapKeyAction(k) {
    try {
        if(DEBUG==1) console.log("Sending key: "+k);
        HID.tapKey(k);
    } catch (err) {
        digitalPulse(LED1, 1, 300);
        if(DEBUG==1) console.log("Cannot send key tap, connected as HID device? Reason: " + err.message);
    }
}

// Execute the command associated with the button press pattern
function executeNextCommand(mode) {
    var command = storeCommands[mode];

    if (!command || typeof command !== "string") {
        if(DEBUG==1) console.log("Invalid command format:", JSON.stringify(command));
        return;
    }

    if(DEBUG==1) console.log("Executing command:", command);

    let parts = command.split(" ");
    if (parts[0] === "AT") {
        try {
            if (parts[1] === "KP") {
                let key = parts.slice(2).join(" ").toUpperCase();

                if (!HID.KEY[key]) {
                    if(DEBUG==1) console.log("Unknown key:", key);
                    return;
                }

                try {
                    tapKeyAction(HID.KEY[key]);
                    if(DEBUG==1) console.log("Key pressed:", key);
                } catch (e) {
                    if(DEBUG==1) console.log("Error pressing key:", e);
                }
            } else if (parts[1] === "CL") {
                clickButtonAction(HID.BUTTON.LEFT);
            } else if (parts[1] === "CR") {
                clickButtonAction(HID.BUTTON.RIGHT);
            } else if (parts[1] === "CM") {
                clickButtonAction(HID.BUTTON.MIDDLE);
            } else if (parts[1] === "CD") {
                clickButtonAction(HID.BUTTON.LEFT);
                setTimeout(() => clickButtonAction(HID.BUTTON.LEFT), 100);
            } else if (parts[1] === "WU") {
                HID.scroll(1);
            } else if (parts[1] === "WD") {
                HID.scroll(-1);
            } else if (parts[1] === "DRAG") {
                moveMouseAction(10, 10, 0);
            } else {
                if(DEBUG==1) console.log("Unknown AT command:", command);
            }
        } catch (err) {
            if(DEBUG==1) console.log("Cannot send HID function, connected as HID device? Reason: " + err.message);
        }
    } else {
        if(DEBUG==1) console.log("Invalid command format:", command);
    }
}




// Instantiate SWButton object and initialize it with callback for press patterns
var myButton = new SWBtn(function (k) {
    if(DEBUG==1) console.log("Button press pattern detected:", k);
    executeNextCommand(k);
});

// Initial load of stored commands and integrity check setup
loadStoredCommands();

//if undefined no HID reports are sent repeatedly
//if defined HID reports are sent repeatedly every interval
var sendHIDIntervalFunction;
const mouseMoveInterval = 50; //milliseconds
const keyboardSendInterval = 1000; //milliseconds
const checkTiltInterval = 100; //milliseconds

// Update key presses based on tilt level
function updateKeyPressDegree(a) {
    const sensitivity = 30; // Adjust sensitivity as needed (lower value = higher sensitivity)
    // Use tilt level to control key presses
    var keyToTap;
    if (a.roll > sensitivity) {
        LED2.set();
        keyToTap=HID.KEY.DOWN;
    } else if (a.roll < -sensitivity) {
        LED2.set();
        keyToTap=HID.KEY.UP;
    } else if (a.pitch > sensitivity) {
        LED3.set();
        keyToTap=HID.KEY.RIGHT;
    } else if (a.pitch < -sensitivity) {
        LED3.set();
        keyToTap=HID.KEY.LEFT;
    }
    if(DEBUG==1) console.log("keyToTap: "+keyToTap+" a.roll: "+a.roll+" a.pitch: "+a.pitch);
    if(!sendHIDIntervalFunction && keyToTap) {
        if(DEBUG==1) console.log("Starting repeated key presses for key: "+keyToTap);
        // Initial key press
        tapKeyAction(keyToTap);
        // Repeated key presses
        sendHIDIntervalFunction = setInterval(() => tapKeyAction(keyToTap), keyboardSendInterval);
    } else if(!keyToTap) {
        // No significant tilt, stop repeated key presses
        if(DEBUG==1) console.log("Stopping repeated key presses");
        if(sendHIDIntervalFunction) {
            clearInterval(sendHIDIntervalFunction);
        }
        sendHIDIntervalFunction = undefined;
    }
    LED2.reset();
    LED3.reset();
}

// Update mouse movement based on tilt degree
function updateMouseMovementDegree(a) {
    let x = 0, y = 0;
    const sensitivity = 30; // Adjust sensitivity as needed (lower value = higher sensitivity)
    const speed = 1; // Adjust speed for faster movement
    const max_speed = 25;
    var speed_roll = Math.abs(a.roll) - sensitivity;
    var speed_pitch = Math.abs(a.pitch) - sensitivity;

    speed_roll = speed_roll > max_speed ? max_speed : speed_roll;
    speed_pitch = speed_pitch > max_speed ? max_speed : speed_pitch;

    // Use tilt level to determine mouse speed and direction
    if (a.roll > sensitivity) {
        LED2.set();
        y = speed_roll;
    }
    else if (a.roll < -sensitivity) {
        LED2.set();
        y = -speed_roll;
    }
    if (a.pitch > sensitivity) {
        LED3.set();
        x = speed_pitch;
    }
    else if (a.pitch < -sensitivity) {
        LED3.set();
        x = -speed_pitch;
    }
    if (x != 0 || y != 0) {
        moveMouseAction(x, y, 0);
    }

    LED2.reset();
    LED3.reset();
}

// Handle BLE connection events
NRF.on('connect', function (addr) {
    console.log("Connected to:", addr);
    // Disable security for simplicity
    NRF.setSecurity({ mitm: false, display: false, keyboard: false });

    // Enable accelerometer with default frequency only when connected
    digitalPulse(LED2, 1, 500);
    AHRS.init();
    
    // Start checking tilt for mouse movement or keyboard input depending on tilt level
    //startCheckTiltInterval(updateKeyPressDegree, checkTiltInterval);
    startCheckTiltInterval(updateMouseMovementDegree, mouseMoveInterval);
});

// Handle BLE disconnection events
NRF.on('disconnect', function (reason) {
    console.log("Disconnected, reason:", reason);
    // Turn off accelerometer to save power when not connected
    digitalPulse(LED3, 1, 500);    
    Puck.accelOff();
    // Stop checking tilt level for mouse movement or keyboard input
    stopCheckTiltInterval();
});

//Start AHRS algorithm
//var AHRS = require("AHRS");
var AHRS=require("https://inclusion-international.github.io/Wheely-Joystick-Mouse/src/Espruino/AHRS.js");
AHRS.init();

// Interval function to check tilt and call provided function
var checkTiltIntervalFunction;
// Starts an interval to check tilt and call the provided function
function startCheckTiltInterval(checkFunction, checkInterval) {
    if(!checkTiltIntervalFunction) {
        console.log("Starting checkTiltIntervalFunction");
        checkTiltIntervalFunction = setInterval(() => {
            var orientation = AHRS.getOrientationDegree();
            if(DEBUG==1) {
                console.log("Roll:", orientation.roll.toFixed(2),"Pitch:", orientation.pitch.toFixed(2),"Yaw:", orientation.yaw.toFixed(2));
            }   
            checkFunction(orientation);
        }, checkInterval);
    }
}
// Stops the tilt checking interval
function stopCheckTiltInterval() {
  if(checkTiltIntervalFunction) {
    console.log("Stopping checkTiltIntervalFunction");
    clearInterval(checkTiltIntervalFunction);
    checkTiltIntervalFunction = undefined;
  }
}

Serial1.setConsole(true);
//lowering connection interval reduces bluetooth speed but also reduces power consumption from 665 to 50 (see E.getPowerUsage())
NRF.setConnectionInterval(100);
digitalPulse(LED3, 1, 500);
console.log("Puck.js is ready.");