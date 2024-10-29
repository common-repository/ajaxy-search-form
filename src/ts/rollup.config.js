const { nodeResolve } = require("@rollup/plugin-node-resolve");
const typescript = require("@rollup/plugin-typescript");
const { terser } = require("rollup-plugin-terser");
const replace = require("@rollup/plugin-replace");
const path = require("path");

const extensions = [".js", ".ts", ".tsx"];

let production = !(process.env.dev == "true");
module.exports = [
	{
		input: path.resolve(__dirname, "./scripts/app.ts"),
		output: {
			file: path.resolve(__dirname, "../../js/app.js"),
			format: "iife",
			name: "theme",
			sourcemap: !production ? "inline" : false,
		},

		plugins: [
			nodeResolve({ extensions }),
			typescript({
				exclude: path.resolve(__dirname, "./node_modules"),
				tsconfig: path.resolve(__dirname, "./tsconfig.json"),
			}),
			replace({
				"process.env.NODE_ENV": JSON.stringify(production ? "production" : "development"),
				ENVIRONMENT: JSON.stringify(production ? "production" : "development"),
				preventAssignment: true,
			}),
			production && terser(),
		],
	},
];
