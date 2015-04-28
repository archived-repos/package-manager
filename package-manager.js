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

  for( var i = 0, list = typeFiles[pkgType].folder || [], len = list.length; i < len; i++ ) {
    if( grunt.file.isDir( list[i] ) ) {
      return list[i];
    }
  }

  return;

}

function _getPkgJSON (pkgType, cwd) {
  for( var i = 0, list = typeFiles[pkgType].json || [], len = list.length; i < len; i++ ) {
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

function _findMainFiles (cwd, src) {
  var pkgJSON = _getPkgJSON(this.type, cwd);

  if( !pkgJSON ) {
    return;
  }

  var mainList = _getMainFiles(pkgJSON.main),
      dependencies;

  for( var i = 0, len = mainList.length ; i < len ; i++ ) {
    this.fileList.push( path.join(cwd, mainList[i]) );
  }

  if( src && this.root ) {
    this.root = false;
    dependencies = pkgJSON[src];
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

PkgManager.prototype.find = function (options) {
  options.cwd = options.cwd || '';

  this.found = {};
  this.root = true;
  this.options = options || {};

  if( !this.fileList || !options.append ) {
    this.fileList = [];
  }

  console.log(this);

  _findMainFiles.call(this, this.options.cwd || '.', this.options.src);

  return this;
}

PkgManager.prototype.list = function () {
  return this.fileList;
}

PkgManager.prototype.copy = function (dest, options) {
  options = options || {};
  options.cwd = options.cwd || '';

  var fileList = ( options instanceof Array ) ? options : undefined;

  if( !fileList && !this.fileList ) {
    this.options = this.options || {};
    extend(this.options, { src: options.src, cwd: options.cwd });
    this.find();
    fileList = this.fileList;
  }

  var expandedList = grunt.file.expand(fileList),
      flatten = options.expand === undefined || !options.expand,
      RE_PKG_BASE = new RegExp('^' + path.join(this.options.cwd || '.', this.dependenciesPath).replace(/\//g, '\\/') + '\\/'),
      fileDest;

  for( var i = 0, len = expandedList.length; i < len; i++ ) {
    fileDest = path.join(dest, flatten ? path.basename(expandedList[i]) : expandedList[i].replace(RE_PKG_BASE, '') );
    grunt.file.write(fileDest, grunt.file.read(expandedList[i]) );
  }

  console.log(len, 'files copied');
}


module.exports = function (pkgType) {
  return new PkgManager(pkgType);
};
