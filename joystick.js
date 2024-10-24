// Fix for power usage if needed
require("puckjsv2-2v05-fix");

// Define the HID report for the mouse
const hidReport = new Uint8Array([
  0x05, 0x01,  // Usage Page (Generic Desktop)
  0x09, 0x02,  // Usage (Mouse)
  0xa1, 0x01,  // Collection (Application)
  0x09, 0x01,  // Usage (Pointer)
  0xa1, 0x00,  // Collection (Physical)
  0x05, 0x09,  // Usage Page (Button)
  0x19, 0x01,  // Usage Minimum (1)
  0x29, 0x03,  // Usage Maximum (3)
  0x15, 0x00,  // Logical Minimum (0)
  0x25, 0x01,  // Logical Maximum (1)
  0x95, 0x03,  // Report Count (3)
  0x75, 0x01,  // Report Size (1)
  0x81, 0x02,  // Input (Data, Variable, Absolute)
  0x95, 0x01,  // Report Count (1)
  0x75, 0x05,  // Report Size (5)
  0x81, 0x03,  // Input (Constant, Variable, Absolute)
  0x05, 0x01,  // Usage Page (Generic Desktop)
  0x09, 0x30,  // Usage (X)
  0x09, 0x31,  // Usage (Y)
  0x09, 0x38,  // Usage (Wheel)
  0x15, 0x81,  // Logical Minimum (-127)
  0x25, 0x7f,  // Logical Maximum (127)
  0x75, 0x08,  // Report Size (8)
  0x95, 0x03,  // Report Count (3)
  0x81, 0x06,  // Input (Data, Variable, Relative)
  0xc0,       // End Collection
  0xc0        // End Collection
]);

// Set Puck.js to advertise as a Bluetooth HID device
NRF.setServices(undefined, {
  hid: hidReport
}, {
  advertise: ['0x1812'],
  uart: false
});

// Function to handle accelerometer (tilt) events
function onAccel(a) {
  let x = 0, y = 0;
  const sensitivity = 500; // Adjust sensitivity as needed (lower value = higher sensitivity)
  const speed = 10; // Adjust speed for faster movement

  // Use accelerometer data to control mouse movement
  if (a.acc.y > sensitivity) y = speed;
  else if (a.acc.y < -sensitivity) y = -speed;
  if (a.acc.x > sensitivity) x = speed;
  else if (a.acc.x < -sensitivity) x = -speed;

  // Send the mouse movement via Bluetooth
  NRF.sendHIDReport([0, x, y, 0], function() {
    // Clear the HID report after sending
    NRF.sendHIDReport([0, 0, 0, 0]);
  });
}

// Enable accelerometer with default frequency (12.5Hz)
Puck.accelOn();

// Listen for accelerometer data
Puck.on('accel', onAccel);

// Optional: Turn off the accelerometer when not needed
// Puck.accelOff();

// Enable Bluetooth advertising
NRF.setAdvertising({}, { name: "Puck.js Joystick" });
