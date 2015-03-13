"use strict";
/* global Howl */
/* global console */

function Pitfall(config) {

	if ( !( this instanceof Pitfall ) ) { return new Pitfall(config); }

	var PF = this,
		canvas = document.createElement("canvas"),
		ctx = canvas.getContext("2d"),
		square = config.square,
		levelTimeIncrement = config.levelTimeIncrement * 1000,
		tickToSendData = config.tickToSendData,
		gen = new Generator(config),
		images = new Images(config, launch),
		maxLevel = config.colors.level.length - 1,
		pixels = new Pixels(config),
		soundsPaused, rAF, paused, started, victory, resetDelay,
		updateFrequency, level, levelTime, moveDirection,
		animationTick, imageData,
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

	ctx.imageSmoothingEnabled = false;
	canvas.width = config.width * square;
	canvas.height = config.height * square;
	canvas.id = "game";
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
		loop.lastTime = 0;
		animationTick = 0;
		updateFrequency = config.updateFrequency;
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
			maxRunIncrement = o.maxRunIncrement,
			width = o.width,
			pw = o.pathWidth,
			M = Math,
			run, trend, maxRun;
		self.mark = null;
		self.initMap = null;
		self.initMark = null;
		self.init = function () {
			maxRun = o.maxRun;
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
			levelUpColor = colors.levelUp,
			bumpColors = colors.bump,
			flashTime = o.bumpFlashTime * 1000,
			pw = o.pathWidth,
			levelUp, levelUpColors, bumped,
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
				posY = Math.floor(o.height/5),
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

		function getRow(index, mark, levelup) {
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
					pixel.bumpColor = bumpColors.terrain;
				}else if ( i === mark ) {
					pixel.type = "edge";
					pixel.color = levelColors.edge;
					pixel.bumpColor = bumpColors.edge;
				}else if ( i < mark + pw ) {
					pixel.type = "background";
					pixel.color = levelColors.background;
					pixel.bumpColor = bumpColors.background;
				}else if ( i === mark + pw ) {
					pixel.type = "edge";
					pixel.color = levelColors.edge;
					pixel.bumpColor = bumpColors.edge;
				}else {
					pixel.type = "terrain";
					pixel.color = levelColors.terrain;
					pixel.bumpColor = bumpColors.terrain;
				}
				if ( levelup ) {
					pixel.levelUpColor = levelUpColors[levelup];
				}
				arr.push(pixel);
			}
			return arr;
		}

		function drawPixel(p) {
			ctx.fillStyle = p.color;
			ctx.fillRect(p.x, p.y, square, square);
			if ( p.levelUpColor ) {
				ctx.fillStyle = p.levelUpColor;
				ctx.fillRect(p.x, p.y, square, square);
			}
		}

		function drawPixelBumped(p) {
			ctx.fillStyle = p.bumpColor;
			ctx.fillRect(p.x, p.y, square, square);
		}

		self.gameover = false;

		self.draw = function() {
			var i = 0, j = 0;
			if ( bumped ) {
				for ( ; i < o.height; i++ ) {
					for ( j = 0; j < o.width; j++ ) {
						drawPixelBumped(pixels[i][j]);
					}
				}
			}else {
				for ( ; i < o.height; i++ ) {
					for ( j = 0; j < o.width; j++ ) {
						drawPixel(pixels[i][j]);
					}
				}
			}
			drawPixel(harry);
		};

		function moveHarry(dir) {
			if ( pixels[harry.row][harry.column].color === levelColors.edge ) { return; }
			var add = ( +dir ) ? dir : ( dir === "left" ) ? -1 : 1;
			harry.column += add;
			if ( harry.column > o.width - 2 ) {
				harry.column = o.width - 2;
			}else if ( harry.column < 1 ) {
				harry.column = 1;
			}
			harry.x = harry.column * square;
		}

		function updateHarry() {
			var bump;
			if ( pixels[harry.row][harry.column].color === levelColors.edge ) {
				sounds.bump.play();
				harry.health++;
				bump = (pixels[harry.row][harry.column + 1].color === levelColors.terrain) ? -1 * Math.floor(pw/2) : Math.floor(pw/2);
				harry.column += bump;
				harry.x = harry.column * square;
				if ( harry.colors[harry.health] ) {
					harry.color = harry.colors[harry.health];
					bumped = true;
					setTimeout(function () {
						bumped = false;
					}, flashTime);
				}else {
					harry.color = "#FF1D23";
					return true;
				}
			}
		}

		self.moveHarryX = function(xCol) {
			harry.column = xCol;
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

		function setLevelUpColors(n, colorarr) {
			var arr = [],
				colorstr = colorarr.join(","),
				delta = 1/n,
				i = 0,
				opacity, color;
			for ( ; i < n; i++ ) {
				opacity = 1 - delta * i;
				color = "rgba("+ colorstr + "," + opacity + ")";
				arr.push(color);
			}
			return arr;
		}

		self.update = function(mark, movedir) {
			var row = getRow(o.height - 1, mark, levelUp),
				i = 0, j;
			pixels.shift();
			if ( movedir && !bumped ) { moveHarry(movedir); }
			self.gameover = updateHarry();
			for ( ; i < o.height - 1; i++ ) {
				for ( j = 0; j < o.width; j++ ) {
					pixels[i][j].y -= square;
				}
			}
			pixels.push(row);
			if ( levelUp ) {
				levelUp--;
				if ( levelUp === 1 ) { levelColors = colors.level[level]; }
			}
		};

		self.init = function(map, mark) {
			levelUpColors = setLevelUpColors(o.levelUpRows, levelUpColor);
			levelColors = colors.level[0];
			pixels = initPixels(o, map);
			pixels = setColors(pixels, levelColors);
			harry = initHarry(o, mark);
		};

		self.nextLevel = function() {
			levelUp = o.levelUpRows;
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
		if ( !paused && !moveDirection ) {
			moveDirection = ud;
		}
	};

	PF.moveABS = function(x) {
		if ( !paused ) { pixels.moveHarryX(x); }
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
    		if ( levelTime > levelTimeIncrement ) { increaseLevel(); }
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
        pixels.update(gen.mark, moveDirection);
        if ( moveDirection ) { moveDirection = false; }
        if ( victory || pixels.gameover ) {
        	if ( victory ) {
	        	images.show("win");
	        	sounds.game.stop();
	        	sounds.win.play();
	        	resetDelay = config.endImageDelay.success * 1000;
        	}else {
	        	images.show("lose");
	        	sounds.game.stop();
	        	sounds.lose.play();
	        	resetDelay = config.endImageDelay.fail * 1000;
        	}
			cancelAnimation();
			started = false;
			setTimeout(launch, resetDelay);
        }else {
        	pixels.draw();
        	animationTick++;
        	if ( animationTick === tickToSendData ) {
        		imageData = getData();
        		fireEvent(imageData);
        		animationTick = 0;
        	}
        }
    }

    function queue() {
        if ( rAF ) { rAF = requestAnimationFrame(loop); }
    }

	function getData() {
		var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data,
			len = imageData.length,
			data = [],
			i = 0;
		for ( ; i < len; i++ ) {
			data.push(imageData[i], imageData[i + 1], imageData[i + 2]);
		}
		return data;
	}

    function fireEvent(data) {
		var ev = new CustomEvent("pitfall.imageData", { detail: data });
		document.dispatchEvent(ev);
	}
}