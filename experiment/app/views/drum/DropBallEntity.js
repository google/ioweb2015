var PIXI = require('pixi.js/bin/pixi.dev.js');
var p2 = require('p2');
var rAFTimeout = require('app/util/rAFTimeout');
var {generateTexture} = require('app/util/generateTexture');

module.exports = (function() {
  'use strict';

  var cachedTexture;

  function DropBallEntity(renderer) {
    var stage;
    var ball;
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

    /**
     * Init a drop ball entity.
     * @param {PIXI.Stage} stage_ - The PIXI stage for this emitter.
     * @param {number} pid_ - The PID of this drop ball entity.
     * @param {PIXI.DisplayObjectContainer} displayContainerCenter_ - The PIXI display container for this entity.
     * @param {Object} world_ - This emitter world.
     * @param {number} startX_ - The X start position for this emitter.
     * @param {number} startY_ - The Y start position for this emitter.
     * @param {Object} spawnBallObj_ - The ball spawner object.
     */
    function init(stage_, pid_, displayContainerCenter_, world_, startX_, startY_, spawnBallObj_) {
      stage = stage_;
      pid = pid_;
      world = world_;
      displayContainerCenter =  displayContainerCenter_;
      startX = startX_;
      startY = startY_;
      spawnBallObj = spawnBallObj_;

      createSprites();

      rAFTimeout(destroy, LIFETIME);
    }

    /**
     * Create the circle sprite for the ball.
     */
    function createSprites() {
      if (!cachedTexture) {
        var textureGfx = new PIXI.Graphics();
        textureGfx.clear();
        textureGfx.beginFill(0xffffff, 0.8);
        textureGfx.drawCircle(0, 0, 10);
        textureGfx.endFill();
        cachedTexture = generateTexture(textureGfx);
        renderer.updateTexture(cachedTexture.baseTexture);
      }
      ball = new PIXI.Sprite(cachedTexture);

      ballBody = addBody(ball, startX, startY, 10, 20, 0.5);
      renderBodies();
      displayContainerCenter.addChild(ball);
    }

    /**
     * Add a body to the entity.
     * @param {Object} sprite - The sprite of this body.
     * @param {number} x - The X position of this body.
     * @param {number} y - The Y position of this body.
     * @param {number} width - The width of this body.
     * @param {number} height - The height of this body.
     * @param {number} density - The density of this body.
     */
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

    /**
     * Render on RAF.
     */
    function render() {
      renderBodies();
    }

    /**
     * Destroy bodies.
     */
    function destroy() {
      if (alive) {
        alive = false;
        displayContainerCenter.removeChild(ball);
        world.removeBody(ballBody);

        destroyCallback();

        delete spawnBallObj[pid];
      }
    }

    /**
     * Render ball bodies.
     */
    function renderBodies() {
      if (alive) {
        ball.position.y = ballBody.position[1];
        ball.position.x = ballBody.position[0];
      }
    }

    /**
     * Destroy callback on destroy.
     */
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
  }

  /**
   * Clear the cache on resize.
   */
  DropBallEntity.clearTextureCache = function() {
    cachedTexture = null;
  };

  return DropBallEntity;
})();
