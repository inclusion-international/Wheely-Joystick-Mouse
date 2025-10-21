// AHRS.js - AHRS-Modul für Puck.js OHNE Magnetometer
// Berechnet Roll, Pitch und relativen Yaw aus Beschleunigung und Gyroskop
// Nutze: var AHRS = require("AHRS");

var AHRS = (function() {
  // Private Variablen
  var roll = 0, pitch = 0, yaw = 0;
  var lastTime = 0;
  var sampleRate = 12.5; // Hz

  // Sensor-Offsets (können kalibriert werden)
  var accelOffset = {x:0, y:0, z:0};
  var gyroOffset = {x:0, y:0, z:0};

  // Initialisierung
  function init() {
    // Sensoren aktivieren
    Puck.accelOn(sampleRate);
    //Puck.gyroOn();

    // Sensor-Daten abonnieren
    Puck.on('accel', function(accel) {
      update(accel);
    });

    lastTime = getTime();
  }

  // Sensor-Daten aktualisieren
  function update(acc) {
    var now = getTime();
    var dt = (now - lastTime) / 1000;
    lastTime = now;

    accel= acc["acc"];
    gyro = acc["gyro"];

    if (accel) {
      // Beschleunigungswerte korrigieren
      accel.x -= accelOffset.x;
      accel.y -= accelOffset.y;
      accel.z -= accelOffset.z;

      // Roll & Pitch aus Beschleunigung (einfach)
      roll = Math.atan2(accel.y, accel.z);
      pitch = Math.atan2(-accel.x, Math.sqrt(accel.y*accel.y + accel.z*accel.z));
    }

    if (gyro) {
      // Gyro-Drift-Kompensation (einfach)
      gyro.x -= gyroOffset.x;
      gyro.y -= gyroOffset.y;
      gyro.z -= gyroOffset.z;

      // Roll, Pitch und Yaw mit Gyro-Daten aktualisieren
      roll += gyro.x * dt;
      pitch += gyro.y * dt;
      yaw += gyro.z * dt;
    }
  }

  // Aktuelle Orientierung zurückgeben (in Radiant)
  function getOrientation() {
    return {
      roll: roll,
      pitch: pitch,
      yaw: yaw // Relativer Yaw (kann driften!)
    };
  }

 // Aktuelle Orientierung in Grad zurückgeben
  function getOrientationDegree() {
    return {
      roll: (roll * 180 / Math.PI),
      pitch: (pitch * 180 / Math.PI),
      yaw: (yaw * 180 / Math.PI) // Relativer Yaw in Grad
    };
  }

  // Öffentliche API
  return {
    init: init,
    getOrientation: getOrientation,
    getOrientationDegree: getOrientationDegree,
  };
})();

// Initialisierung beim Laden
AHRS.init();

// Export für require()
//exports = AHRS;

interval=setInterval(function() {
  var orientation = AHRS.getOrientationDegree();
  console.log(
    "Roll:", orientation.roll.toFixed(2),
    "Pitch:", orientation.pitch.toFixed(2),
    "Yaw:", orientation.yaw.toFixed(2)
  );
}, 100);

//clearInterval(interval);

