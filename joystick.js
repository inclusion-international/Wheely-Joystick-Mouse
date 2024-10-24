var int = require("ble_hid_combo");
NRF.setServices(undefined, { hid : int.report });

//require("puckjsv2-accel-tilt").on();
// turn off with require("puckjsv2-accel-tilt").off();

// Function to handle accelerometer (tilt) events
function onAccel(a) {
  let x = 0, y = 0;
  const sensitivity = 3000; // Adjust sensitivity as needed (lower value = higher sensitivity)
  const speed = 10; // Adjust speed for faster movement
  
  console.log("x="+a.acc.x);
  console.log("y="+a.acc.y);
  

  // Use accelerometer data to control mouse movement
  if (a.acc.y > sensitivity) {
    LED2.set();
    y = speed;
  }
  else if (a.acc.y < -sensitivity) {
    LED2.set();
    y = -speed;
  }
  if (a.acc.x > sensitivity) {
    LED1.set();
    x = -speed;
  }
  else if (a.acc.x < -sensitivity) {
    LED1.set();
    x = speed;
  }

  //digitalPulse(LED1,1,100);
  int.moveMouse(x,y);
  // Send the mouse movement via Bluetooth
  //NRF.sendHIDReport([0, x, y, 0], function() {
    // Clear the HID report after sending
    //NRF.sendHIDReport([0, 0, 0, 0]);
  //});
  LED1.reset();
  LED2.reset();
  LED3.reset();
}

// Enable accelerometer with default frequency (26Hz)
Puck.accelOn(26);

// Listen for accelerometer data
Puck.on('accel', onAccel);

// Optional: Turn off the accelerometer when not needed
// Puck.accelOff();

// Enable Bluetooth advertising
//NRF.setAdvertising({}, { name: "Puck.js Joystick" });
