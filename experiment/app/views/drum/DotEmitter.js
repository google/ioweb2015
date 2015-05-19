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

var DropBallEntity  = require('app/views/drum/DropBallEntity');

module.exports = (function() {
  'use strict';

  function DotEmitter(renderer) {
    var stage;
    var world;
    var displayContainerCenter;

    var startX;
    var startY;
    var dotEmitterObj;

    var getNextPIDFunc;

    var beatModulo;

    /**
     * Creates a new arpeggiator sliver.
     * @param {PIXI.Stage} stage_ - The PIXI stage for this emitter.
     * @param {PIXI.DisplayObjectContainer} displayContainerCenter_ - The PIXI display container for this emitter.
     * @param {Object} world_ - This emitter world.
     * @param {number} startX_ - The X start position for this emitter.
     * @param {number} startY_ - The Y start position for this emitter.
     * @param {Object} dotEmitterObj_ - The dot emitter object.
     * @param {function} getNextPIDFunc_ - Get the next dot PID.
     * @param {number} beatModulo_ - The frequency of dots emitted.
     */
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

    /**
     * Drop balls onto drums.
     */
    function dropBall() {
      var dropBallEntity = new DropBallEntity(renderer);
      var pid = getNextPIDFunc();
      dropBallEntity.init(stage, pid, displayContainerCenter, world, startX, startY, dotEmitterObj);
      dotEmitterObj[pid] = dropBallEntity;
      return dropBallEntity;
    }

    /**
     * Kill all living dots.
     */
    function killAllDots() {
      for (var key in dotEmitterObj) {
        if (dotEmitterObj.hasOwnProperty(key)) {
          dotEmitterObj[key].destroy();
        }
      }
    }

    /**
     * On the beat, drop balls onto drums.
     * @param {number} beatNumber - The beat number.
     */
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
      init,
      onBeat,
      killAllDots
    };
  }

  DotEmitter.clearTextureCache = function() {
    DropBallEntity.clearTextureCache();
  };

  return DotEmitter;
})();
