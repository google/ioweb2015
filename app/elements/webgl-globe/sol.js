/* global IOWA */

/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Returns the unit vector from the center of the earth to the position of the
 * sun on the celestial sphere at the specified time. The positive x-axis
 * emerges from 90˚E on the equator, the posizitve y-axis emerges from the
 * north pole, and the positive z-axis emerges from the prime meridian at the
 * equator.
 * The time is assumed to be specified under the Gregorian Calendar.
 * An optional output array can be provided to avoid an array allocation.
 * Solar position accurate to within 0.01˚.
 * @param {!Date} time
 * @param {!Array<number>} opt_output
 * @return {!Array<number>}
 */
IOWA.WebglGlobe.getSolarPosition = (function() {
  // Based on Meeus, Jean H. Astronomical algorithms. 1991.

  /**
   * Calculates the sun's mean anomaly at time t.
   * @param {number} t
   * @return {number}
   */
  function solarMeanAnomaly(t) {
    return 6.24006 + t * (628.3019552 - 2.6825711e-6 * t);
  }

  /**
   * Calculates the equation of the center of the sun in radians at time t: the
   * difference between the mean anomaly and the true anomaly. Relatively low
   * accuracy.
   * @param {number} t
   * @return {number}
   */
  function sunEqOfCenter(t) {
    var m = solarMeanAnomaly(t);
    return Math.sin(m) * (0.03341611 + t * (-0.0000840725 - t * 2.443461e-7)) +
        Math.sin(2 * m) * (0.0003489437 - t * 1.7627825e-6) +
        Math.sin(3 * m) * 5.0440015e-6;
  }

  /**
   * Calculate the sun's true anomaly in radians at time t. Relatively low
   * accuracy.
   * @param {number} t
   * @return {number}
   */
  function solarTrueAnomaly(t) {
    return solarMeanAnomaly(t) + sunEqOfCenter(t);
  }

  /**
   * Calculate the sun's mean longitude in radians at time t. NOTE: result has
   * not had its range reduced, so use with caution.
   * @param {number} t
   * @return {number}
   */
  function solarMeanLongitude(t) {
    // VSOP87
    return 4.8950631108 + t * (628.3319667 + t * (5.291887161e-6 +
        t * (3.49548227e-10 + t * (-1.1407381e-10 - t * 8.72664626e-14))));
  }

  /**
   * Calculates the sun's true longitude in radians at time t. Relatively low
   * accuracy.
   * @param {number} t
   * @return {number}
   */
  function solarTrueLongitude(t) {
    return solarMeanLongitude(t) + sunEqOfCenter(t);
  }

  /**
   * Calculates the eccentricty of the Earth's orbit at time t. Currently about
   * 0.0167.
   * @param {number} t
   * @return {number}
   */
  function earthOrbitEccentricty(t) {
    return 0.016708634 - t * (0.000042037 + t * 0.0000001267);
  }

  /**
   * Calculates the distance from the Earth to the sun in AUs at time t.
   * @param {number} t
   * @return {number}
   */
  function solarDistance(t) {
    var e = earthOrbitEccentricty(t);
    var radius = (1.000001018 * (1 - e * e)) /
        (1 + e * Math.cos(solarTrueAnomaly(t)));
    return radius;
  }

  /**
   * Calculates the sun's apparent longitude in radians at time t. Relatively
   * low accuracy.
   * @param {number} t
   * @return {number}
   */
  function solarApparentLongitude(t) {
    var aberration = -0.00009933735 / solarDistance(t);

    // Single term of longitude nutation.
    var nutation = -0.000083388 * Math.sin(2.1824386 - 33.75704594 * t);

    return solarTrueLongitude(t) + aberration + nutation;
  }

  /**
   * Returns true obliquity at time t in radians. Calculated as mean ecliptic
   * obliquity plus a smaller nutation correction. Relatively low accuracy.
   * @param {number} t
   * @return {number}
   */
  function obliquity(t) {
    // Mean obliquity in radians. Jet Propulsion Laboratory's DE200, from 1984.
    // Error reaches 1" over 2000 years from J2000.
    var meanObliquity = 0.409093 + t * (-0.000226966 + t * (-2.8604e-9 +
        t * 8.789672e-9));

    // Two terms of obliquity nutation.
    var nutation = 0.0000446029 * Math.cos(2.1824386 - 33.75704594 * t) +
        2.76344e-6 * Math.cos(9.7901277 + 1256.66393 * t);

    return meanObliquity + nutation;
  }

  /**
   * Calculates the sun's declination in radians at time t. Relatively low
   * accuracy.
   * @param {number} t
   * @return {number}
   */
  function solarDeclination(t) {
    return Math.asin(Math.sin(obliquity(t)) *
        Math.sin(solarApparentLongitude(t)));
  }

  /**
   * Calculates the equation of time -- the difference between the hour angles
   * of the true Sun and the mean Sun -- in radians at time t.
   * @param {number} t
   * @return {number}
   */
  function equationOfTime(t) {
    // Approximation from Smart, William. Textbook on Spherical Astronomy. 1956.
    // Variable names matching Meeus.
    var y = Math.tan(obliquity(t) / 2);
    y *= y;

    var l0 = solarMeanLongitude(t);
    var e = earthOrbitEccentricty(t);
    var m = solarMeanAnomaly(t);

    return y * Math.sin(2 * l0) -
        2 * e * Math.sin(m) +
        4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
        y * y * 0.5 * Math.sin(4 * l0) -
        5 / 4 * e * e * Math.sin(2 * m);
  }

  /**
   * Convert from the given time to a time in Julian Centuries (36,525 Julian
   * Days) since the epoch J2000.0. Assumes date is provided in the Gregorian
   * calendar.
   * @param {!Date} time
   * @return {number}
   */
  function getJulianCentury(time) {
    var year = time.getUTCFullYear();
    var month = time.getUTCMonth() + 1;
    var day = time.getUTCDate() +
        (((time.getUTCMilliseconds() / 1000 +
        time.getUTCSeconds()) / 60 +
        time.getUTCMinutes()) / 60 +
        time.getUTCHours()) / 24;

    // Include January and February as the end of the previous year.
    if (month < 3) {
      year -= 1;
      month += 12;
    }

    var century = Math.floor(year / 100);

    var julianDay = Math.floor(365.25 * (year + 4716)) +
        Math.floor(30.6001 * (month + 1)) + day +
        2 - century + Math.floor(century / 4) - 1524.5;

    return (julianDay - 2451545) / 36525;
  }

  return function getSolarPosition(time, opt_output) {
    var t = getJulianCentury(time);

    // Time since midnight, UTC.
    var msSinceMidnight = time % 86400000;

    var meanSolarHourAngle = (msSinceMidnight / 43200000 + 1) * Math.PI;
    var greenwichHourAngle = meanSolarHourAngle + equationOfTime(t);

    var declination = solarDeclination(t);

    // From LHA/dec to celestial sphere coordinate system.
    var output = opt_output || [];
    output[0] = -Math.sin(greenwichHourAngle) * Math.cos(declination);
    output[1] = Math.sin(declination);
    output[2] = Math.cos(greenwichHourAngle) * Math.cos(declination);

    return output;
  };
})();
