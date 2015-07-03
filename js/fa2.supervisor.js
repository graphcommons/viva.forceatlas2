var GraphCommons = GraphCommons || {};
;(function(undefined) {
  'use strict';

  GraphCommons.ForceAtlas2 = {};

  var sigma = function(viva) {
    this.viva = viva;
    var viva = this.viva;
    this.viva.graph.forEachNode(function (node) {
      viva.graphics.getNodeUI(node.id).position = viva.layout.getNodePosition(node.id);
    });
    this.viva.graph.forEachLink(function (link) {
      viva.graphics.getLinkUI(link.id).position = viva.layout.getLinkPosition(link.id);
    });
  };

  /**
   * Sigma ForceAtlas2.5 Supervisor
   * ===============================
   *
   * Author: Guillaume Plique (Yomguithereal)
   * Version: 0.1
   */
  var _root = this;

  /**
   * Feature detection
   * ------------------
   */
  var webWorkers = 'Worker' in _root;

  /**
   * Supervisor Object
   * ------------------
   */
  function Supervisor(sigInst, options) {
    var _this = this, workerFn;

    if (!sigInst.getForceAtlas2Worker) {
      sigInst.getForceAtlas2Worker = GraphCommons.Ext.Atlas2Worker;
    }

    workerFn = sigInst.getForceAtlas2Worker &&
          sigInst.getForceAtlas2Worker();

    options = options || {};

    // _root URL Polyfill
    _root.URL = _root.URL || _root.webkitURL;

    // Properties
    this.sigInst = sigInst;
    this.viva = this.sigInst.viva;
    this.ppn = 10;
    this.ppe = 3;
    this.config = {};
    this.shouldUseWorker =
      options.worker === false ? false : true && webWorkers;
    this.workerUrl = options.workerUrl;

    // State
    this.started = false;
    this.running = false;

    // Web worker or classic DOM events?
    if (this.shouldUseWorker) {
      if (!this.workerUrl) {
        var blob = this.makeBlob(workerFn);
        this.worker = new Worker(URL.createObjectURL(blob));
      }
      else {
        this.worker = new Worker(this.workerUrl);
      }

      // Post Message Polyfill
      this.worker.postMessage =
        this.worker.webkitPostMessage || this.worker.postMessage;
    }
    else {

      eval(workerFn);
    }

    // Worker message receiver
    this.msgName = (this.worker) ? 'message' : 'newCoords';
    this.listener = function(e) {

      // Retrieving data
      _this.nodesByteArray = new Float32Array(e.data.nodes);

      // If ForceAtlas2 is running, we act accordingly
      if (_this.running) {

        // Applying layout
        _this.applyLayoutChanges();

        // Send data back to worker and loop
        _this.sendByteArrayToWorker();

        // Rendering graph
        _this.sigInst.viva.renderer.rerender();
      }
    };

    (this.worker || document).addEventListener(this.msgName, this.listener);

    // Filling byteArrays
    this.nodeIndices = this.graphToByteArrays();

    // Binding on kill to properly terminate layout when parent is killed
    // sigInst.bind('kill', function() {
    //   sigInst.killForceAtlas2();
    // });
  }

  Supervisor.prototype.makeBlob = function(workerFn) {
    var blob;

    try {
      blob = new Blob([workerFn], {type: 'application/javascript'});
    }
    catch (e) {
      _root.BlobBuilder = _root.BlobBuilder ||
                          _root.WebKitBlobBuilder ||
                          _root.MozBlobBuilder;

      blob = new BlobBuilder();
      blob.append(workerFn);
      blob = blob.getBlob();
    }

    return blob;
  };

  Supervisor.prototype.graphToByteArrays = function() {
    var nbytes = this.viva.graph.getNodesCount() * this.ppn,
        ebytes = this.viva.graph.getLinksCount() * this.ppe,
        nIndex = {},
        i,
        j,
        l,
        pos;
    var graph = this.viva.graph;
    var layout = this.viva.layout;
    var me = this;

    // Allocating Byte arrays with correct nb of bytes
    this.nodesByteArray = new Float32Array(nbytes);
    this.edgesByteArray = new Float32Array(ebytes);

    j = 0;
    graph.forEachNode(function (node) {
      pos = layout.getNodePosition(node.id);

      // Populating index
      nIndex[node.id] = j;

      // Populating byte array
      me.nodesByteArray[j] = pos.x;
      me.nodesByteArray[j + 1] = pos.y;
      me.nodesByteArray[j + 2] = 0;
      me.nodesByteArray[j + 3] = 0;
      me.nodesByteArray[j + 4] = 0;
      me.nodesByteArray[j + 5] = 0;
      me.nodesByteArray[j + 6] = 1 + node.links.length;
      me.nodesByteArray[j + 7] = 1;
      me.nodesByteArray[j + 8] = 12; //node.data.size;
      me.nodesByteArray[j + 9] = 0;
      j += me.ppn;
    });

    j = 0;
    graph.forEachLink(function (link) {
      me.edgesByteArray[j] = nIndex[link.fromId];
      me.edgesByteArray[j + 1] = nIndex[link.toId];
      me.edgesByteArray[j + 2] = link.data && link.data.weight || 0;
      j += me.ppe;
    });

    return nIndex;

  };

  // TODO: make a better send function
  Supervisor.prototype.applyLayoutChanges = function() {
    var layout = this.viva.layout;
    var nodeIndices = this.nodeIndices;
    var _this = this;
    var j;
    this.viva.graph.forEachNode(function (node) {
      j = _this.nodeIndices[node.id];
      layout.setNodePosition(node.id, _this.nodesByteArray[j], _this.nodesByteArray[j + 1]);
    });

    this.viva.renderer.rerender();
  };

  Supervisor.prototype.sendByteArrayToWorker = function(action) {
    var content = {
      action: action || 'loop',
      nodes: this.nodesByteArray.buffer
    };

    var buffers = [this.nodesByteArray.buffer];

    if (action === 'start') {
      content.config = this.config || {};
      content.edges = this.edgesByteArray.buffer;
      buffers.push(this.edgesByteArray.buffer);
    }

    if (this.shouldUseWorker)
      this.worker.postMessage(content, buffers);
    else
      _root.postMessage(content, '*');
  };

  Supervisor.prototype.start = function() {
    if (this.running)
      return;

    this.running = true;

    // Do not refresh edgequadtree during layout:
    var k,
        c;
    for (k in this.sigInst.cameras) {
      c = this.sigInst.cameras[k];
      c.edgequadtree._enabled = false;
    }

    if (!this.started) {

      // Sending init message to worker
      this.sendByteArrayToWorker('start');
      this.started = true;
    }
    else {
      this.sendByteArrayToWorker();
    }
  };

  Supervisor.prototype.stop = function() {
    if (!this.running)
      return;

    // Allow to refresh edgequadtree:
    var k,
        c,
        bounds;
    for (k in this.sigInst.cameras) {
      c = this.sigInst.cameras[k];
      c.edgequadtree._enabled = true;

      // Find graph boundaries:
      bounds = sigma.utils.getBoundaries(
        this.graph,
        c.readPrefix
      );

      // Refresh edgequadtree:
      if (c.settings('drawEdges') && c.settings('enableEdgeHovering'))
        c.edgequadtree.index(this.sigInst.graph, {
          prefix: c.readPrefix,
          bounds: {
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.maxX - bounds.minX,
            height: bounds.maxY - bounds.minY
          }
        });
    }

    this.running = false;
  };

  Supervisor.prototype.killWorker = function() {
    if (this.worker) {
      this.worker.terminate();
    }
    else {
      _root.postMessage({action: 'kill'}, '*');
      document.removeEventListener(this.msgName, this.listener);
    }
  };

  Supervisor.prototype.configure = function(config) {

    // Setting configuration
    this.config = config;

    if (!this.started)
      return;

    var data = {action: 'config', config: this.config};

    if (this.shouldUseWorker)
      this.worker.postMessage(data);
    else
      _root.postMessage(data, '*');
  };

  /**
   * Interface
   * ----------
   */
  sigma.prototype.startForceAtlas2 = function(config) {
    // Create supervisor if undefined
    if (!this.supervisor)
      this.supervisor = new Supervisor(this, config);

    // Configuration provided?
    if (config)
      this.supervisor.configure(config);

    // Start algorithm
    this.supervisor.start();

    return this;
  };

  sigma.prototype.stopForceAtlas2 = function() {
    if (!this.supervisor)
      return this;

    // Pause algorithm
    this.supervisor.stop();

    return this;
  };

  sigma.prototype.killForceAtlas2 = function() {
    if (!this.supervisor)
      return this;

    // Stop Algorithm
    this.supervisor.stop();

    // Kill Worker
    this.supervisor.killWorker();

    // Kill supervisor
    this.supervisor = null;

    return this;
  };

  sigma.prototype.configForceAtlas2 = function(config) {
    if (!this.supervisor)
      this.supervisor = new Supervisor(this, config);

    this.supervisor.configure(config);

    return this;
  };

  sigma.prototype.isForceAtlas2Running = function(config) {
    return !!this.supervisor && this.supervisor.running;
  };

  GraphCommons.ForceAtlas2.sigma = sigma;
}).call(this);
