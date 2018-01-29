const path = require('path');
const log = require('npmlog');
const sh = require('../utils/sh');

class ArtifactsCopier {
  constructor(deviceDriver) {
    this._deviceDriver = deviceDriver;
    this._currentLaunchNumber = 0;
    this._currentTestArtifactsDestination = undefined;
    this._artifacts = [];
    this._queue = [];
  }

  prepare(deviceId) {
    this._deviceId = deviceId;
  }

  addArtifact(source, destName) {
    this._artifacts.push([source, destName + path.extname(source.toString())]);
  }

  queueArtifact(source, destName) {
    this._queue.push([
      this._currentTestArtifactsDestination,
      this._currentLaunchNumber,
      source,
      destName + path.extname(source.toString())
    ]);
  }

  setArtifactsDestination(artifactsDestination) {
    this._currentTestArtifactsDestination = artifactsDestination;
    this._currentLaunchNumber = 1;
  }

  async handleAppRelaunch() {
    await this._copyArtifacts();
    this._currentLaunchNumber++;
  }

  async finalizeArtifacts() {
    await this._copyArtifacts();
  }

  _move() {
    return this._exec('move', ...arguments);
  }

  _copy() {
    return this._exec('copy', ...arguments);
  }

  async _exec(
    method,
    artifact,
    destinationSuffix,
    launchNumber = this._currentLaunchNumber,
    destinationDirectory = this._currentTestArtifactsDestination,
  ) {
    const destinationPath = `${destinationDirectory}/${launchNumber}.${destinationSuffix}`;
    try {
      await artifact[method](destinationPath);
    } catch (ex) {
      log.warn(
        `Couldn't ${method} "${artifact.toString()}"\nbecause: ${ex}`
      );
    }
  }

  async _copyArtifacts() {
    if (this._currentTestArtifactsDestination === undefined) {
      return;
    }

    const {stdout, stderr} = this._deviceDriver.getLogsPaths(this._deviceId);
    if (stdout) {
      await this._copy(stdout, 'out.log');
    }
    if (stderr) {
      await this._copy(stderr, 'err.log');
    }

    for (const [source, dest] of this._artifacts) {
      await this._move(source, dest);
    }
    this._artifacts.splice(0);
  }

  async processQueue() {
    for (const [destDir, launchNumber, source, destName] of this._queue) {
      await this._move(source, destName, launchNumber, destDir);
    }
    this._queue.splice(0);
  }

}

module.exports = ArtifactsCopier;
