let puckDevice = null;
let gattServer = null;
let characteristic = null;
 
window.showError = function(message) {
    const errorBox = document.getElementById("error-message");
    if (!errorBox) {
        console.error("Error message div not found!");
        return;
    }
    errorBox.innerText = "Error: " + message;
    errorBox.style.display = "block"; // Show error
}

window.hideError = function() {
    const errorBox = document.getElementById("error-message");
    if (!errorBox) return;
    errorBox.style.display = "none";
}

const PUCK_BLE_CHARACTERISTIC = 0xBCDE;
const PUCK_AT_COMMAND_WRITE_CHARACTERISTIC = 0xABCD;
// Connect to Puck.js
async function connectToPuck() {
    try {
        console.log("Requesting Puck.js device...");
        puckDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [0xBCDE]
        });

        if (!puckDevice) throw new Error("No device selected");

        puckDevice.addEventListener("gattserverdisconnected", handleDisconnect);

        console.log("Connecting to GATT Server...");
        gattServer = await puckDevice.gatt.connect();

        await new Promise(resolve => setTimeout(resolve, 1000));

        const service = await gattServer.getPrimaryService(PUCK_AT_COMMAND_SERVICE);
        characteristic = await service.getCharacteristic(PUCK_AT_COMMAND_WRITE_CHARACTERISTIC);

        document.getElementById("status").textContent = "Status: Connected";
        document.getElementById("status").classList.add("connected");
        document.getElementById("disconnect").disabled = false;
        document.getElementById("connect").disabled = true;
        hideError(); // Hide error after successful connection
        console.log("Connected to Puck.js");

    } catch (error) {
        console.error("Connection failed:", error);
        showError("Connection failed! Please check your device.");
        document.getElementById("status").textContent = "Status: Connection Failed";
    }
}

async function disconnectFromPuck() {
    if (!puckDevice || !puckDevice.gatt) {  // Check if puckDevice exists
        console.warn("No device to disconnect.");
        showError("Kein Gerät verbunden!");
        return;
    }

    try {
        console.log("Disconnecting from Puck.js...");

        if (puckDevice.gatt.connected) {  
            await puckDevice.gatt.disconnect(); 
            console.log("Successfully disconnected from Puck.js.");
        } else {
            console.warn("Puck.js was already disconnected.");
        }

        // Update UI state
        document.getElementById("status").textContent = "Status: Disconnected";
        document.getElementById("status").classList.remove("connected");
        document.getElementById("disconnect").disabled = true;
        document.getElementById("connect").disabled = false;

        showError("No device connected!");  // Show error message after disconnect

    } catch (error) {
        console.error("Error while disconnecting:", error);
        showError("Error while disconnecting!");
    }
}

// Handle disconnect
function handleDisconnect() {
    console.warn("Puck.js Disconnected!");
    document.getElementById("status").textContent = "Status: Disconnected";
    document.getElementById("status").classList.remove("connected");
    document.getElementById("disconnect").disabled = true;
    document.getElementById("connect").disabled = false;
    hideError(); // Hide error after disconnect
}

async function sendATCommand(command, pressType) {
    try {
        console.log(`Sending command: ${command} (${pressType})`);

        if (!puckDevice || !puckDevice.gatt.connected) {
            console.warn("Device not connected.");
            showError("Puck.js ist nicht verbunden! Bitte zuerst verbinden.");
            return;
        }
        
        if (!characteristic) {
            console.error("Characteristic is NULL, cannot send command!");
            showError("Fehler: Keine gültige Verbindung zum Gerät.");
            return;
        }

        let encoder = new TextEncoder();
        let formattedCommand = `${pressType}: ${command}\n`; // Ensure correct format

        try {
            await characteristic.writeValue(encoder.encode(formattedCommand));
            console.log("Command sent to Puck.js:", formattedCommand);
            hideError();
        } catch (gattError) {
            console.error("GATT Write Error:", gattError);
            showError("Fehler beim Senden des Befehls (GATT Fehler).");
            return;
        }

        // Store the latest storeCommands locally (to read after disconnection)
        let storeCommands = JSON.parse(localStorage.getItem("storeCommands")) || {};
        storeCommands[pressType] = command;
        localStorage.setItem("storeCommands", JSON.stringify(storeCommands));
        console.log("Updated local storeCommands:", storeCommands);

        document.getElementById("log").innerText = `Command sent: ${command} (${pressType})`;
        document.getElementById("log").style.color = "green";

    } catch (error) {
        console.error("Error sending command:", error);
        showError("Fehler beim Senden des Befehls!");
        document.getElementById("log").textContent = "Error sending command!";
        document.getElementById("log").style.color = "red";
    }
}


// Action options list, including mouse functions, all letters, numbers, function keys, navigation keys, and special characters
const actionOptions = [];

// Add mouse functions
const mouseActions = ["CL", "CR", "CM", "CD", "WU", "WD", "DRAG"];
mouseActions.forEach(action => {
    actionOptions.push({ value: `AT ${action}`, text: action.replace("CL", "Left Click").replace("CR", "Right Click").replace("CM", "Middle Click").replace("CD", "Double Click").replace("WU", "Scroll Up").replace("WD", "Scroll Down").replace("DRAG", "Drag") });
});

// Add all letters (A-Z, a-z)
for (let i = 65; i <= 90; i++) {
    actionOptions.push({ value: `AT KP ${String.fromCharCode(i)}`, text: `Press Key ${String.fromCharCode(i)}` });
    actionOptions.push({ value: `AT KP ${String.fromCharCode(i).toLowerCase()}`, text: `Press Key ${String.fromCharCode(i).toLowerCase()}` });
}

// Add numbers 0-9
for (let i = 0; i <= 9; i++) {
    actionOptions.push({ value: `AT KP ${i}`, text: `Press Key ${i}` });
}

// Add special characters
const specialChars = [
    "ENTER", "ESC", "BACKSPACE", "TAB", "SPACE", "-", "=", "[", "]", "\\",
    "NUMBER", ";", "'", "~", ",", ".", "/"
];
specialChars.forEach(char => {
    actionOptions.push({ value: `AT KP ${char}`, text: `Press ${char}` });
});

// Add function keys (F1-F12)
for (let i = 1; i <= 12; i++) {
    actionOptions.push({ value: `AT KP F${i}`, text: `Press F${i}` });
}
// Add system keys
const systemKeys = ["PRINTSCREEN", "SCROLL_LOCK", "PAUSE", "INSERT", "HOME", "PAGE_UP",
    "DELETE", "END", "PAGE_DOWN", "CAPS_LOCK"];
systemKeys.forEach(key => {
    actionOptions.push({ value: `AT KP ${key}`, text: `Press ${key}` });
});

// Add navigation keys
const navigationKeys = ["RIGHT", "LEFT", "DOWN", "UP"];
navigationKeys.forEach(key => {
    actionOptions.push({ value: `AT KP ${key}`, text: `Press ${key}` });
});

// Add numpad keys
const numPadKeys = ["NUM_LOCK", "PAD_SLASH", "PAD_ASTERIX", "PAD_MINUS", "PAD_PLUS",
    "PAD_ENTER", "PAD_1", "PAD_2", "PAD_3", "PAD_4", "PAD_5", "PAD_6",
    "PAD_7", "PAD_8", "PAD_9", "PAD_0", "PAD_PERIOD"];
numPadKeys.forEach(key => {
    actionOptions.push({ value: `AT KP ${key}`, text: `Press ${key}` });
});

// Output the final actionOptions
console.log("Updated actionOptions:", actionOptions);
window.onload = function () {
    // Fill all select options
    document.querySelectorAll(".actionSelect").forEach(select => {
        actionOptions.forEach(option => {
            let newOption = document.createElement("option");
            newOption.value = option.value;
            newOption.textContent = option.text;
            select.appendChild(newOption);
        });
    });

    // Ensure button event bindings
    document.getElementById("connect").addEventListener("click", connectToPuck);
    document.getElementById("disconnect").addEventListener("click", disconnectFromPuck);

    // Bind "Send Action" button to call sendATCommand()
    document.querySelectorAll(".sendAction").forEach(button => {
        button.addEventListener("click", function () {
            let pressType = this.getAttribute("data-type");
            let selectId = `actionSelect${pressType}`;
            let selectedCommand = document.getElementById(selectId).value;
            console.log(`Send Action Clicked: ${pressType}, Command: ${selectedCommand}`); // Debug info
            sendATCommand(selectedCommand, pressType);
        });
    });

    console.log("Event listeners for connect/disconnect/sendAction buttons added.");
};