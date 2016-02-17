module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        express: {
            dev: {
                options: {
                    script: 'index.js'
                }
            }
        },

        watch: {
            sass: {
                files: ['sass/**/*.{scss,sass}'],
                tasks: ['sass', 'autoprefixer']
            },

            autoprefixer: {
                files: ['css/**/*.css'],
                tasks: ['copy:stageCss', 'autoprefixer']
            }
        },


        sass: {
            options: {
                debugInfo: false,
                lineNumbers: false,
                loadPath: '_bower_components',
                require: ['sass-globbing', 'singularitygs', 'breakpoint']
            },
            server: {
                options: {
                    debugInfo: false,
                    lineNumbers: false
                },
                files: [{
                    expand: true,
                    cwd: 'sass',
                    src: '**/*.{scss,sass}',
                    dest: '.tmp',
                    ext: '.css'
                }]
            }
        },

        autoprefixer: {
            options: {
                browsers: ['last 2 versions']
            },
            dist: {
                expand: true,
                cwd: '.tmp',
                src: '**/*.css',
                dest: 'css'
            }
        },

        clean: {
            server: [
                '.tmp',
                'css',
                '.sass-cache'
            ]
        },

        copy: {
            stageCss: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: 'css',
                    src: '**/*.css',
                    dest: '.tmp/css'
                }]
            }
        },

        browserSync: {
            server: {
                bsFiles: {
                    src: [
                        'views/**/*.handlebar',
                        '.tmp/css/**/*.css'
                    ]
                },
                options: {
                    proxy: "http://localhost:3000",
                    watchTask: true
                }
            }
        }
    });

    grunt.registerTask('default', [
        'serve'
    ]);


    // Define Tasks
    grunt.registerTask('serve', function (target) {
        grunt.task.run([
            'clean',
            'express',
            'browserSync',
            'sass',
            'watch'
        ]);
    });
};