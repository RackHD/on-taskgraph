'use strict';
module.exports = prepareGrunt;

/**
 * Sets up grunt for functioning with the specific add ins/modules and
 * configuration we provide in this gruntfile.js.
 * @param {grunt} grunt
 */
function prepareGrunt(grunt) {
    var allFiles = [
        'package.json',
        'Gruntfile.js',
        'lib/**/*.js',
        'spec/**/*',
        '.jshintrc',
        'spec/**/.jshintrc',
        'lib/**/.jshintrc'
    ];

    var allConfigFiles = [
        'Gruntfile.js'
    ];

    var allLibFiles = [
        'Gruntfile.js',
        'lib/**/*.js',
        'index.js'
    ];

    var allSpecFiles = [
        'spec/**/*-spec.js'
    ];

    var allIgnoreFiles = [
        'node_modules/**/*',
        'spec/**/*-disabled.js'
    ];

    // grunt configuration.
    grunt.initConfig({

        // grunt-contrib-jshint
            jshint: {
                // grunt jshint:source
                // will check the source files only
                source: {
                    src: allLibFiles
                },
                // grunt jshint:spec
                // will check the spec files only
                spec: {
                    src: allSpecFiles,
                    // use test specific .jshintrc for spec folder
                    options: {
                        jshintrc: 'spec/.jshintrc'
                    }
                },
                options: {
                    // default to the root .jshintrc
                    jshintrc: '.jshintrc',

                    // ensure we don't waste our time on files we have
                    // explicitly disabled or that we have brought in from
                    // other libraries.
                    ignores: allIgnoreFiles
                }
            },

        // grunt-contrib-watch
            watch: {
                // use with 'grunt watch' from command line ensure we reload
                // our watches when ANY of these files change.
                files: allConfigFiles,
                options: {
                    reload: true
                },
                jshint: {
                    files: allFiles,
                    tasks: ['jshint'],
                    options:{
                        interrupt: true,
                        atBegin: true
                    }
                },
                // grunt watch:mochaTest
                mochaTest: {
                    files: allFiles,
                    tasks: ['coverage'],
                    options:{
                        interrupt: true,
                        atBegin: true
                    }
                }
            },

        // grunt-mocha-test
            mochaTest: {
                // run all tests
                test: {
                    options: {
                        reporter: 'spec',
                        require: 'spec/helper'
                    },
                    src: allSpecFiles
                },
                min: {
                    options: {
                        reporter: 'spec',
                        require: 'spec/helper'
                    },
                    src: allSpecFiles
                }
            },

            'mocha_istanbul': {
                coverage: {
                    src: 'spec',
                    options: {
                        excludes: [
                            'spec/**/*.js'
                        ],
                        mask: '**/*-spec.js',
                        reportFormats: ['html'],
                        mochaOptions: [
                            '--require',
                            'spec/helper'
                        ]
                    }
                }
            }
        });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-mocha-istanbul');
    grunt.loadNpmTasks('grunt-notify');

    // Whenever the "coverage" task is run, run these tasks
    grunt.registerTask('coverage', ['mocha_istanbul:coverage']);

    // Whenever the "test" task is run, run these tasks
    grunt.registerTask('test', ['jshint', 'mochaTest:test']);

    // By default, lint and run all tests.
    grunt.registerTask('default', ['jshint', 'coverage']);
}

