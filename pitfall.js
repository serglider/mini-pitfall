"use strict";

function Pitfall(config) {
	if ( !( this instanceof Pitfall ) ) { return new Pitfall(config); }
	// Because of time lack and for simplicity
	// I assume that there is always a configuration object
	// ( so no defaults )
	// and it is always valid.
	var PF = this,
		canvas = document.createElement("canvas"),
		ctx = canvas.getContext("2d"),
		square = config.square,
		updateFrequency = config.updateFrequency,
		levelTimeIncrement = config.levelTimeIncrement *1000,
		levelUpTime = config.levelUpTime *1000,
		gen = new Generator(config),
		level = 0,
		maxLevel = config.colors.level.length - 1,
		levelTime = 0,
		pixels = new Pixels(config),
		rAF, paused;

	canvas.width = config.width * square;
	canvas.height = config.height * square;
	init();
	document.body.appendChild(canvas);

	function init() {
		paused = true;
		level = 0;
		levelTime = 0;
		gen.init();
		pixels.init(gen.initMap, gen.initMark);
		pixels.draw();
	}

	function Generator(o) {
		var self = this,
			frq = o.changePathDirFrequency,
			width = o.width,
			pw = o.pathWidth,
			M = Math,
			run, trend;
		self.mark = null;
		self.initMap = null;
		self.initMark = null;
		self.init = function () {
			run = randPiece(width);
			trend = randFromArray([0, 1, -1]);
			self.mark = M.round(width/2) - M.ceil(o.pathWidth/2);
			self.initMark = self.mark;
			self.initMap = generateMap(o.height);
		};
		self.tick = function () {
			run--;
			// console.log(run);
			// console.log(trend);
			self.mark += trend;
			if ( self.mark < 0 ) {
				self.mark = 0;
				trend = randBinary(0.1); // slightly biased towards bouncing
				// trend = randFromArray([0, 1]);
				run = randPiece(width);
			}else if ( self.mark > width - pw - 1 ) {
				self.mark = width - pw - 1;
				trend = randBinary(0.1) * -1; // slightly biased towards bouncing
				// trend = randFromArray([0, -1]);
				run = randPiece(width);
			}else if ( !run ) {
				trend = randFromArray([0, 1, -1]);
				run = randPiece(width);
			}
		};
		function randPiece(a) { return M.round(M.random() * a); }
		function randBinary(bias) { return M.round(M.random() + bias); }
		function randFromArray(arr) { return arr[M.floor(M.random() * arr.length)]; }
		function generateMap(n) {
			var arr = [], i = 0;
			for ( ; i < n; i++ ) {
				arr.push(self.mark);
				self.tick();
			}
			return arr;
		}
	}

	function Pixels(o) {
		var self = this,
			colors = o.colors,
			levelColors = colors.level[0],
			levelUpColors = colors.levelUp,
			pw = o.pathWidth,
			harry = null,
			pixels = null;

		function initPixels(o, imap) {
			var arr = [],
				i = 0,
				mark;
			for ( ; i < o.height; i++ ) {
				arr[i] = [];
				mark = imap[i];
				arr[i] = getRow(i, mark);
			}
			return arr;
		}

		function initHarry(o, imark) {
			var posX = imark + Math.floor(pw/2),
				obj = {
					column: posX,
					row: 0,
					x: posX * square,
					y: 0,
					health: 0,
					colors: o.colors.playerHealth,
					color: o.colors.playerHealth[0]
				};
			return obj;
		}

		function getRow(index, mark) {
			var arr = [],
				i = 0,
				pixel;
			for ( ; i < o.width; i++ ) {
				pixel = {
					x: i * square,
					y: index * square
				};
				if ( i < mark  ) {
					pixel.type = "terrain";
					pixel.color = levelColors.terrain;
				}else if ( i === mark ) {
					pixel.type = "edge";
					pixel.color = levelColors.edge;
				}else if ( i < mark + pw ) {
					pixel.type = "background";
					pixel.color = levelColors.background;
				}else if ( i === mark + pw ) {
					pixel.type = "edge";
					pixel.color = levelColors.edge;
				}else {
					pixel.type = "terrain";
					pixel.color = levelColors.terrain;
				}
				arr.push(pixel);
			}
			return arr;
		}

		function drawPixel(p) {
			ctx.fillStyle = p.color;
			ctx.fillRect(p.x, p.y, square, square);
		}

		function updateHarry(clsn, mrk) {
			var posX;
			if ( clsn ) {
				harry.health++;
				posX = mrk + Math.floor(pw/2);
				harry.column = posX;
				harry.x = posX * square;
				if ( harry.colors[harry.health] ) {
					harry.color = harry.colors[harry.health];
				}else {
					harry.color = "#FF1D23";
					return true;
				}
			}
		}

		self.gameover = false;

		self.draw = function() {
			var i = 0, j = 0;
			for ( ; i < o.height; i++ ) {
				for ( j = 0; j < o.width; j++ ) {
					drawPixel(pixels[i][j]);
				}
			}
			drawPixel(harry);
		};

		self.moveHarry = function(dir) {
			var add = ( dir === "left" ) ? -1 : 1;
			harry.column += add;
			if ( harry.column > o.width - 2 ) { harry.column = o.width - 2; }
			if ( harry.column < 1 ) { harry.column = 1; }
			harry.x = harry.column * square;
		};

		function setColors(arr, colors) {
			var i = 0, j;
			for ( ; i < o.height; i++ ) {
				for ( j = 0; j < o.width; j++ ) {
					arr[i][j].color = colors[arr[i][j].type];
				}
			}
			return arr;
		}

		self.update = function(mark) {
			var row = getRow(o.height - 1, mark),
				i = 0, j, collision;
			pixels.shift();
			for ( ; i < o.height - 1; i++ ) {
				for ( j = 0; j < o.width; j++ ) {
					pixels[i][j].y -= square;
					if ( pixels[i][j].x === harry.x ) {
						if ( pixels[i][j].color === levelColors.edge ) {
							if ( pixels[i][j].y === harry.y ) { collision = true; }
						}
					}
				}
			}
			self.gameover = updateHarry(collision, mark);
			pixels.push(row);
		};

		self.init = function(map, mark) {
			levelColors = colors.level[0];
			pixels = initPixels(o, map);
			harry = initHarry(o, mark);
		};

		self.nextLevel = function(level) {
			levelColors = colors.level[level];
			pixels = setColors(pixels, levelUpColors);
		};

		self.setLevelColors = function() {
			pixels = setColors(pixels, levelColors);
		};
	}

	PF.restart = function() {
		if ( rAF ) { cancelAnimation(); }
		init();
	};

	PF.pause = function() {
		paused = !paused;
		if ( paused ) {
			cancelAnimation();
		}else {
			rAF = requestAnimationFrame(loop);
		}
	};

	PF.move = function(ud) {
		pixels.moveHarry(ud);
	};

	function cancelAnimation() {
		cancelAnimationFrame(rAF);
		rAF = 0;
	}

	function increaseLevel() {
		levelTime = 0;
		if ( maxLevel !== level ) {
			level++;
			pixels.nextLevel(level);
			updateFrequency -= updateFrequency * (config.levelSpeedIncrement/100);
			console.log(updateFrequency);
		}else {
			// win the game
			cancelAnimation();
		}

	}

    function loop(time) {
    	loop.lastTime = loop.lastTime || time;
    	var dT = time - loop.lastTime;
    	if ( dT > updateFrequency ) {
    		levelTime += dT;
    		if ( levelTime > levelTimeIncrement ) {
    			increaseLevel();
    		}else if ( levelTime > levelUpTime ) {
    			pixels.setLevelColors();
    		}
    		loop.lastTime = time;
	        clear();
	        update();
        }
        queue();
    }

    function clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function update() {
        gen.tick();
        pixels.update(gen.mark);
        if ( pixels.gameover ) {
        	pixels.draw();
        	cancelAnimation();
        }else {
        	pixels.draw();
        }
    }

    function queue() {
        if ( rAF ) { rAF = requestAnimationFrame(loop); }
    }
}