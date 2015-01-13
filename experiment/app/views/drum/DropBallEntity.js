var PIXI = require('pixi.js/bin/pixi.dev.js');
var p2 = require('p2');

module.exports = function DropBallEntity() {
  'use strict';

  var stage;
  var ball;
  var ballContainer;
  var world;
  var ballBody;
  var displayContainerCenter;
  var startX;
  var startY;
  var pid;
  var spawnBallObj;
  var alive = true;
  var bodyDef;
  var destroyCallback = function() {};

  const LIFETIME = 4000;

  function init(stage_, pid_, displayContainerCenter_, world_, startX_, startY_, spawnBallObj_) {
    stage = stage_;
    pid = pid_;
    world = world_;
    displayContainerCenter =  displayContainerCenter_;
    startX = startX_;
    startY = startY_;
    spawnBallObj = spawnBallObj_;

    createSprites();

    setTimeout(willDestroy, LIFETIME);
  }

  function createSprites() {
    ballContainer = new PIXI.DisplayObjectContainer();
    ball = new PIXI.Graphics();
    ball.beginFill(0xffffff, 0.8);
    ball.drawCircle(0, 0, 10);
    ball.endFill();
    ball.radius = 10;

    ballContainer.addChild(ball);

    ballBody = addBody(ball, startX, startY, ball.radius, 20, 0.5);
    renderBodies();
    displayContainerCenter.addChild(ballContainer);
  }

  function addBody(sprite, x, y, width, height, density) {
    var shapeDef;

    shapeDef = new p2.Circle(width);

    bodyDef = new p2.Body({
      position: [x,y],
      mass: 1,
      angularVelocity: 10
    });

    bodyDef.addShape(shapeDef);
    world.addBody(bodyDef);

    var body = bodyDef;

    body.lastDrumCollision = null;

    if (density) {
      body.customType = 'ball';
    }

    body.pid = pid;

    return body;
  }

  function render() {
    renderBodies();
  }

  function destroy() {
    if (alive) {
      alive = false;
      displayContainerCenter.removeChild(ballContainer);
      world.removeBody(ballBody);

      destroyCallback();
    }
  }

  function willDestroy() {
    if (alive) {
      destroy();
      delete spawnBallObj[pid ];
    }
  }

  function renderBodies() {
    if (alive) {
      ballContainer.position.y = ballBody.position[1];
      ballContainer.position.x = ballBody.position[0];
      ballContainer.rotation = ballBody.angle;
    }
  }

  function onDestroy(cb) {
    destroyCallback = cb;
  }

  return {
    init: init,
    destroy: destroy,
    render: render,
    onDestroy: onDestroy,
    getBody: () => bodyDef
  };
};

