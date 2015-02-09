# Google I/O 2015 Experiment (Material Sound)

# Programatically Generated Recordings

Recorded song data can be loaded from 2 serialized formats. The first is the URL-optimized format used for sharing links to recorded songs. It is comprised of nested arrays of integers, which are encoded to URL safe characters.

The second, and vastly more readable format, is the JSON representation of each recorded instrument's data model.

This data can be loaded from the developer console:

```
window.experiment.loadData({ ... });
```

It can then be serialized in the URL-based format using the normal experiment share dialog if you want to share your new recording.

# JSON-encoded Sound & Experiment State

The file format looks like:

```
{
  "ArpeggiatorView":   { ... },
  "DrumView":          { ... },
  "GuitarView":        { ... },
  "HexagonView":       { ... },
  "ParallelogramView": { ... }
}
```

Each instrument has its own data model. They all reference the beat number when the sound plays and the unique name of the sound to play. The beat number is a looping sequence of indexes 0-63. The list of sound names will be discussed later and can be overridden to use your own sounds.

In the data model, sounds are referenced by ID rather than name. To get an ID for a given sound:

```
audioManager.getSound('arp1').guid
```

Which will be defined below:

## Arpeggiator

The quadrant parameter refers to which colored quarter of the instrument the drag handle animates to during playback of each sequence.

```
{
  "recorded": [
    {
      "beat": 0,
      "sound": 10000,
      "quadrant": 0
    },
    {
      "beat": 10,
      "sound": 10001,
      "quadrant": 1
    }
  ]
}
```

## Drums

The individual drum elements can be defined in this instrument. The position should be in the range of `-400` to `+400` in the `x` dimension and `-300` to `+300` in the `y` dimension. The `radius` should be between `0` and `200`. Colors are hexadecimal numbers.

The objects which emit "note dots", which then collide with the drums to produce notes, can be configured as well. These `emitters` have an `x` position between `-400` and `400`. The `y` position can be anything greater than `0`. The `beatModulo` controls how frequently a dot is emitted. A value of `1` is every beat, a value of `2` is every other, and so on.

Recorded notes trigger an animation on a defined drum. The `pid` property refers to the pid of the drum.

```
{
  "drums": [
    {
      "x": -347,
      "y": 262,
      "radius": 70,
      "color": 0xb387ff,
      "sound": 13,
      "pid": 0
    }
  ],
  "emitters": [
    {
      "x": -200,
      "y": 700
      "beatModulo": 2
    }
  ],
  "recorded": [
    {
      "beat": 0,
      "sound": 13,
      "pid": 0
    },
    {
      "beat": 10,
      "sound": 12,
      "pid": 1
    }
  ]
}
```

## Guitar

The guitar instrument is made of rows and columns of pegs, between which strings can be strung. The `rows` and `cols` params control the size of the peg board.

The strings reference two pegs by index. You can think about this as counting across each row at a time. For example: pid 0 is the top left. If there are 5 columns, then pid 4 is the top right. The first peg in the second row would then be pid 5. The strings also have their own unique pid which is used by the recorded notes.

Recorded notes refence the `pid` of a string, so it can be animated on playback.

```
{
  "rows": 3,
  "cols": 5,
  "strings": [
    "pid": 7,
    "pointA": 0,
    "pointB": 10
  ],
  "recorded": [
    {
      "beat": 0,
      "sound": 27,
      "pid": 0
    },
    {
      "beat": 10,
      "sound": 28,
      "pid": 1
    }
  ]
}
```

## Hexagons

The hexagons are pretty simple, but to emit a "wave" from a specific hexagon, you need to address the hexagon with cubic coordinates. It's kind of complicated to think about, so maybe just stick to `[0, 0, 0]` unless you're in the mood to learn some cool things about hexagons: http://www.redblobgames.com/grids/hexagons/

```
{
  "recorded": [
    {
      "beat": 0,
      "sound": 15,
      "cube": [0, 0, 0]
    },
    {
      "beat": 10,
      "sound": 16,
      "cube": [-1, 2, -1]
    }
  ]
}
```

## Parallelograms

By default, there are 5 parallelograms, but you can define more. Each note played references the index of one of those parallelograms to animate on playback.

There is a required `duration` key as most of these sound files play for a very long time, allowing a sustained note of a longer duration to play.

```
{
  "parallelograms": [
    {
      "sound": 21,
      "color": 0x4dd0e0,
      "hovercolor": 0x4dd0e0
    }
  ],
  "recorded": [
    {
      "beat": 62,
      "sound": 21,
      "duration": 5.1,
      "pid": 0
    }
  ]
}
```

## Applying JSON data

Then, load the site and open the Developer Console. Define a function which returns the content of the `.json`.

```
window.experiment.customData = function() {
  return {
    "ArpeggiatorView":   { ... },
    "DrumView":          { ... },
    "GuitarView":        { ... },
    "HexagonView":       { ... },
    "ParallelogramView": { ... }
  };
}
```

Then, start the experiment via the FAB as usual.

# Sound Names

The built-in sound names are:

* arp_synth_A-sharp
* arp_synth_A-sharp2
* arp_synth_C
* arp_synth_C2
* arp_synth_C3
* arp_synth_D-sharp
* arp_synth_D-sharp2
* arp_synth_D-sharp3
* arp_synth_F
* arp_synth_F2
* arp_synth_G
* arp_synth_G2
* drumClap
* drumKick
* drumSnare
* hexagon1
* hexagon2
* hexagon3
* hexagon4
* hexagon5
* parallelogram_A-sharp-major
* parallelogram_C-minor
* parallelogram_D-sharp-major
* parallelogram_G-minor
* parallelogram_G-sharp-major
* stringbass_A-sharp
* stringbass_C2
* stringbass_F
* stringbass_G

In the data model, sounds are referenced by ID rather than name. To get an ID for a given sound:

```
audioManager.getSound('arp1').guid
```

However, it is possible to load a different audio file and define new sound names.

Using the `audiosprite` project from NPM, you can concatenate a directory of mp3 files into a single mp3. This then binds the file name of each mp3 to the output mp3 in a `.json` file. By either naming the mp3 files or renaming the keys in the `.json` file, you can setup new sound names to be used in the experiment. This is how we implement "Cat Mode". I'm not going to spoil it, but if you dig around you can see how to enable it.

To enable your own alternative sound pack, place your concatenated mp3 file on a web server with correctly configured CORS headers to allow cross-domain loading.

Then, load the site and open the Developer Console. Define a function which returns the content of the generated `.json`.

```
window.experiment.getAudioDefinitions = function() {
  return {
    audioSprite: { ... }
  }
}
```

Now, start the experiment via the FAB as usual. Note, this can all be wrapped up into a simple Chrome Extension.

# Build Tool (Webpack)

```
npm install webpack -g
npm install webpack-dev-server -g
```

Dev server (http://localhost:5555/):

```
./bin/watch
```

Build:

```
./bin/build
```
