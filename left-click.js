var hidReport = new Uint8Array([
  0x05, 0x01, // Usage Page (Generic Desktop)
  0x09, 0x02, // Usage (Mouse)
  0xa1, 0x01, // Collection (Application)
  0x09, 0x01, // Usage (Pointer)
  0xa1, 0x00, // Collection (Physical)
  0x05, 0x09, // Usage Page (Button)
  0x19, 0x01, // Usage Minimum (1)
  0x29, 0x03, // Usage Maximum (3)
  0x15, 0x00, // Logical Minimum (0)
  0x25, 0x01, // Logical Maximum (1)
  0x95, 0x03, // Report Count (3)
  0x75, 0x01, // Report Size (1)
  0x81, 0x02, // Input (Data, Variable, Absolute)
  0x95, 0x01, // Report Count (1)
  0x75, 0x05, // Report Size (5)
  0x81, 0x03, // Input (Constant, Variable, Absolute)
  0x05, 0x01, // Usage Page (Generic Desktop)
  0x09, 0x30, // Usage (X)
  0x09, 0x31, // Usage (Y)
  0x09, 0x38, // Usage (Wheel)
  0x15, 0x81, // Logical Minimum (-127)
  0x25, 0x7f, // Logical Maximum (127)
  0x75, 0x08, // Report Size (8)
  0x95, 0x03, // Report Count (3)
  0x81, 0x06, // Input (Data, Variable, Relative)
  0xc0,       // End Collection
  0xc0        // End Collection
]);

// Set Puck.js to advertise as a Bluetooth HID device
NRF.setServices(undefined, {
  hid: hidReport
});

var pressed = false;

// Function to send a mouse click
function sendMouseClick() {
  // Create a HID report with the left button pressed
  var report = [0x01, 0, 0, 0];
  NRF.sendHIDReport(report, function() {
    // Create a HID report with no buttons pressed
    report = [0, 0, 0, 0];
    NRF.sendHIDReport(report, function() {
      console.log("Mouse click sent");
    });
  });
}

// Button handler
setWatch(function(e) {
  if (!pressed) {
    pressed = true;
    sendMouseClick();
  }
}, BTN, { edge: "rising", debounce: 50, repeat: true });

setWatch(function(e) {
  if (pressed) {
    pressed = false;
  }
}, BTN, { edge: "falling", debounce: 50, repeat: true });

// Enable Bluetooth
NRF.setAdvertising({}, { name: "Puck.js Left-Click" });
