var DropBallEntity  = require('app/views/drum/DropBallEntity');

module.exports = function DotEmitter() {
  'use strict';

  var stage;
  var world;
  var displayContainerCenter;

  var startX;
  var startY;
  var dotEmitterObj;

  var getNextPIDFunc;

  var beatModulo;

  function init(stage_, displayContainerCenter_, world_, startX_, startY_, dotEmitterObj_, getNextPIDFunc_, beatModulo_) {
    stage = stage_;
    world = world_;
    displayContainerCenter =  displayContainerCenter_;
    startX = startX_;
    startY = startY_;

    dotEmitterObj = dotEmitterObj_;
    getNextPIDFunc = getNextPIDFunc_;

    beatModulo = beatModulo_;
  }

  function dropBall() {
    var dropBallEntity = new DropBallEntity();
    var pid = getNextPIDFunc();
    dropBallEntity.init(stage, pid, displayContainerCenter, world, startX, startY, dotEmitterObj );
    dotEmitterObj[pid] = dropBallEntity;
    return dropBallEntity;
  }

  function onBeat(beatNumber) {
    if (beatNumber % beatModulo === 0) {
      var ball = dropBall();

      var ballBody = ball.getBody();

      var lastTarget = null;

      var onCollision = function({ bodyA, bodyB }) {
        var target;
        if (bodyA === ballBody) {
          target = bodyB;
        } else if (bodyB === ballBody) {
          target = bodyA;
        }

        if (target && (target.drum)) {
          if (!lastTarget || (lastTarget !== target)) {
            target.drum.activate(ball);
          }

          lastTarget = target;
        }
      };

      world.on('beginContact', onCollision);
    }
  }

  return {
    init: init,
    onBeat: onBeat
  };
};
