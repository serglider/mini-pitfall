var gulp = require("gulp"),
    connect = require("gulp-connect");

gulp.task("connect", function() {
    connect.server({
        port: 9229,
        livereload: true
    });
});

gulp.task("reload", function () {
    gulp.src("index.html").pipe(connect.reload());
});

gulp.task("watch", function () {
    gulp.watch(["pitfall.js","index.html"], ["reload"]);
});

gulp.task("default", ["connect", "watch"]);