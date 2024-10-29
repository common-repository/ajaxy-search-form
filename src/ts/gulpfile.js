//Gulp to compile typescript
console.log(new Date().getTime());
var gulp = require("gulp");
var gutil = require("gulp-util");
var sass = require("gulp-sass")(require("sass"));
var sourcemaps = require("gulp-sourcemaps");
var { rollup, watch } = require("rollup");
var autoprefixer = require("autoprefixer");
const postcss = require("gulp-postcss");
var plumber = require("gulp-plumber");
var browserSync = require("browser-sync").create();
const path = require("path");
const { doesNotMatch } = require("assert");

gulp.task("sass:watch", function () {
	gulp.watch(["../scss/**/*.scss"], gulp.parallel("sass"));
});

gulp.task("sass", function (done) {
    var sass_files = ["../scss/*.scss", "../scss/**/*.scss"];
	var src = null;
	if (gutil.env && gutil.env.NODE_ENV == "development") {
		src = gulp
			.src(sass_files)
			.pipe(sourcemaps.init({ largeFile: true }))
			.pipe(sourcemaps.identityMap())
			.pipe(sass().on("error", sass.logError))
			.pipe(postcss([autoprefixer("last 2 versions")]))
			.pipe(sourcemaps.write());
	} else {
		src = gulp
			.src(sass_files)
			.pipe(
				sass({
					outputStyle: "compressed", 
				}).on("error", sass.logError)
			)
			.pipe(postcss([autoprefixer("last 2 versions")]));
	}
	src.pipe(gulp.dest("../../themes/")).pipe(browserSync.stream());
	done();
});

gulp.task("rollup:build-dev", function (done) {
	//watch each alone so we don't have to build everything on change
	return new Promise(gulp.series("rollup:watch"));
	// gulp.watch(["./scripts/**/**/*"], gulp.series("rollup:watch")).on("change", function () {
	// 	gutil.env.NODE_ENV = "development";
	// });
});

gulp.task("rollup:build", function (done) {
	var rollupConfig = require(path.resolve(__dirname, "./rollup.config.js"));
	[].forEach.call(rollupConfig, function (config) {
		rollup(config)
			.then((bundle) => {
				console.log("Bundle...");
				bundle
					.write(config.output)
					.then((e) => {
						done();
					})
					.catch((e) => {
						console.error(e);
						done();
					});
			})
			.catch((e) => {
				console.error(e);
				done();
			});
	});
});

gulp.task("rollup:watch", function (done) {
	console.log("Watching...");
	var rollupConfig = require(path.resolve(__dirname, "./rollup.config.js"));
	const watcher = watch(rollupConfig);
	watcher.on("event", ({ result }) => {
		if (result) {
			result.close();
			done();
		}
	});
});

gulp.task("dev", function (done) {
	console.log("Welcome...");

	if (!gutil.env.NODE_ENV) {
		gutil.env = {
			NODE_ENV: "development",
		};
	}

	process.env.dev = "true";
	return new Promise(gulp.parallel("sass:watch", "rollup:build-dev"));
});

gulp.task("build", function () {
	console.log("Building...");

	if (!gutil.env.NODE_ENV) {
		gutil.env = {
			NODE_ENV: "production",
		};
	}

	return new Promise(gulp.parallel("sass", "rollup:build"));
});
