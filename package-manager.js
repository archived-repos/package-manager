'use strict';

// task.bower-tmp

var grunt = require('grunt'),
    extend = require('util')._extend,
    path = require('path'),
    typeFiles = {
      'bower': {
        json: ['bower.json', '.bower.json'],
        folder: ['bower_components', '.bower_components']
      },
      'npm': {
        json: ['package.json', '.bower.json'],
        folder: ['node_modules']
      }
    };

function _getDependenciesPath (pkgType) {

  if( grunt.file.isFile('.' + pkgType + 'rc') ) {
    var rc = grunt.file.readJSON('.' + pkgType + 'rc');

    if( rc.directory ) {
      return rc.directory;
    }
  }

  for( var i = 0, list = typeFiles[pkgType].folders, len = list.length; i < len; i++ ) {
    if( grunt.file.isDir( cwd, list[i] ) ) {
      return list[i];
    }
  }

  return;

}

function _getPkgJSON (pkgType, cwd) {
  for( var i = 0, list = typeFiles[pkgType].json, len = list.length; i < len; i++ ) {
    if( grunt.file.isFile( cwd, list[i] ) ) {
      return grunt.file.readJSON( path.join(cwd, list[i]) );
    }
  }
  return;
}

function _getMainFiles (main) {
  if( main === undefined ) {
    return [];
  } else if( typeof main === 'string' ) {
    return [main];
  } else if( main instanceof Array ) {
    return main;
  }
}

function _findMainFiles (cwd, subset) {
  var pkgJSON = _getPkgJSON(this.type, cwd),
      mainList = _getMainFiles(pkgJSON.main),
      dependencies;

  if( !pkgJSON ) {
    return;
  }

  for( var i = 0, len = mainList.length ; i < len ; i++ ) {
    this.fileList.push( path.join(cwd, mainList[i]) );
  }

  if( subset && this.root ) {
    this.root = false;
    dependencies = pkgJSON[subset + 'Dependencies'];
  } else {
    dependencies = pkgJSON.dependencies;
  }

  if( !dependencies ) {
    return this;
  }

  for( var dependence in dependencies ) {
    if( !this.found[dependence] ) {
      this.found[dependence] = dependencies[dependence];
      _findMainFiles.call( this, path.join(this.dependenciesPath, dependence) );
    }
  }
}

function PkgManager (pkgType) {
  this.type = pkgType;
  this.dependenciesPath = _getDependenciesPath(pkgType);
}

PkgManager.prototype.find = function (subset) {
  this.fileList = [];
  this.found = {};
  this.root = true;

  _findMainFiles.call(this, '.', subset);

  return this.fileList;
}

module.exports = PkgManager;
