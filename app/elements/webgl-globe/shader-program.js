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
 * Create a WebGL shader program, which consists of a linked vertex shader and
 * fragment shader. Shader source can be provided or modified at any time by
 * calling setVertexShader or setFragmentShader as appropriate, but then the
 * shaders must be manually linked to make this ShaderProgram use the new code.
 * If vertex and fragment shader source are provided to the constructor,
 * program compilation and linking is attempted immediately.
 * @param {!WebGLRenderingContext} gl The WebGL context.
 * @param {string=} opt_vertexSrc The GLSL ES vertex shader source code.
 * @param {string=} opt_fragmentSrc The GLSL ES fragment shader source code.
 * @constructor
 * @struct
 */
IOWA.WebglGlobe.ShaderProgram = function(gl, opt_vertexSrc, opt_fragmentSrc) {
  /**
   * The WebGL context.
   * @private {!WebGLRenderingContext}
   */
  this.gl_ = gl;

  /**
   * Collection of active attribute locations in this program object, keyed
   * on attribute name. Unless new shaders are linked in this program and
   * attribute locations change, use these rather than query for them.
   * @type {!Object<string, number>}
   */
  this.attributes = {};

  /**
   * Collection of uniform locations and setters, keyed on uniform name. Raw
   * uniform locations are at thisProgram.uniforms.uniformName.location, while
   * thisProgram.uniforms.uniformName itself is a setter, used for setting
   * scalars, vectors, or matrices, where appropriate.
   * @type {Object<function>}
   */
  this.uniforms = {};

  /**
   * The vertex shader object.
   * @private {!WebGLShader}
   */
  this.vertexShader_ = gl.createShader(gl.VERTEX_SHADER);

  /**
   * The vertex shader has been successfully compiled.
   * @private {boolean}
   */
  this.vertexCompiled_ = false;

  /**
   * The fragment shader object.
   * @private {!WebGLShader}
   */
  this.fragmentShader_ = gl.createShader(gl.FRAGMENT_SHADER);

  /**
   * The fragment shader has been successfully compiled.
   * @private {boolean}
   */
  this.fragmentCompiled_ = false;

  /**
   * The raw WebGL program object.
   * @type {!WebGLProgram}
   */
  this.program = gl.createProgram();

  /**
   * The program has been successfully linked.
   * @private {boolean}
   */
  this.programLinked_ = false;

  gl.attachShader(this.program, this.vertexShader_);
  gl.attachShader(this.program, this.fragmentShader_);

  // if shader sources have been provided, compile them now and attempt to link
  if (opt_vertexSrc) {
    this.setVertexShader(opt_vertexSrc);
  }
  if (opt_fragmentSrc) {
    this.setFragmentShader(opt_fragmentSrc);
  }
  if (this.vertexCompiled_ && this.fragmentCompiled_) {
    this.link();
  }
};

/**
 * Lookup table from uniform type to uniform setter function names. Keys are
 * from OpenGL/WebGL spec.
 * @enum {string}
 * @private
 */
IOWA.WebglGlobe.ShaderProgram.UNIFORM_SETTERS_ = {
  0x1406: 'uniform1f', /* FLOAT */
  0x8b50: 'uniform2f', /* FLOAT_VEC2 */
  0x8b51: 'uniform3f', /* FLOAT_VEC3 */
  0x8b52: 'uniform4f', /* FLOAT_VEC4 */
  0x1404: 'uniform1i', /* INT */
  0x8b53: 'uniform2i', /* INT_VEC2 */
  0x8b54: 'uniform3i', /* INT_VEC3 */
  0x8b55: 'uniform4i', /* INT_VEC4 */
  0x8b56: 'uniform1i', /* BOOL */
  0x8b57: 'uniform2i', /* BOOL_VEC2 */
  0x8b58: 'uniform3i', /* BOOL_VEC3 */
  0x8b59: 'uniform4i', /* BOOL_VEC4 */
  0x8b5e: 'uniform1i', /* SAMPLER_2D */
  0x8b60: 'uniform1i', /* SAMPLER_CUBE */
};

/**
 * Lookup table from matrix uniform types to uniform setter function names.
 * Matrices can only be supplied as arrays (setter functions ending with 'v'),
 * so are special-cased here. Keys are from OpenGL/WebGL spec.
 * @enum {string}
 * @private
 */
IOWA.WebglGlobe.ShaderProgram.UNIFORM_MATRIX_SETTERS_ = {
  0x8b5a: 'uniformMatrix2fv', /* FLOAT_MAT2 */
  0x8b5b: 'uniformMatrix3fv', /* FLOAT_MAT3 */
  0x8b5c: 'uniformMatrix4fv', /* FLOAT_MAT4 */
};

/**
 * Create a ShaderProgram from shader source at vertexUrl and fragmentUrl.
 * Returns a promise that is fulfilled by returning the compiled and linked
 * ShaderProgram. Promise rejection will reveal either failure to fetch the
 * supplied URL(s) or compilation and linking failure.
 * @param {string} vertexUrl URL for vertex shader source.
 * @param {string} fragmentUrl URL for the fragment shader.
 * @return {!Promise}
 */
IOWA.WebglGlobe.ShaderProgram.fromXhr = function(gl, vertexUrl, fragmentUrl) {
  var program = new IOWA.WebglGlobe.ShaderProgram(gl);

  return Promise.all([
    IOWA.WebglGlobe.ShaderProgram.promiseXhr_(vertexUrl)
        .then(program.setVertexShader.bind(program)),
    IOWA.WebglGlobe.ShaderProgram.promiseXhr_(fragmentUrl)
        .then(program.setFragmentShader.bind(program))
  ]).then(function() {
    program.link();
    return program;
  });
};

/**
 * Fetches a resource via XHR and returns a promise that will be fulfilled with
 * its result.
 * @param {string} url
 * @return {!Promise}
 * @private
 */
IOWA.WebglGlobe.ShaderProgram.promiseXhr_ = function(url) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = function(e) {
      if (this.status === 200) {
        resolve(this.response);
      } else {
        reject(this.statusText);
      }
    };
    xhr.onerror = function(e) {
      reject(this.statusText);
    };
    xhr.send();
  });
};

/**
 * Returns true if the shaders have succesfully compiled and have been linked.
 * @return {boolean}
 */
IOWA.WebglGlobe.ShaderProgram.prototype.isReady = function() {
  return this.programLinked_;
};

/**
 * Compiles a vertex or fragment shader from the supplied source code.
 * @param {string} src
 * @param {!WebGLShader} shader
 * @return {boolean} Whether the shader compiled successfully.
 * @private
 */
IOWA.WebglGlobe.ShaderProgram.prototype.compileShader_ = function(src, shader) {
  this.gl_.shaderSource(shader, src);
  this.gl_.compileShader(shader);

  var compileStatus = this.gl_.getShaderParameter(shader,
      this.gl_.COMPILE_STATUS);

  // invalidate current program
  this.programLinked_ = false;

  return compileStatus;
};

/**
 * Sets the source of the fragment shader and attempts to compile it. If
 * compilation fails, an error is thrown with the compiler log within it.
 * Regardless of success, this shader program will continue to operate as the
 * previous program (if there was one) until link() is called and executed
 * successfully.
 * @param {string} src
 * @throws {Error}
 */
IOWA.WebglGlobe.ShaderProgram.prototype.setFragmentShader = function(src) {
  this.fragmentCompiled_ = this.compileShader_(src, this.fragmentShader_);

  if (!this.fragmentCompiled_) {
    throw new Error('Fragment shader failed to compile. Log: ' +
        this.getFragmentShaderInfoLog());
  }
};

/**
 * Sets the source of the vertex shader and attempts to compile it. If
 * compilation fails, an error is thrown with the compiler log within it.
 * Regardless of success, this shader program will continue to operate as the
 * previous program (if there was one) until link() is called and executed
 * successfully.
 * @param {string} src
 * @throws {Error}
 */
IOWA.WebglGlobe.ShaderProgram.prototype.setVertexShader = function(src) {
  this.vertexCompiled_ = this.compileShader_(src, this.vertexShader_);

  if (!this.vertexCompiled_) {
    throw new Error('Vertex shader failed to compile. Log: ' +
        this.getVertexShaderInfoLog());
  }
};


/**
 * Returns the contents of the information log for the currently attached
 * fragment shader, if any.
 * @return {string}
 */
IOWA.WebglGlobe.ShaderProgram.prototype.getFragmentShaderInfoLog = function() {
  return this.gl_.getShaderInfoLog(this.fragmentShader_);
};

/**
 * Returns the contents of the information log for this program object, if any.
 * @return {string}
 */
IOWA.WebglGlobe.ShaderProgram.prototype.getProgramInfoLog = function() {
  return this.gl_.getProgramInfoLog(this.program);
};

/**
 * Returns the contents of the information log for the currently attached
 * vertex shader, if any.
 * @return {string}
 */
IOWA.WebglGlobe.ShaderProgram.prototype.getVertexShaderInfoLog = function() {
  return this.gl_.getShaderInfoLog(this.vertexShader_);
};

/**
 * Enumerate all active attribute locations in this program object and place on
 * this.attributes. Previous enumeration of attribute locations is discarded.
 * @private
 */
IOWA.WebglGlobe.ShaderProgram.prototype.initAttributes_ = function() {
  var count = this.gl_.getProgramParameter(
      this.program, this.gl_.ACTIVE_ATTRIBUTES);

  // clear attribute locations and re-enumerate from currently linked program
  this.attributes = {};
  for (var i = 0; i < count; i++) {
    var info = this.gl_.getActiveAttrib(this.program, i);
    var loc = this.gl_.getAttribLocation(this.program, info.name);
    this.attributes[info.name] = loc;
  }
};

/**
 * Creates a uniform setter function that can take dispatch to an array-based
 * setter or one with an argument count based on the uniform type.
 * @param {function(this:WebGLRenderingContext, ...[number])} set
 * @param {function(this:WebGLRenderingContext, (!Array<number>|!ArrayBufferView))} setVec
 * @return {function(!Array<number>|!ArrayBufferView|...[number])}
 */
IOWA.WebglGlobe.ShaderProgram.createUniformSetter_ = function(set, setVec) {
  return function setUniform() {
    if (Array.isArray(arguments[0]) || ArrayBuffer.isView(arguments[0])) {
      setVec(arguments[0]);
    } else {
      set.apply(null, arguments);
    }
  };
};

/**
 * Autogenerates setter methods for all active uniforms in this program object.
 * When called, previously generated setter methods are discarded.
 * @private
 * @throws {Error} If uniform of unknown type is found.
 */
IOWA.WebglGlobe.ShaderProgram.prototype.initUniforms_ = function() {
  var gl = this.gl_;
  this.uniforms = {};

  // loop over current uniforms and create setter functions for them
  var count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
  for (var i = 0; i < count; i++) {
    var info = gl.getActiveUniform(this.program, i);
    var name = info.name;
    var location = gl.getUniformLocation(this.program, name);

    // float, vec*, or sampler uniforms
    var ShaderProgram = IOWA.WebglGlobe.ShaderProgram;
    if (ShaderProgram.UNIFORM_SETTERS_[info.type]) {
      var setterMethod = ShaderProgram.UNIFORM_SETTERS_[info.type];
      var set = gl[setterMethod].bind(gl, location);
      var setVec = gl[setterMethod + 'v'].bind(gl, location);

      // base is function that decides on type input what setter to call
      // specialized setters are available at fn.set and fn.setVec
      // and raw WebGLUniformLocation is on fn.location
      this.uniforms[name] = ShaderProgram.createUniformSetter_(set, setVec);
      this.uniforms[name].set = set;
      this.uniforms[name].setVec = setVec;
      this.uniforms[name].location = location;

    // matrix uniform - matrix setters only accept arrays in setter
    } else if (ShaderProgram.UNIFORM_MATRIX_SETTERS_[info.type]) {
      var setterMatMethod = ShaderProgram.UNIFORM_MATRIX_SETTERS_[info.type];

      this.uniforms[name] = gl[setterMatMethod].bind(gl, location, false);
      this.uniforms[name].location = location;

    } else {
      // can't happen unless types are added to spec
      throw new Error('Uniform ' + name + ' has unknown type ' + info.type);
    }
  }
};

/**
 * Attempts to link the current vertex and fragment shaders. Throws an error if
 * the vertex and/or fragment shaders aren't set and compiled, or if the
 * shaders fail to link.
 * @throws {Error}
 */
IOWA.WebglGlobe.ShaderProgram.prototype.link = function() {
  if (!this.vertexCompiled_) {
    throw new Error('Current vertex shader has not been compiled');
  }
  if (!this.fragmentCompiled_) {
    throw new Error('Current vertex shader has not been compiled');
  }

  this.gl_.linkProgram(this.program);

  this.programLinked_ = this.gl_.getProgramParameter(this.program,
      this.gl_.LINK_STATUS);

  if (!this.programLinked_) {
    throw new Error('Program failed to link. Log: ' + this.getProgramInfoLog());
  } else {
    this.initAttributes_();
    this.initUniforms_();
  }
};

/**
 * Installs this program object as part of the current rendering state. Does
 * not check program status before attempting; if necessary, use isReady()
 * first to check if program has successfully compiled and linked.
 */
IOWA.WebglGlobe.ShaderProgram.prototype.use = function() {
  this.gl_.useProgram(this.program);
};

/**
 * Checks to see whether the executables contained in this program can execute
 * given the current OpenGL state. The information generated by the validation
 * process can be accessed via thisProgram.getProgramInfoLog().
 * This function is typically useful only during application development and
 * tends to be quite slow.
 * @return {boolean} The validation status.
 * @see http://www.khronos.org/opengles/sdk/2.0/docs/man/glValidateProgram.xml
 */
IOWA.WebglGlobe.ShaderProgram.prototype.validateProgram = function() {
  this.gl_.validateProgram(this.program);
  return this.gl_.getProgramParameter(this.program, this.gl_.VALIDATE_STATUS);
};
