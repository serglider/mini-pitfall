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
		gen = new Generator(config),
		pixels = new Pixels(config),
		rAF, paused;

	canvas.width = config.width * square;
	canvas.height = config.height * square;
	init();
	document.body.appendChild(canvas);

	function init() {
		paused = true;
		gen.init();
		pixels.init(gen.initMap, gen.initMark);
		pixels.draw();
	}

	function Generator(o) {
		var self = this,
			frq = o.changePathDirFrequency,
			height = o.height,
			pw = o.pathWidth,
			M = Math,
			run, trend;
		self.mark = null;
		self.initMap = null;
		self.initMark = null;
		self.init = function () {
			run = randPiece(frq);
			trend = randFromArray([0, 1, -1]);
			self.mark = M.round(o.height/2) - M.ceil(o.pathWidth/2);
			self.initMark = self.mark;
			self.initMap = generateMap(o.width);
		};
		self.tick = function () {
			run--;
			self.mark += trend;
			if ( self.mark < 0 ) {
				self.mark = 0;
				trend = randBinary(0.1); // slightly biased towards bouncing
				run = randPiece(frq);
			}else if ( self.mark > height - pw - 1 ) {
				self.mark = height - pw - 1;
				trend = randBinary(0.1) * -1; // slightly biased towards bouncing
				run = randPiece(frq);
			}else if ( !run ) {
				trend = randFromArray([0, 1, -1]);
				run = randPiece(frq);
			}
			// console.log("self.mark: " +  self.mark);
			// console.log("run: " +  run);
			// console.log("trend: " +  trend);
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
			color = o.colors.level[0],
			pw = o.pathWidth,
			harry = null,
			pixels = null;

		function initPixels(o, imap) {
			var arr = [],
				i = 0,
				mark;
			for ( ; i < o.width; i++ ) {
				arr[i] = [];
				mark = imap[i];
				arr[i] = getColumn(i, mark);
			}
			return arr;
		}

		function initHarry(o, imark) {
			var posY = imark + Math.floor(pw/2),
				obj = {
					column: 0,
					row: posY,
					x: 0,
					y: posY * square,
					health: 0,
					colors: o.colors.playerHealth,
					color: o.colors.playerHealth[0]
				};
			return obj;
		}

		function getColumn(index, mark) {
			var arr = [],
				i = 0,
				pixel;
			for ( ; i < o.height; i++ ) {
				pixel = {
					x: index * square,
					y: i * square
				};
				if ( i < mark  ) {
					pixel.color = color.terrain;
				}else if ( i === mark ) {
					pixel.color = color.edge;
				}else if ( i < mark + pw ) {
					pixel.color = color.background;
				}else if ( i === mark + pw ) {
					pixel.color = color.edge;
				}else {
					pixel.color = color.terrain;
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
			var posY;
			if ( clsn ) {
				harry.health++;
				posY = mrk + Math.floor(pw/2);
				harry.row = posY;
				harry.y = posY * square;
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
			for ( ; i < o.width; i++ ) {
				for ( j = 0; j < o.height; j++ ) {
					drawPixel(pixels[i][j]);
				}
			}
			drawPixel(harry);
		};

		self.moveHarry = function(dir) {
			var add = ( dir === "down" ) ? 1 : -1;
			harry.row += add;
			if ( harry.row > o.height - 2 ) { harry.row = o.height - 2; }
			if ( harry.row < 1 ) { harry.row = 1; }
			harry.y = harry.row * square;
		};

		self.update = function(mark) {
			var column = getColumn(o.width - 1, mark),
				i = 0, j, collision;
			pixels.shift();
			for ( ; i < o.width - 1; i++ ) {
				for ( j = 0; j < o.height; j++ ) {
					pixels[i][j].x -= square;
					if ( pixels[i][j].x === harry.x ) {
						if ( pixels[i][j].color === color.edge ) {
							if ( pixels[i][j].y === harry.y ) { collision = true; }
						}
					}
				}
			}
			self.gameover = updateHarry(collision, mark);
			pixels.push(column);
		};

		self.init = function(map, mark) {
			pixels = initPixels(o, map);
			harry = initHarry(o, mark);
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

    function loop(time) {
    	loop.lastTime = loop.lastTime || time;
    	var dT = time - loop.lastTime;
    	if ( dT > config.updateFrequency ) {
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