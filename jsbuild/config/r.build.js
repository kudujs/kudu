/**
 * Run this file with
 * build>node build
 * 
  * NOTE: The properties appDir, dir, mainConfigFile, out, wrap.startFile, wrap.endFile are relative to the build folder: jsbuild
  * For baseUrl, it is relative to appDir
  * For paths and packages, they are relative to baseUrl, just as they are for require.js.
 */

({
   baseUrl: "../src",
    optimize: 'uglify2',
    //optimize: 'none',
	fileExclusionRegExp: /^node_modules$|^bower_components$/,
    removeCombined: true,
	generateSourceMaps: true,
    skipDirOptimize: true,
	preserveLicenseComments: false,
    //"mainConfigFile": "../web/src/js/app/config/config.js",
	//"mainConfigFile": "../src/js/tmp-config.js", // this file is dynamically crreated by copying ../src/js/config.js to build/tmp-config.js. This is done in build.js
	//name: "config",
    paths: {
        //"config": "../app/config/config",
        //"requireLib": "require"
        "jquery": "empty:",
		"ractive": "empty:"
    },
	 name: "kudu",
    out: "../dist/kudu.{version}.min.js",
	srcOut: "../dist/kudu.{version}.js",
	
	//stubModules: [ 'rvc', 'text', "ractive", "jquery" ],
	stubModules: [ 'rvc', 'rv', 'text' ],
	//stubModules: [ 'rvc', 'text' ],
    /*
    modules: [
        {
            name: "config",
            include: [
                "requireLib"
            ]
        }
    ],*/
});
