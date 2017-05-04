const LEFT = 0;
const FRONT = 1;
const RIGHT = 2;
const BACK = 3;
const TOP = 4;

const SHADOWS_NOT = 0;
const SHADOWS_TOP = 1;
const SHADOWS_45 = 2;

/**
 * Returns the identifier of a rotation:
 * - 0: Left
 * - 1: Front
 * - 2: Back
 * - 3: Right
 * @param {number} rotation
 * @returns {number}
 */
function getRotationStep(rotation) {
    return Math.floor(rotation / (Math.PI/2)) % 4;
}

/***********************************************************************************************************************
 * Js3dColorBlender
 **********************************************************************************************************************/

/**
 * @constructor
 */
function Js3dColorBlender() {
    this.cachedShades = {};
}

/**
 * Light, dark or shade 1 or 2 colors.
 * If third parameter is set, it blends the 2 colors with specified ratio.
 * Else, it lighten or darken color with the ratio (negative: darken, positive: lighten)
 *
 * @param p {float} The ratio used for computation
 * @param c0 {string} First color (use rgb(x,x,x) or #abcdef notation)
 * @param c1 {string} Second color (use rgb(x,x,x) or #abcdef notation)
 * @returns {string}
 * @private
 */
Js3dColorBlender.prototype._shadeBlend = function(p, c0, c1) {
    var n=p<0?p*-1:p,u=Math.round,w=parseInt;
    if (c0.length>7) {
        var f=c0.split(","),t=(c1?c1:p<0?"rgb(0,0,0)":"rgb(255,255,255)").split(","),R=w(f[0].slice(4)),G=w(f[1]),B=w(f[2]);
        return "rgb("+(u((w(t[0].slice(4))-R)*n)+R)+","+(u((w(t[1])-G)*n)+G)+","+(u((w(t[2])-B)*n)+B)+")"
    } else {
        var f=w(c0.slice(1),16),t=w((c1?c1:p<0?"#000000":"#FFFFFF").slice(1),16),R1=f>>16,G1=f>>8&0x00FF,B1=f&0x0000FF;
        return "#"+(0x1000000+(u(((t>>16)-R1)*n)+R1)*0x10000+(u(((t>>8&0x00FF)-G1)*n)+G1)*0x100+(u(((t&0x0000FF)-B1)*n)+B1)).toString(16).slice(1)
    }
};

/**
 * Get the computed blended color if exists; if not, add it to the cache.
 *
 * @see Js3dColorBlender._shadeBlend
 *
 * @param p {float} The ratio used for computation
 * @param c0 {string} First color (use rgb(x,x,x) or #abcdef notation)
 * @param [c1] {string} Second color (use rgb(x,x,x) or #abcdef notation)
 * @returns {string}
 */
Js3dColorBlender.prototype.cachedShadeBlend = function (p, c0, c1) {
    var key = p + c0 + c1;
    var value = this.cachedShades[key];
    if (undefined === value) {
        value = this._shadeBlend(p, c0, c1);
        this.cachedShades[key] = value;
    }
    return value;
};


/***********************************************************************************************************************
 * Js3dCube
 **********************************************************************************************************************/

/**
 * Create a new Cube
 *
 * @param color {string} The color. Should looks like '#abcdef'
 * @param x {number} The X position
 * @param y {number} The Y position
 * @param z {number} The Z position
 *
 * @constructor
 */
function Js3dCube(color, x, y, z) {
    this.color = color;
    this.x = x;
    this.y = y;
    this.z = z;
    this.shadows = [];
};

/**
 * Add cached colors for the cube, by saving every face and line colors.
 *
 * @param colorBlender {Js3dColorBlender}
 * @param shadeFaces {Object}
 * @param shadeBorders {Object}
 * @private
 */
Js3dCube.prototype._cacheColors = function(colorBlender, shadeFaces, shadeBorders) {
    this.colors = {
        top: colorBlender.cachedShadeBlend(shadeFaces.top, this.color),
        front: colorBlender.cachedShadeBlend(shadeFaces.front, this.color),
        left: colorBlender.cachedShadeBlend(shadeFaces.left, this.color),
        back: colorBlender.cachedShadeBlend(shadeFaces.back, this.color),
        right: colorBlender.cachedShadeBlend(shadeFaces.right, this.color),
        line: colorBlender.cachedShadeBlend(shadeBorders.topFront, this.color),
    };
    this.colors.topShadowed = colorBlender.cachedShadeBlend(shadeFaces.shadow, this.colors.top);
    this.colors.frontShadowed = colorBlender.cachedShadeBlend(shadeFaces.shadow, this.colors.front);
    this.colors.lineShadowed = colorBlender.cachedShadeBlend(shadeFaces.shadow, this.colors.line);
};

/**
 * Change the color of the cube
 * @param {string} color
 */
Js3dCube.prototype.setColor = function(color) {
    this.color = color;
    delete this.colors;
};

/**
 * Returns if cube is shadowed in a face
 * @param {number} faceId
 * @returns {boolean}
 */
Js3dCube.prototype.hasShadow = function (faceId) {
    return this.shadows.indexOf(faceId) >= 0
};


/***********************************************************************************************************************
 * Js3dCanvas
 **********************************************************************************************************************/

/**
 * Creates a new view from a Canvas, able to display cubes
 *
 * @param {Object} options The options for rendering
 * @param [options.cubes] The set of cubes to render
 * @param [options.maxBounds] {number} The maximum length to the origin (used for cube sorter)
 * @param [options.rotation] {number} The rotation of the view, from 0 to Math.PI * 2
 * @param [options.origin.x] {number} The center of the view in x-axis (generally the middle of the canvas)
 * @param [options.origin.y] {number} The center of the view in y-axis (generally the middle of the canvas)
 * @param [options.crush] {number} The crush of the view, from 0 to 1.
 * @param [options.cubeSize] {number} The size of the cubes
 * @param [options.crushZ] {number} The ratio of the cube for the Z-axis, from 0 to 1.
 * @param [options.shadeFaces] {Object} The ratios used for face color computation
 * @param [options.shadeBorders] {Object} The ratios used for line color computation
 * @param [options.debug] {boolean} Show debug information
 * @param [options.shadows] {number} Displays shadows
 *
 * @constructor
 */
function Js3dCanvas(options) {
    this.cubes = options.cubes || [];
    this.maxBounds = options.maxBouds || 1000;
    this.rotation = options.rotation || 0;
    this.origin = options.origin || {
        x: 400,
        y: 300,
    };
    this.crush = options.crush || 0.5;
    this.cubeSize = options.cubeSize || 25;
    this.crushZ = options.crushZ || 0.8;
    this.shadeFaces = options.shadeFaces || {
        back: -0.5,
        left: -0.2,
        right: -0.3,
        front: -0.05,
        top: 0,
        shadow: -0.2
    };
    this.shadeBorders = options.shadeBorders || {
        topFront: (this.shadeFaces.top + this.shadeFaces.front) / 2 + 0.2
    };
    this.debug = options.debug || false;
    this.shadows = options.shadows || SHADOW_NOT;

    this.colorBlender = new Js3dColorBlender();
    this.context = document.getElementById(options.identifier).getContext('2d');
}

/**
 * Adds a new cube to render.
 *
 * @param cube {Js3dCube}
 */
Js3dCanvas.prototype.addCube = function (cube) {
    this.cubes.push(cube);
};

Js3dCanvas.prototype.removeCube = function (x, y, z) {
    for (var i = 0; i < this.cubes.length; i++) {
        var cube = this.cubes[i];
        if (cube.x === x && cube.y === y && cube.z === z) {
            this.cubes.splice(i, 1);

            return;
        }
    }
};

/**
 * Render the current scene.
 */
Js3dCanvas.prototype.render = function() {
    this._drawPoly([{x: 0, y: 0}, {x: 800, y: 0}, {x: 800, y: 600}, {x: 0, y: 600}], '#000');

    this._drawCubes();

    if (this.debug) {
        this.context.fillStyle = '#ccc';
        this.context.font = "30px Arial";
        var display = getRotationStep(this.rotation);
        this.context.fillText('PI:' + display, 400, 50);
        this._drawLine([this._getPosition({x: 0, y: 0, z: 0}), this._getPosition({x: 10, y: 0, z: 0})], '#ccc');
        this._drawLine([this._getPosition({x: 0, y: 0, z: 0}), this._getPosition({x: 0, y: 10, z: 0})], '#ccc');
        this._drawLine([this._getPosition({x: 0, y: 0, z: 0}), this._getPosition({x: 0, y: 0, z: 10})], '#ccc');
        this.context.fillText('x', this._getPosition({x: 10, y: 0, z: 0}).x, this._getPosition({x: 10, y: 0, z: 0}).y);
        this.context.fillText('y', this._getPosition({x: 0, y: 10, z: 0}).x, this._getPosition({x: 0, y: 10, z: 0}).y);
        this.context.fillText('z', this._getPosition({x: 0, y: 0, z: 10}).x, this._getPosition({x: 0, y: 0, z: 10}).y);
    }
};

/**
 * Get the cube at the current position, null if there is no cube.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Js3dCube|null}
 */
Js3dCanvas.prototype.getCube = function(x, y, z) {
    for (var i = 0; i < this.cubes.length; i++) {
        var cube = this.cubes[i];
        if (cube.x === x && cube.y === y && cube.z === z) {
            return cube;
        }
    }

    return null;
};

/**
 * Draws a single cube
 *
 * @param cube {Js3dCube}
 * @private
 */
Js3dCanvas.prototype._drawCube = function(cube) {
    if (undefined === cube.colors) {
        cube._cacheColors(this.colorBlender, this.shadeFaces, this.shadeBorders);
    }

    var points = [
        this._getPosition(cube),
        this._getPosition({x: cube.x + 1, y: cube.y, z: cube.z}),
        this._getPosition({x: cube.x + 1, y: cube.y + 1, z: cube.z}),
        this._getPosition({x: cube.x, y: cube.y + 1, z: cube.z}),
        this._getPosition({x: cube.x, y: cube.y, z: cube.z + 1}),
        this._getPosition({x: cube.x + 1, y: cube.y, z: cube.z + 1}),
        this._getPosition({x: cube.x + 1, y: cube.y + 1, z: cube.z + 1}),
        this._getPosition({x: cube.x, y: cube.y + 1, z: cube.z + 1}),
        this._getPosition({x: cube.x, y: cube.y, z: cube.z + 1})
    ];
    var rotationStep = getRotationStep(this.rotation);
    if (rotationStep === LEFT || rotationStep === FRONT) {
        if (cube.hasShadow(FRONT)) {
            this._drawPoly([points[1], points[2], points[6], points[5]], cube.colors.frontShadowed);
        } else {
            this._drawPoly([points[1], points[2], points[6], points[5]], cube.colors.front);
        }
    }
    if (rotationStep === FRONT || rotationStep === RIGHT) {
        this._drawPoly([points[0], points[1], points[5], points[4]], cube.colors.left);
    }
    if (rotationStep === RIGHT || rotationStep === BACK) {
        this._drawPoly([points[3], points[0], points[4], points[7]], cube.colors.back);
    }
    if (rotationStep === BACK || rotationStep === LEFT) {
        this._drawPoly([points[3], points[2], points[6], points[7]], cube.colors.right);
    }
    if (cube.hasShadow(TOP)) {
        this._drawPoly([points[0], points[1], points[2], points[3]], cube.colors.topShadowed);
        this._drawLine([points[2], points[1]], cube.colors.lineShadowed);
    } else {
        this._drawPoly([points[0], points[1], points[2], points[3]], cube.colors.top);
        this._drawLine([points[2], points[1]], cube.colors.line);
    }
};

/**
 * Draws a polygon into the canvas
 *
 * @param ary {Object[]} Set of positions with attributes x and y ([{x:0,y:0}])
 * @param color {string} The color of the polygon
 * @private
 */
Js3dCanvas.prototype._drawPoly = function(ary, color) {
    this.context.fillStyle = color;
    this.context.beginPath();
    this.context.moveTo(ary[0].x, ary[0].y);
    for (var i=1; i<ary.length; i+=1) {
        this.context.lineTo(ary[i].x, ary[i].y);
    }
    this.context.closePath();
    this.context.fill();
};

/**
 * Draws a line into the canvas
 *
 * @param ary {Object[]} Set of positions with attributes x and ([{x:0,y:0}])
 * @param color {string} The color of the string
 * @private
 */
Js3dCanvas.prototype._drawLine = function(ary, color) {
    this.context.strokeStyle = color;

    var maxWidth = this.cubeSize / 15;
    var minWidth = 0;
    var maxRotation = Math.PI / 4;
    var minRotation = maxRotation + Math.PI;

    var coeff = (maxWidth - minWidth) / (maxRotation - minRotation);
    var addit = minWidth - coeff * minRotation;

    var lineWidth = this.rotation * coeff + addit;
    lineWidth = - Math.abs(- Math.abs(lineWidth) + maxWidth) + maxWidth;

    this.context.lineWidth = lineWidth;
    this.context.beginPath();
    this.context.moveTo(ary[0].x, ary[0].y);
    for (var i=1; i<ary.length; i+=1) {
        this.context.lineTo(ary[i].x, ary[i].y);
    }
    this.context.stroke();
};

/**
 * Sorts the cubes to be able to render them one by one without having a cube in the "back" displayed at the end.
 * It depends of the rotation of the scene.
 *
 * @private
 */
Js3dCanvas.prototype._sortCubes = function () {
    this.cubes.sort(function(cub1, cub2) {
        switch(getRotationStep(this.rotation)) {
            case LEFT:
                matrix = {xP: 1, xO: -1, yP: 2, yO: -1, zP: 3, zO: +1};
            break;
            case FRONT:
                matrix = {xP: 2, xO: -1, yP: 1, yO: +1, zP: 3, zO: +1};
            break;
            case RIGHT:
                matrix = {xP: 1, xO: +1, yP: 2, yO: +1, zP: 3, zO: +1};
            break;
            default:
                matrix = {xP: 2, xO: +1, yP: 1, yO: -1, zP: 3, zO: +1};
        }
        // xP = power of the x axis
        // xO = orientation of the x axis
        return (cub2.x - cub1.x) * matrix.xO * Math.pow(this.maxBounds, matrix.xP)
            + (cub2.y - cub1.y) * matrix.yO * Math.pow(this.maxBounds, matrix.yP)
            + (cub2.z - cub1.z) * matrix.zO * Math.pow(this.maxBounds, matrix.zP)
    }.bind(this));
};

Js3dCanvas.prototype._computeShadows = function () {
    for (var i = 0; i < this.cubes.length; i++) {
        this.cubes[i].shadows = [];
    }

    for (i = 0; i < this.cubes.length; i++) {
        var cube1 = this.cubes[i];
        for (var j = 0; j < this.cubes.length; j++) {
            if (i !== j) {
                var cube2 = this.cubes[j];

                switch (this.shadows) {
                    case SHADOWS_TOP:
                        if (cube1.x === cube2.x && cube1.y === cube2.y && cube1.z < cube2.z) {
                            cube2.shadows.push(TOP);
                        }
                        break;
                    case SHADOWS_45:
                        if (cube1.y === cube2.y && cube1.z < cube2.z && cube1.x - cube2.x === cube2.z - cube1.z) {
                            cube2.shadows.push(TOP, FRONT);
                        }
                        break;
                    default:
                }
            }
        }
    }
};

/**
 * This method matches a 3D position to a 2D position.
 *
 * @param pos {{x: number, y: number, z: number}} A 3D position, with x, y and z positions
 * @returns {{x: number, y: number}}
 * @private
 */
Js3dCanvas.prototype._getPosition = function(pos) {
    var result = {
        x: this.origin.x,
        y: this.origin.y
    };

    // Moves the X axis
    result.x += pos.x * this.cubeSize * Math.cos(this.rotation);
    result.y += pos.x * this.cubeSize * Math.sin(this.rotation) * this.crush;

    // Moves the Y axis
    result.x += pos.y * this.cubeSize * Math.cos(this.rotation + Math.PI/2);
    result.y += pos.y * this.cubeSize * Math.sin(this.rotation + Math.PI/2) * this.crush;

    // Moves the Z axis
    result.y += pos.z * this.cubeSize * this.crushZ;

    return result;
};

/**
 * Draws all the cubes of the scene.
 *
 * @private
 */
Js3dCanvas.prototype._drawCubes = function() {
    this._sortCubes();

    if (this.shadows !== SHADOWS_NOT) {
        this._computeShadows();
    }

    for (var i = 0; i < this.cubes.length; i++) {
        this._drawCube(this.cubes[i]);

        if (this.debug) {
            this.context.fillStyle = '#ccc';
            this.context.font = '10px Arial';
            var position = this._getPosition({x: this.cubes[i].x, y: this.cubes[i].y, z: this.cubes[i].z});
            this.context.fillText(i, position.x, position.y);
        }
    }
};
