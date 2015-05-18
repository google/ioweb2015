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
 * A 4x4 Matrix.
 * @constructor
 * @struct
 */
IOWA.WebglGlobe.Matrix4x4 = function() {
  /**
   * The internal representation of the matix.
   * @private {Float32Array}
   */
  this.m_ = new Float32Array(16);

  this.identity();
};

/** @typedef {Array<number>|Float32Array} */
IOWA.WebglGlobe.ArrayLike;

/**
 * Get the matrix element at position row, column.
 * @param {number} row
 * @param {number} column
 * @return {number}
 */
IOWA.WebglGlobe.Matrix4x4.prototype.getElement = function(row, column) {
  return this.m_[column * 4 + row];
};

/**
 * Reset matrix to the identity transformation.
 * @return {!IOWA.WebglGlobe.Matrix4x4} This matrix.
 */
IOWA.WebglGlobe.Matrix4x4.prototype.identity = function() {
  for (var i = 0; i < this.m_.length; i++) {
    this.m_[i] = i % 5 ? 0 : 1;
  }

  return this;
};

/**
 * Invert src and place in this transform. Special case for when src is a purely
 * affine transformation.
 * @param {!Matrix4x4} src
 * @return {!Matrix4x4}
 */
IOWA.WebglGlobe.Matrix4x4.prototype.invertAffine = function(src) {
  var m = this.m_;
  var s = src.m_;

  m[0] = s[5]*s[10] - s[9]*s[6];
  m[1] = -s[1]*s[10] + s[9]*s[2];
  m[2] = s[1]*s[6] - s[5]*s[2];
  m[3] = 0;
  m[4] = -s[4]*s[10] + s[8]*s[6];
  m[5] = s[0]*s[10] - s[8]*s[2];
  m[6] = -s[0]*s[6] + s[2]*s[4];
  m[7] = 0;
  m[8] = s[4]*s[9] - s[5]*s[8];
  m[9] = -s[0]*s[9] + s[1]*s[8];
  m[10] = s[0]*s[5] - s[1]*s[4];
  m[11] = 0;

  var det = 1 / (s[0]*m[0] + s[1]*m[4] + s[2]*m[8]);
  m[0] *= det;
  m[1] *= det;
  m[2] *= det;
  m[4] *= det;
  m[5] *= det;
  m[6] *= det;
  m[8] *= det;
  m[9] *= det;
  m[10] *= det;

  m[12] = -s[12]*m[0] - s[13]*m[4] - s[14]*m[8];
  m[13] = -s[12]*m[1] - s[13]*m[5] - s[14]*m[9];
  m[14] = -s[12]*m[2] - s[13]*m[6] - s[14]*m[10];
  m[15] = 1;

  return this;
};

// TODO(bckenny): standardize terminology
/**
 * Add a perspective transformation.
 * @param {number} fov
 * @param {number} aspect
 * @param {number} near
 * @param {number} far
 * @return {!IOWA.WebglGlobe.Matrix4x4}
 */
IOWA.WebglGlobe.Matrix4x4.prototype.perspective = function(fov, aspect, near, far) {
  var cx = Math.cos(fov/2);
  var cy = cx;
  var s = -Math.sin(fov/2);
  var q = s / (1 - near/far);
  var zs = q * (1 + near/far);
  var zt = q * 2 * near;
  var tmp2, tmp6, tmp10, tmp14;

  var m = this.m_;

  if (aspect > 1) {
    // width > height
    cx /= aspect;

  } else {
    // height > width
    cy *= aspect;
  }

  m[0] *= cx;
  m[4] *= cx;
  m[8] *= cx;
  m[12] *= cx;

  m[1] *= cy;
  m[5] *= cy;
  m[9] *= cy;
  m[13] *= cy;

  tmp2 = m[2];
  tmp6 = m[6];
  tmp10 = m[10];
  tmp14 = m[14];

  m[2] = tmp2*zs + m[3]*zt;
  m[6] = tmp6*zs + m[7]*zt;
  m[10] = tmp10*zs + m[11]*zt;
  m[14] = tmp14*zs + m[15]*zt;

  m[3] = tmp2 * s;
  m[7] = tmp6 * s;
  m[11] = tmp10 * s;
  m[15] = tmp14 * s;

  return this;
};

/**
 * Sets this matrix to the local transformation within the view transformation.
 * view and/or local can also be this matrix.
 * @param {!IOWA.WebglGlobe.Matrix4x4} view
 * @param {!IOWA.WebglGlobe.Matrix4x4} local
 * @return {!IOWA.WebglGlobe.Matrix4x4}
 */
IOWA.WebglGlobe.Matrix4x4.prototype.product = function(view, local) {
  var v = view.m_;
  var l = local.m_;

  var m0 = v[0]*l[0] + v[4]*l[1] + v[8]*l[2] + v[12]*l[3];
  var m1 = v[1]*l[0] + v[5]*l[1] + v[9]*l[2] + v[13]*l[3];
  var m2 = v[2]*l[0] + v[6]*l[1] + v[10]*l[2] + v[14]*l[3];
  var m3 = v[3]*l[0] + v[7]*l[1] + v[11]*l[2] + v[15]*l[3];

  var m4 = v[0]*l[4] + v[4]*l[5] + v[8]*l[6] + v[12]*l[7];
  var m5 = v[1]*l[4] + v[5]*l[5] + v[9]*l[6] + v[13]*l[7];
  var m6 = v[2]*l[4] + v[6]*l[5] + v[10]*l[6] + v[14]*l[7];
  var m7 = v[3]*l[4] + v[7]*l[5] + v[11]*l[6] + v[15]*l[7];

  var m8 = v[0]*l[8] + v[4]*l[9] + v[8]*l[10] + v[12]*l[11];
  var m9 = v[1]*l[8] + v[5]*l[9] + v[9]*l[10] + v[13]*l[11];
  var m10 = v[2]*l[8] + v[6]*l[9] + v[10]*l[10] + v[14]*l[11];
  var m11 = v[3]*l[8] + v[7]*l[9] + v[11]*l[10] + v[15]*l[11];

  var m12 = v[0]*l[12] + v[4]*l[13] + v[8]*l[14] + v[12]*l[15];
  var m13 = v[1]*l[12] + v[5]*l[13] + v[9]*l[14] + v[13]*l[15];
  var m14 = v[2]*l[12] + v[6]*l[13] + v[10]*l[14] + v[14]*l[15];
  var m15 = v[3]*l[12] + v[7]*l[13] + v[11]*l[14] + v[15]*l[15];

  this.m_[0] = m0;
  this.m_[1] = m1;
  this.m_[2] = m2;
  this.m_[3] = m3;
  this.m_[4] = m4;
  this.m_[5] = m5;
  this.m_[6] = m6;
  this.m_[7] = m7;
  this.m_[8] = m8;
  this.m_[9] = m9;
  this.m_[10] = m10;
  this.m_[11] = m11;
  this.m_[12] = m12;
  this.m_[13] = m13;
  this.m_[14] = m14;
  this.m_[15] = m15;

  return this;
};

/**
 * Rotate the matrix by angle theta about the x axis.
 * @param {number} theta The rotation angle, in radians.
 * @return {!IOWA.WebglGlobe.Matrix4x4} This matrix.
 */
IOWA.WebglGlobe.Matrix4x4.prototype.rotateX = function(theta) {
  var cos = Math.cos(theta);
  var sin = Math.sin(theta);

  var m = this.m_;

  var c2 = cos*m[4] + m[8]*sin;
  var c3 = cos*m[8] - m[4]*sin;
  m[4] = c2;
  m[8] = c3;

  c2 = cos*m[5] + m[9]*sin;
  c3 = cos*m[9] - m[5]*sin;
  m[5] = c2;
  m[9] = c3;

  c2 = cos*m[6] + m[10]*sin;
  c3 = cos*m[10] - m[6]*sin;
  m[6] = c2;
  m[10] = c3;

  c2 = cos*m[7] + m[11]*sin;
  c3 = cos*m[11] - m[7]*sin;
  m[7] = c2;
  m[11] = c3;

  return this;
};

/**
 * Rotate the matrix by angle theta about the y axis.
 * @param {number} theta The rotation angle, in radians.
 * @return {!IOWA.WebglGlobe.Matrix4x4} This matrix.
 */
IOWA.WebglGlobe.Matrix4x4.prototype.rotateY = function(theta) {
  var cos = Math.cos(theta);
  var sin = Math.sin(theta);

  var m = this.m_;

  var c1 = cos * m[0] - m[8] * sin;
  var c3 = cos * m[8] + m[0] * sin;
  m[0] = c1;
  m[8] = c3;

  c1 = cos * m[1] - m[9] * sin;
  c3 = cos * m[9] + m[1] * sin;
  m[1] = c1;
  m[9] = c3;

  c1 = cos * m[2] - m[10] * sin;
  c3 = cos * m[10] + m[2] * sin;
  m[2] = c1;
  m[10] = c3;

  c1 = cos * m[3] - m[11] * sin;
  c3 = cos * m[11] + m[3] * sin;
  m[3] = c1;
  m[11] = c3;

  return this;
};

/**
 * Rotate the matrix by angle theta about the z axis.
 * @param {number} theta The rotation angle, in radians.
 * @return {!IOWA.WebglGlobe.Matrix4x4} This matrix.
 */
IOWA.WebglGlobe.Matrix4x4.prototype.rotateZ = function(theta) {
  var cos = Math.cos(theta);
  var sin = Math.sin(theta);

  var m = this.m_;

  var c1 = cos*m[0] + m[4]*sin;
  var c2 = cos*m[4] - m[0]*sin;
  m[0] = c1;
  m[4] = c2;

  c1 = cos*m[1] + m[5]*sin;
  c2 = cos*m[5] - m[1]*sin;
  m[1] = c1;
  m[5] = c2;

  c1 = cos*m[2] + m[6]*sin;
  c2 = cos*m[6] - m[2]*sin;
  m[2] = c1;
  m[6] = c2;

  c1 = cos*m[3] + m[7]*sin;
  c2 = cos*m[7] - m[3]*sin;
  m[3] = c1;
  m[7] = c2;

  return this;
};

/**
 * Apply a scale of factor scale.
 * @param {number} scale
 * @return {!IOWA.WebglGlobe.Matrix4x4} This matrix.
 */
IOWA.WebglGlobe.Matrix4x4.prototype.scaleUniform = function(scale) {
  var m = this.m_;

  m[0] *= scale;
  m[1] *= scale;
  m[2] *= scale;
  m[3] *= scale;

  m[4] *= scale;
  m[5] *= scale;
  m[6] *= scale;
  m[7] *= scale;

  m[8] *= scale;
  m[9] *= scale;
  m[10] *= scale;
  m[11] *= scale;

  return this;
};

/**
 * Transforms the four-vector vec and places result in destVec. Returns destVec.
 * destVec and vec can refer to the same vector object (so transformation is
 * done in place).
 * @param {!IOWA.WebglGlobe.ArrayLike} destVec
 * @param {!IOWA.WebglGlobe.ArrayLike} vec
 * @return {!IOWA.WebglGlobe.ArrayLike} destVec
 */
IOWA.WebglGlobe.Matrix4x4.prototype.transformVec4 = function(destVec, vec) {
  var m = this.m_;
  var v0 = vec[0];
  var v1 = vec[1];
  var v2 = vec[2];
  var v3 = vec[3];

  destVec[0] = v0 * m[0] + v1 * m[4] + v2 * m[8]  + v3 * m[12];
  destVec[1] = v0 * m[1] + v1 * m[5] + v2 * m[9]  + v3 * m[13];
  destVec[2] = v0 * m[2] + v1 * m[6] + v2 * m[10] + v3 * m[14];
  destVec[3] = v0 * m[3] + v1 * m[7] + v2 * m[11] + v3 * m[15];

  return destVec;
};

/**
 * Transform vector at vecOffset in vec and place result at destVecOffset in
 * destVec. Result can be written in place by giving the same values for destVec
 * as for vec.
 * @param {!IOWA.WebglGlobe.ArrayLike} destVec
 * @param {number} destVecOffset
 * @param {!IOWA.WebglGlobe.ArrayLike} vec
 * @param {number} vecOffset
 */
IOWA.WebglGlobe.Matrix4x4.prototype.transformOffsetVec4 = function(destVec, destVecOffset, vec, vecOffset) {
  var m = this.m_;
  var v0 = vec[0 + vecOffset];
  var v1 = vec[1 + vecOffset];
  var v2 = vec[2 + vecOffset];
  var v3 = vec[3 + vecOffset];

  destVec[0 + destVecOffset] = v0 * m[0] + v1 * m[4] + v2 * m[8]  + v3 * m[12];
  destVec[1 + destVecOffset] = v0 * m[1] + v1 * m[5] + v2 * m[9]  + v3 * m[13];
  destVec[2 + destVecOffset] = v0 * m[2] + v1 * m[6] + v2 * m[10] + v3 * m[14];
  destVec[3 + destVecOffset] = v0 * m[3] + v1 * m[7] + v2 * m[11] + v3 * m[15];
};

/**
 * Translate by vector tx, ty, tz.
 * @param {number} tx
 * @param {number} ty
 * @param {number} tz
 * @return {!IOWA.WebglGlobe.Matrix4x4} This matrix.
 */
IOWA.WebglGlobe.Matrix4x4.prototype.translate = function(tx, ty, tz) {
  var m = this.m_;

  m[12] += m[0]*tx + m[4]*ty + m[8]*tz;
  m[13] += m[1]*tx + m[5]*ty + m[9]*tz;
  m[14] += m[2]*tx + m[6]*ty + m[10]*tz;
  m[15] += m[3]*tx + m[7]*ty + m[11]*tz;

  return this;
};
