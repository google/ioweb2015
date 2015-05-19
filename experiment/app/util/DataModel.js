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

var PIXI = require('pixi.js/bin/pixi.dev.js');

/**
 * Data model and serialization.
 */
module.exports = (function() {
  'use strict';

  /**
   * URL-safe character mapping.
   */
  const TO_URL = {
    '[': '(',
    ']': ')',
    ',': '_'
  };

  /**
   * Above mapping reversed.
   */
  const FROM_URL = Object.keys(TO_URL).reduce(function(sum, key) {
    sum[TO_URL[key]] = key;
    return sum;
  }, {});

  /**
   * Custom type serializer/deserializer.
   */
  const SERIALIZERS = [
    [
      PIXI.Point,
      p => [p.x, p.y],
      pair => new PIXI.POINT(pair[0], pair[1])
    ]
  ];

  /**
   * Define a schema.
   * @param {...number|function} args - The name and schema def.
   * @return {Model}
   */
  function defineSchema(...args) {
    var [name, ...schema] = args;

    /**
     * Dynamically created Model class.
     * @param {object} obj - Initial data.
     */
    var Model = function(obj) {
      this.data_ = [];
      this.keys = [];
      this.types_ = [];

      for (let i = 0; i < schema.length; i += 2) {
        let key = schema[i];
        let type = schema[i + 1];
        let dataID = i / 2;

        this.keys[dataID] = schema[i];
        this.types_[dataID] = type;

        /* jshint loopfunc: true */
        Object.defineProperty(this, key, {
          get: function() {
            return this.data_[dataID];
          },
          set: function(v) {
            if (Array.isArray(type)) {
              let ArrayType = type[0];
              v = v.map(i => new ArrayType(i));
            } else if ('function' === typeof type.loadFromJSON) {
              if (!(v instanceof type)) {
                v = type.loadFromJSON(v);
              }
            }

            this.data_[dataID] = v;
          }
        });
      }

      for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
          this[key] = obj[key];
        }
      }

      this.modelName = name;
    };

    Model.modelName = name;

    /**
     * The simplest deserializer.
     * @param {object} v - Some value;
     * @return {object}
     */
    function identity(v) {
      return v;
    }

    /**
     * Serialize a data structure.
     * @param {Model|object} d - Data.
     * @return {array|number|object}
     */
    function recursiveSerialize(d) {
      var result;

      if ('function' === typeof d.serializeModel) {
        result = d.serializeModel();
      } else {
        var s = findSerializer(d);
        result = s(d);
      }

      return result;
    }

    /**
     * Find a serializer for a data type.
     * @param {object} obj - Some data.
     * @return {function}
     */
    function findSerializer(obj) {
      if (('number' === typeof obj) ||
          ('string' === typeof obj)) {
        return identity;
      }

      if (Array.isArray(obj)) {
        return function(a) {
          return a.map(function(v) {
            return recursiveSerialize(v);
          });
        };
      }

      for (let i = 0; i < SERIALIZERS.length; i++) {
        if (obj instanceof SERIALIZERS[i][0]) {
          return SERIALIZERS[i][1];
        }
      }

      console.error('Could not find serializer for object', obj);
      throw 'Could not find serializer for object';
    }

    /**
     * Convert data to code which can re-init.
     * @return {string}
     */
    Model.prototype.toCodeString = function() {
      var output = '';

      this.keys.forEach(function(key, i) {
        var type = this.types_[i];
        var data = this.data_[i];
        var isLast = i >= (this.keys.length - 1);
        var stringified = 'tbd';

        if ((Number === type) ||
            (String === data)) {
          stringified = JSON.stringify(data);
        }

        if (Array.isArray(type)) {
          let arrayData = data.map(function(d) {
            if ((Number === d) ||
                (String === d)) {
              return JSON.stringify(d);
            }

            if ('function' === typeof d.toCodeString) {
              return `${d.toCodeString()}`;
            }

            return 'tbd';
          });

          stringified = `[${arrayData.toString()}]`;
        }

        if ('function' === typeof data.toCodeString) {
          stringified = data.toCodeString();
        }

        output += `'${key}': ${stringified}${isLast ? '' : ',\n'}`;
      }.bind(this));

      return `new ${this.modelName}({\n${output}\n})`;
    };

    /**
     * Serialize this model.
     * @return {array}
     */
    Model.prototype.serializeModel = function() {
      return this.data_.map(recursiveSerialize);
    };

    /**
     * Convert serialized data into URL safe string.
     * @return {string}
     */
    Model.prototype.toURL = function() {
      var cleanedUp = Object.keys(TO_URL).reduce(function(sum, key) {
        var target = new RegExp(key.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1'), 'g');
        return sum.replace(target, TO_URL[key]);
      }, JSON.stringify(this.serializeModel()));

      return cleanedUp.replace(/\d+/g, function(d) {
        return parseInt(d, 10).toString(16);
      });
    };

    /**
     * Load data from a string.
     * @param {string} str - The data string.
     * @return {Model|false}
     */
    Model.loadFromString = function(str) {
      var jsonShaped = fromURL(str);
      var jsonData;

      try {
        jsonData = JSON.parse(jsonShaped);
        return Model.deserializeModel(jsonData);
      } catch (e) {
        return false;
      }
    };

    /**
     * Load data from a JSON.
     * @param {object} jsonData - The data.
     * @return {Model|false}
     */
    Model.loadFromJSON = function(jsonData) {
      return new Model(jsonData);
    };

    /**
     * Deserialize a model.
     * @param {array} arr - The deserialized data structure.
     * @return {Model}
     */
    Model.deserializeModel = function(arr) {
      var initData = {};

      for (let i = 0; i < schema.length; i += 2) {
        let key = schema[i];
        initData[key] = recursiveDeserialize(arr[i / 2], schema[i + 1]);
      }

      return new Model(initData);
    };

    /**
     * Deserialize a data structure.
     * @param {object} d - The data.
     * @param {function} type - The data type.
     * @return {Model|object|number}
     */
    function recursiveDeserialize(d, type) {
      var result;

      if ('function' === typeof type.deserializeModel) {
        result = type.deserializeModel(d);
      } else {
        var s = findDeserializer(d, type);
        result = s(d);
      }

      return result;
    }

    /**
     * Find a deserializer for a piece of data.
     * @param {object} obj - Some object.
     * @param {function} type - The data type.
     * @return {function}
     */
    function findDeserializer(obj, type) {
      if ((Number === type) ||
          (String === obj)) {
        return identity;
      }

      if (Array.isArray(type)) {
        return function(a) {
          return a.map(function(v) {
            return recursiveDeserialize(v, type[0]);
          });
        };
      }

      for (let i = 0; i < SERIALIZERS.length; i++) {
        if (obj instanceof SERIALIZERS[i][0]) {
          return SERIALIZERS[i][2];
        }
      }

      console.error('Could not find deserializer for object', obj);
      throw 'Could not find deserializer for object';
    }

    /**
     * Parse data from a URL-encoded string.
     * @param {string} str - The data.
     * @return {string}
     */
    function fromURL(str) {
      var incoming = str;

      var cleanedUp = Object.keys(FROM_URL).reduce(function(sum, key) {
        var target = new RegExp(key.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1'), 'g');
        return sum.replace(target, FROM_URL[key]);
      }, incoming);

      return cleanedUp.replace(/[0-9a-f]+/g, function(d) {
        return parseInt(d, 16);
      });
    }

    return Model;
  }

  return { defineSchema };
})();
