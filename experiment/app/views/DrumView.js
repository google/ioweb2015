var PIXI = require('pixi.js/bin/pixi.dev.js');
var p2 = require('p2');
var events = require('app/util/events');
var DotEmitter = require('app/views/drum/DotEmitter');
var Drum = require('app/views/drum/Drum');
var DrumsDataModel = require('app/models/drums');
var { DrumNoteModel } = DrumsDataModel;

module.exports = (function() {
  'use strict';

  const VIEW_NAME = 'DrumView';

  return function DrumView(audioManager) {
    var world = new p2.World();

    var stage;
    var data;

    const DRUM_TAG = audioManager.addTag(VIEW_NAME);
    const CHANNEL = audioManager.channels.create();

    var drums;
    var drumLookup = {};

    // textures
    var groundT;

    var dotEmitterObj = {};

    // sprites
    var ground;

    var PIDINC = 0;
    var renderPause = false;
    var displayContainerCenter;

    var APPLICATION_STATE = 'collapsed';
    var pid;
    var DropballEntityPIDInc = 6000;

    var emitters;

    var isReady = false;
    var isRecording = false;
    var currentBeat;
    var currentTrack;

    var maxWidth = 1100;
    var maxHeight = 700;

    function init(stage_, pid_, displayContainerCenter_) {
      stage = stage_;
      pid = pid_;
      displayContainerCenter = displayContainerCenter_;

      groundT = new PIXI.DisplayObjectContainer();
      displayContainerCenter.addChild(groundT);

      ground = addBody(groundT, 0, -maxHeight, 4000, 10);

      world.on('postBroadphase', function({ pairs }) {
        for (var i = pairs.length - 2; i >= 0; i -= 2) {
          var b1 = pairs[i];
          var b2 = pairs[i + 1];

          var areBothBalls = (b1.customType === 'ball') && (b2.customType === 'ball');

          if (areBothBalls) {
            pairs.splice(i, 2);
          }
        }
      });

      world.on('beginContact', function(event) {
        collisionStart(event.bodyA, event.bodyB);
      });

      events.addListener('BEAT', function(beatNum) {
        currentBeat = beatNum;
      });

      audioManager.playbackBus.onPlayback(function(note, tags) {
        if (renderPause) { return; }

        if (tags & DRUM_TAG) {
          if (APPLICATION_STATE === 'collapsed') {
            var d = drumLookup[note.pid];

            if (d) {
              d.emitCircle();
            }
          }
        }
      });

      //renderBodies( null )
      isReady = true;
    }

    function recordSound(d) {
      if (!isRecording) { return; }

      data.recorded.push(new DrumNoteModel({
        beat: currentBeat,
        pid: d.pid,
        sound: audioManager.getSound(d.soundName).guid
      }));
    }

    function startRecording() {
      isRecording = true;

      data.recorded = [];
    }

    function stopRecording() {
      isRecording = false;

      currentTrack = audioManager.createRecordedTrack(
          data.recorded,
          CHANNEL,
          DRUM_TAG
          );
    }

    function getNextPID() {
      DropballEntityPIDInc = DropballEntityPIDInc + 1;
      return DropballEntityPIDInc;
    }

    function loadData(d) {
      data = d;

      currentTrack = audioManager.createRecordedTrack(
          data.recorded,
          CHANNEL,
          DRUM_TAG
          );

      audioManager.addTrack(currentTrack);

      drums = data.drums.map(function(drumDef) {
        var drum = new Drum(drumDef, drumDef.color, drumDef.sound, world);

        drum.setPosition(drumDef.x, drumDef.y);

        drum.onActivate(function(d) {
          audioManager.playSoundOnNextBeat(d.soundName, CHANNEL);
          recordSound(d);
        });

        displayContainerCenter.addChild(drum.container);
        drumLookup[drum.pid] = drum;

        return drum;
      });

      emitters = data.emitters.map(function(emitterDef) {
        var e = new DotEmitter(audioManager);
        e.init(stage, displayContainerCenter, world, emitterDef.x, emitterDef.y, dotEmitterObj, getNextPID, emitterDef.beatModulo, audioManager);
        return e;
      });
    }

    function addBody(sprite, x, y, width, height, density) {
      var shapeDef;
      var bodyDef;

      if (density) {
        shapeDef = new p2.Circle(width);
        bodyDef = new p2.Body({
          position: [x, y],
          mass: 1,
          angularVelocity: 10,
          angle: 1,
          velocity: [1, 1],
          damping: 0.05
        });
      } else if (sprite === groundT) {
        shapeDef = new p2.Rectangle(width, height);
        bodyDef = new p2.Body({
          position: [x, y],
          mass: 0,
          type: 4
        });
      }

      bodyDef.addShape(shapeDef);
      world.addBody(bodyDef);

      var body = bodyDef;

      if (density) {
        body.customType = 'ball';
      } else if (sprite === groundT) {
        body.customType = 'floor';
      }

      body.pid = PIDINC;
      body.worlds = world;

      PIDINC = PIDINC + 1;
      return body;
    }

    function collisionStart(bodyA, bodyB) {
      if (bodyB.customType === 'floor') {
        dotEmitterObj[bodyA.pid].destroy();
        delete dotEmitterObj[bodyA.pid];
      }
    }

    function disable() {
      renderPause = true;
    }

    function enable() {
      renderPause = false;
    }

    function animationCollapsed() {
      APPLICATION_STATE = 'collapsed';

      audioManager.addTrack(currentTrack);
      removeEventListeners();
    }

    function animationExpanded() {
      APPLICATION_STATE = 'expand';

      audioManager.removeTrack(currentTrack);
      addEventListeners();
    }

    function addEventListeners() {
      events.addListener('BEAT', onBeat);

      drums.forEach(d => d.addEventListeners());
    }

    function removeEventListeners() {
      events.removeListener('BEAT', onBeat);

      drums.forEach(d => d.removeEventListeners());
    }

    function onBeat(beatNumber) {
      for (let i = 0; i < emitters.length; i++) {
        emitters[i].onBeat(beatNumber);
      }
    }

    function resize(w, h, optimalWidth) {
      if (!isReady) { return; }

      var zoom = optimalWidth / maxWidth;
      displayContainerCenter.scale.x = zoom;  // zoom in
      displayContainerCenter.scale.y = -zoom; // Note: we flip the y axis to make 'up' the physics 'up'
    }

    function render(delta) {
      if (renderPause === false) {
        if (APPLICATION_STATE === 'expand') {
          renderExpanded(delta);
        } else {
          renderCollapsed(delta);
        }
      }
    }

    function renderExpanded(delta) {
      renderBodies(delta);
      world.step(1 / 60, delta * 1000);
    }

    function renderCollapsed(delta) {
      renderBodies(delta);
      world.step(1 / 60, delta * 1000);
    }

    function renderBodies(delta) {
      for (let i = 0; i < drums.length; i++) {
        drums[i].render(delta);
      }

      groundT.position.y = ground.position[1];
      groundT.position.x = ground.position[0] - 2000;

      for (let pid in dotEmitterObj) {
        if (dotEmitterObj.hasOwnProperty(pid)) {
          dotEmitterObj[pid].render();
        }
      }
    }

    return {
      init,
      animationCollapsed,
      animationExpanded,
      enable,
      disable,
      render,
      resize,
      startRecording,
      stopRecording,
      loadData,
      name: VIEW_NAME,
      dataModel: DrumsDataModel,
      getData: () => data,
      backgroundColor: 0x7c4dff,
      getChannel: () => CHANNEL
    };
  };
})();
