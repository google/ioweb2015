IOWA.CountdownTimer.Colors = {
  Background: '#00BCD4',
  LightBlue: '#E0F7FA',
  MediumBlue: '#80DEEA',
  DarkBlue: '#00ACC1',
  Black: '#000',
  Shadow: 'rgba(0,0,0,0.4)',
  Divider: 'rgba(255,255,255,0.4)',
  Label: '#445A64'
};

/**
 * Quintic ease-out from:
 * @see: https://github.com/sole/tween.js/blob/master/src/Tween.js
 */
IOWA.CountdownTimer.Easing = function(t) {
  return --t * t * t * t * t + 1;
};

IOWA.CountdownTimer.Animation = {
  In: 1,
  Out: 2
};

IOWA.CountdownTimer.Modes = {
  SingleValue: 1,
  Continuous: 2
};
