"use strict";
/* global Howl */
/* global console */

function Pitfall(config) {

	if ( !( this instanceof Pitfall ) ) { return new Pitfall(config); }

	var PF = this,
		canvas = document.createElement("canvas"),
		ctx = canvas.getContext("2d"),
		square = config.square,
		updateFrequency = config.updateFrequency,
		levelTimeIncrement = config.levelTimeIncrement * 1000,
		levelUpTime = config.levelUpTime * 1000,
		gen = new Generator(config),
		images = new Images(config, launch),
		level = 0,
		maxLevel = config.colors.level.length - 1,
		levelTime = 0,
		pixels = new Pixels(config),
		soundsPaused, rAF, paused, started, victory,
		sounds = {
	        title: new Howl({
	        	urls: [config.sounds.title],
	        	loop: true,
	        	onload: function () {
	        		images.load();
	        	}
	    	}),
	        game: new Howl({
	        	urls: [config.sounds.game],
	        	onpause: function () {
	        		soundsPaused = true;
	        	},
	        	onplay: function () {
	        		soundsPaused = false;
	        	},
	        	onend: function () {
	        		sounds.game.sprite({ loop: [3700, 46080] });
	        		sounds.game.play("loop");
	        	}
	        }),
	        level: new Howl({ urls: [config.sounds.level] }),
	        lose: new Howl({ urls: [config.sounds.lose] }),
	        win: new Howl({ urls: [config.sounds.win] }),
	        bump: new Howl({ urls: [config.sounds.bump] })
	    };


	canvas.width = config.width * square;
	canvas.height = config.height * square;
	document.body.appendChild(canvas);

	function launch() {
		init();
		images.show("title");
		sounds.title.play();
	}

	function init() {
		paused = true;
		level = 0;
		levelTime = 0;
		gen.init();
		pixels.init(gen.initMap, gen.initMark);
		pixels.draw();
	}

	function Images(o, onLoadCallback) {
		var self = this,
			images = {};

		self.show = function (name) {
			var img = images[name];
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		};

		self.slideShow = function (arr, callback) {
			var name = arr.shift();
			self.show(name);
			if ( arr.length ) {
				setTimeout(function () {
					self.slideShow(arr, callback);
				}, o.startImageDelay * 1000);
			}else {
				setTimeout(callback, o.startImageDelay * 1000);
			}
		};

		self.load = function (a) {
			var arr = a || [], item;
			if ( !arr.length ) {
				for ( item in o.images ) {
					if ( o.images.hasOwnProperty(item) ) {
						arr.push([item, o.images[item]]);
					}
				}
			}
		    var image = new Image(),
		        imageset = arr.shift(),
		        name = imageset[0],
		        url = imageset[1];
		    image.onload = function() {
		        images[name] = image;
		        if ( arr.length ) {
		        	self.load(arr);
		        }else {
		            onLoadCallback();
		        }
		    };
		    image.src = url;
		};
	}

	function Generator(o) {
		var self = this,
			maxRun = o.maxRun,
			maxRunIncrement = o.maxRunIncrement,
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
		self.increaseMaxRun = function () {
			maxRun += maxRunIncrement;
			if ( maxRun > width ) { maxRun = width; }
		};
		self.tick = function () {
			self.mark += trend;
			if ( run ) {
				if ( self.mark < 0 ) {
					self.mark = 0;
					trend = randFromArray([0, 1]);
					run = randPiece(maxRun);
				}else if ( self.mark > width - pw - 1 ) {
					self.mark = width - pw - 1;
					trend = randFromArray([0, -1]);
					run = randPiece(maxRun);
				}
			}else {
				trend = randFromArray([0, 1, -1]);
				run = randPiece(maxRun);
			}
			run--;
		};
		function randPiece(a) { return M.ceil(M.random() * a); }
		// function randBinary(bias) { return M.round(M.random() + bias); }
		function randFromArray(arr) { return arr[M.floor(M.random() * arr.length)]; }
		function generateMap(n) {
			var arr = [], i = 0;
			for ( ; i < n; i++ ) {
				arr.push(self.mark);
			}
			return arr;
		}
	}

	function Pixels(o) {
		var self = this,
			colors = o.colors,
			levelColors = colors.level[0],
			levelUpColors = colors.levelUp,
			bumpColors = colors.bump,
			flashTime = o.bumpFlashTime * 1000,
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
				posY = Math.floor(o.height/3),
				obj = {
					column: posX,
					row: posY,
					x: posX * square,
					y: posY * square,
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

		function updateHarry(clsn) {
			var bump;
			if ( clsn ) {
				harry.health++;
				bump = (pixels[harry.row][clsn + 1].color === levelColors.terrain) ? -1 * Math.floor(pw/2) : Math.floor(pw/2);
				harry.column += bump;
				harry.x = harry.column * square;
				if ( harry.colors[harry.health] ) {
					harry.color = harry.colors[harry.health];
					pixels = setColors(pixels, bumpColors);
					setTimeout(function () {
						pixels = setColors(pixels, levelColors);
					}, flashTime);
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
							if ( pixels[i][j].y === harry.y ) {
								collision = j;
								sounds.bump.play();
							}
						}
					}
				}
			}
			pixels.push(row);
			self.gameover = updateHarry(collision);
		};

		self.init = function(map, mark) {
			levelColors = colors.level[0];
			pixels = initPixels(o, map);
			pixels = setColors(pixels, levelColors);
			console.log(levelColors);
			console.log(pixels);
			debugger;
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
		started = false;
		launch();
	};

	PF.start = function() {
		if ( !started ) {
			started = true;
			sounds.title.stop();
			sounds.game.play();
			images.slideShow(["start1", "start2", "start3"], PF.pause);
		}
	};

	PF.pause = function() {
		if ( started ) {
			paused = !paused;
			if ( paused ) {
				loop.lastTime = 0;
				sounds.game.pause();
				cancelAnimation();
			}else {
				if ( soundsPaused ) {
					sounds.game.play();
				}
				rAF = requestAnimationFrame(loop);
			}
		}
	};

	PF.move = function(ud) {
		if ( !paused ) { pixels.moveHarry(ud); }
	};

	function cancelAnimation() {
		cancelAnimationFrame(rAF);
		rAF = 0;
	}

	function increaseLevel() {
		levelTime = 0;
		if ( maxLevel !== level ) {
			level++;
			sounds.level.play();
			pixels.nextLevel(level);
			gen.increaseMaxRun();
			updateFrequency -= updateFrequency * (config.levelSpeedIncrement/100);
		}else {
			victory = true;
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
        if ( victory || pixels.gameover ) {
        	if ( victory ) {
	        	images.show("win");
	        	sounds.game.stop();
	        	sounds.win.play();
        	}else {
	        	images.show("lose");
	        	sounds.game.stop();
	        	sounds.lose.play();
        	}
			cancelAnimation();
			started = false;
			setTimeout(function () {
				// launch();
				document.location.reload();
			}, config.endImageDelay * 1000);
        }else {
        	pixels.draw();
        }
    }

    function queue() {
        if ( rAF ) { rAF = requestAnimationFrame(loop); }
    }
}