var GraphCommons = GraphCommons || {};
GraphCommons.Layout = {};
GraphCommons.Layout.forceAtlas2 = forceAtlas2;

/**
 * Porting forceAtlas2 algorithm for Sigma,
 * originally written by Guillaume Plique
 *
 * implements the layout interface for Viva Graph
 *
 * @param {Viva.Graph.graph} graph to layout
 * @param {Object} userSettings
 */
function forceAtlas2(graph, userSettings) {
    var settings = {
      linLogMode: false,
      outboundAttractionDistribution: false,
      adjustSizes: false,
      edgeWeightInfluence: 0,
      scalingRatio: 1,
      strongGravityMode: false,
      gravity: 1,
      slowDown: 10,
      barnesHutOptimize: false,
      barnesHutTheta: 0.5,
      startingIterations: 1,
      iterationsPerRender: 1,
      stableThreshold: 2.0
    };

    userSettings = userSettings || {};

    settings = extend(userSettings, settings);

    var graphRect = {
      x1: Number.MAX_VALUE,
      y1: Number.MAX_VALUE,
      x2: Number.MIN_VALUE,
      y2: Number.MIN_VALUE
    };

    /**
     * Worker settings and properties
     */
    var W = {
      // Propertie
      maxForce: 10,
      iterations: 0,
      converged: false,
    };

    var NodesCount = 0;
    var EdgesCount = 0;
    var NodeList = [];
    var NodeMatrix = {};
    var EdgeMatrix = {};
    var RegionMatrix;

    var placeNodeCallback = function (node) {
        return {
          x: -512 + Math.random() * 1024,
          y: -512 + Math.random() * 1024
        };
    };

    var updateGraphRect = function (position, graphRect) {
        if (position.x < graphRect.x1) { graphRect.x1 = position.x; }
        if (position.x > graphRect.x2) { graphRect.x2 = position.x; }
        if (position.y < graphRect.y1) { graphRect.y1 = position.y; }
        if (position.y > graphRect.y2) { graphRect.y2 = position.y; }
    };

    var initNode = function (node) {
        NodeList.push(node.id);
        NodeMatrix[node.id] = {
          pos: {
            x: -512 + Math.random() * 1024,
            y: -512 + Math.random() * 1024
          },
          dx: 0,
          dy: 0,
          old_dx: 0,
          old_dy: 0,
          mass: 1,
          convergence: 1,
          size: 1,
          fixed: 0
        };

        NodesCount += 1;

        updateGraphRect(NodeMatrix[node.id], graphRect);
    };

    var releaseNode = function (node) {
      NodeList.splice(NodeList.indexOf(node.id), 1);

      delete NodeMatrix[node.id];
      NodesCount -= 1;
    };

    var updateNodePositions = function () {
      if (graph.getNodesCount() === 0) { return; }

      graphRect.x1 = Number.MAX_VALUE;
      graphRect.y1 = Number.MAX_VALUE;
      graphRect.x2 = Number.MIN_VALUE;
      graphRect.y2 = Number.MIN_VALUE;

      graph.forEachNode(initNode);
    };

    var initLink = function (link) {
      EdgeMatrix[link.id] = {
        source: link.fromId,
        target: link.toId,
        weight: link.data && link.data.weight ? link.data.weight : 0
      };

      var fromNode = NodeMatrix[link.fromId];
      var toNode = NodeMatrix[link.toid];
      if (fromNode) {
        fromNode.mass += 1;
      }
      if (toNode) {
        toNode.mass += 1;
      }

      EdgesCount += 1;
    };

    var releaseLink = function (link) {
      var _link = EdgeMatrix[link.id];
      var _from, _to;

      if (_link) {
        _from = NodeMatrix[_link.source];
        _to = NodeMatrix[_link.target];

        if (_from) {
          _from.mass -= 1;
        }

        if (_to) {
          _to.mass -= 1;
        }

        delete EdgeMatrix[link.id];
        EdgesCount -= 1;
      }
    };

    var onGraphChanged = function(changes) {
      for (var i = 0; i < changes.length; ++i) {
        var change = changes[i];
        if (change.node) {
          if (change.changeType === 'add') {
              initNode(change.node);
          } else {
              releaseNode(change.node);
          }
        }
        if (change.link) {
          if (change.changeType === 'add') {
              initLink(change.link);
          } else {
              releaseLink(change.link);
          }
        }
      }
    };

    graph.forEachNode(initNode);
    graph.forEachLink(initLink);
    graph.on('changed', onGraphChanged);

    return {
        /**
         * Attempts to layout graph within given number of iterations.
         *
         * @param {integer} [iterationsCount] number of algorithm's iterations.
         *  The constant layout ignores this parameter.
         */
        run : function (iterationsCount) {
            this.step();
        },

        /**
         * One step of layout algorithm.
         */
        step : function () {
          return applyForceAtlas2();
        },

        /**
         * Returns rectangle structure {x1, y1, x2, y2}, which represents
         * current space occupied by graph.
         */
        getGraphRect : function () {
            return graphRect;
        },

        /**
         * Request to release all resources
         */
        dispose : function () {
            graph.off('change', onGraphChanged);
        },

        /*
         * Checks whether given node is pinned; all nodes in this layout are pinned.
         */
        isNodePinned: function (node) {
            return NodeMatrix[node.id]['fixed'] === 0;
        },

        /*
         * Requests layout algorithm to pin/unpin node to its current position
         * Pinned nodes should not be affected by layout algorithm and always
         * remain at their position
         */
        pinNode: function (node, isPinned) {
           NodeMatrix[node.id]['fixed'] === isPinned ? 0 : 1;
        },

        /*
         * Gets position of a node by its id. If node was not seen by this
         * layout algorithm undefined value is returned;
         */
        getNodePosition: getNodePosition,

        /**
         * Returns {from, to} position of a link.
         */
        getLinkPosition: function (linkId) {
          var link = EdgeMatrix[linkId];
          return {
              from : getNodePosition(link.source),
              to : getNodePosition(link.target)
          };
        },

        /**
         * Sets position of a node to a given coordinates
         */
        setNodePosition: function (nodeId, x, y) {
            var pos = NodeMatrix[nodeId]['pos'];
            pos['x'] = x;
            pos['y'] = y;
        },

        // Layout specific methods:

        /**
         * Based on argument either update default node placement callback or
         * attempts to place given node using current placement callback.
         * Setting new node callback triggers position update for all nodes.
         *
         * @param {Object} newPlaceNodeCallbackOrNode - if it is a function then
         * default node placement callback is replaced with new one. Node placement
         * callback has a form of function (node) {}, and is expected to return an
         * object with x and y properties set to numbers.
         *
         * Otherwise if it's not a function the argument is treated as graph node
         * and current node placement callback will be used to place it.
         */
        placeNode : function (newPlaceNodeCallbackOrNode) {
            if (typeof newPlaceNodeCallbackOrNode === 'function') {
                placeNodeCallback = newPlaceNodeCallbackOrNode;
                updateNodePositions();
                return this;
            }

            // it is not a request to update placeNodeCallback, trying to place
            // a node using current callback:
            return placeNodeCallback(newPlaceNodeCallbackOrNode);
        },

        updateSettings: function (newSettings) {
          settings = extend(newSettings, settings);
        }
    };

  function getNodePosition(nodeId) {
      return NodeMatrix[nodeId]['pos'];
  }

  function applyForceAtlas2() {

      var a, i, j, l, r, n, n1, n2, e, w, g, k, m;

      var outboundAttCompensation,
          coefficient,
          xDist,
          yDist,
          ewc,
          mass,
          distance,
          size,
          factor;

      // 1) Initializing layout data
      //-----------------------------

      // Resetting positions & computing max values
      for (n in NodeMatrix) {
        //if (NodeMatrix.hasOwnPropery(n)) {
          NodeMatrix[n]['old_dx'] = NodeMatrix[n]['dx'];
          NodeMatrix[n]['old_dy'] = NodeMatrix[n]['dy'];
          NodeMatrix[n]['dx'] = 0;
          NodeMatrix[n]['dy'] = 0;
        //}
      }

      // If outbound attraction distribution, compensate
      if (settings.outboundAttractionDistribution) {
        outboundAttCompensation = 0;

        for (n in NodeMatrix) {
          //if (NodeMatrix.hasOwnPropery(n)) {
            outboundAttCompensation += NodeMatrix[n]['mass'];
          //}
        }

        outboundAttCompensation /= NodesCount;
      }


      // 1.bis) Barnes-Hut computation
      //------------------------------

      if (settings.barnesHutOptimize) {

        var minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity,
            q, q0, q1, q2, q3;

        // Setting up
        // RegionMatrix = new Float32Array(W.nodesLength / W.ppn * 4 * W.ppr);
        RegionMatrix = [];

        // Computing min and max values
        for (n in NodeMatrix) {
          //if (NodeMatrix.hasOwnPropery(n)) {
            minX = Math.min(minX, NodeMatrix[n]['pos']['x']);
            maxX = Math.max(maxX, NodeMatrix[n]['pos']['x']);
            minY = Math.min(minY, NodeMatrix[n]['pos']['y']);
            maxY = Math.max(maxY, NodeMatrix[n]['pos']['y']);
          //}
        }

        // Build the Barnes Hut root region
        RegionMatrix.push({
          'node': -1,
          'centerX': (minX + maxX) / 2,
          'centerY': (minY + maxY) / 2,
          'size': Math.max(maxX - minX, maxY - minY),
          'nextSibling': -1,
          'firstChild': -1,
          'mass': 0,
          'massCenterX': 0,
          'massCenterY': 0
        });


        // Add each node in the tree
        l = 1;
        for (n in NodeMatrix) {
          //if (NodeMatrix.hasOwnPropery(n)) {

            // Current region, starting with root
            r = 0;

            while (true) {
              // Are there sub-regions?

              // We look at first child index
              if (RegionMatrix[r]['firstChild'] >= 0) {

                // There are sub-regions

                // We just iterate to find a "leave" of the tree
                // that is an empty region or a region with a single node
                // (see next case)

                // Find the quadrant of n
                if (NodeMatrix[n]['pos']['x'] < RegionMatrix[r]['centerX']) {

                  if (NodeMatrix[n]['pos']['y'] < RegionMatrix[r]['centerY']) {

                    // Top Left quarter
                    q = RegionMatrix[r]['firstChild'];
                  }
                  else {

                    // Bottom Left quarter
                    q = RegionMatrix[r + 1]['firstChild']; // TODO null check?
                  }
                }
                else {
                  if (NodeMatrix[n]['y'] < RegionMatrix[r]['centerY']) {

                    // Top Right quarter
                    q = RegionMatrix[r + 2]['firstChild'];
                  }
                  else {

                    // Bottom Right quarter
                    q = RegionMatrix[r + 3]['firstChild'];
                  }
                }

                // Update center of mass and mass (we only do it for non-leave regions)
                RegionMatrix[r]['massCenterX'] =
                  (RegionMatrix[r]['massCenterX'] * RegionMatrix[r]['mass'] +
                   NodeMatrix[n]['pos']['x'] * NodeMatrix[n]['mass']) /
                  (RegionMatrix[r]['mass'] + NodeMatrix[n]['mass']);

                RegionMatrix[r]['massCenterY'] =
                  (RegionMatrix[r]['massCenterY'] * RegionMatrix[r]['mass'] +
                   NodeMatrix[n]['y'] * NodeMatrix[n]['mass']) /
                  (RegionMatrix[r]['mass'] + NodeMatrix[n]['mass']);

                RegionMatrix[r]['mass'] += NodeMatrix[n]['mass'];

                // Iterate on the right quadrant
                r = q;
                continue;
              }
              else {

                // There are no sub-regions: we are in a "leave"

                // Is there a node in this leave?
                if (RegionMatrix[r]['node'] < 0) {

                  // There is no node in region:
                  // we record node n and go on
                  RegionMatrix[r]['node'] = n;
                  break;
                }
                else {

                  // There is a node in this region

                  // We will need to create sub-regions, stick the two
                  // nodes (the old one r[0] and the new one n) in two
                  // subregions. If they fall in the same quadrant,
                  // we will iterate.

                  // Create sub-regions
                  RegionMatrix[r]['firstChild'] = l;
                  w = RegionMatrix[r]['size'] / 2;  // new size (half)

                  // NOTE: we use screen coordinates
                  // from Top Left to Bottom Right

                  // Top Left sub-region
                  g = RegionMatrix[r]['firstChild'];
                  RegionMatrix[g] = {};
                  RegionMatrix[g]['node'] = -1;
                  RegionMatrix[g]['centerX'] = RegionMatrix[r, 'centerX'] - w;
                  RegionMatrix[g]['centerY'] = RegionMatrix[r, 'centerY'] - w;
                  RegionMatrix[g]['size'] = w;
                  RegionMatrix[g]['nextSibling'] = g + 1;
                  RegionMatrix[g]['firstChild'] = -1;
                  RegionMatrix[g]['mass'] = 0;
                  RegionMatrix[g]['massCenterX'] = 0;
                  RegionMatrix[g]['massCenterY'] = 0;

                  // Bottom Left sub-region
                  g += 1;
                  RegionMatrix[g] = {};
                  RegionMatrix[g]['node'] = -1;
                  RegionMatrix[g]['centerX'] = RegionMatrix[r]['centerX'] - w;
                  RegionMatrix[g]['centerY'] = RegionMatrix[r]['centerY'] + w;
                  RegionMatrix[g]['size'] = w;
                  RegionMatrix[g]['nextSibling'] = g + 1;
                  RegionMatrix[g]['firstChild'] = -1;
                  RegionMatrix[g]['mass'] = 0;
                  RegionMatrix[g]['massCenterX'] = 0;
                  RegionMatrix[g]['massCenterY'] = 0;

                  // Top Right sub-region
                  g += 1;
                  RegionMatrix[g] = {};
                  RegionMatrix[g]['node'] = -1;
                  RegionMatrix[g]['centerX'] = RegionMatrix[r]['centerX'] + w;
                  RegionMatrix[g]['centerY'] = RegionMatrix[r]['centerY'] - w;
                  RegionMatrix[g]['size'] = w;
                  RegionMatrix[g]['nextSibling'] = g + 1;
                  RegionMatrix[g]['firstChild'] = -1;
                  RegionMatrix[g]['mass'] = 0;
                  RegionMatrix[g]['massCenterX'] = 0;
                  RegionMatrix[g]['massCenterY'] = 0;

                  // Bottom Right sub-region
                  g += 1;
                  RegionMatrix[g] = {};
                  RegionMatrix[g]['node'] = -1;
                  RegionMatrix[g]['centerX'] = RegionMatrix[r]['centerX'] + w;
                  RegionMatrix[g]['centerY'] = RegionMatrix[r]['centerY'] + w;
                  RegionMatrix[g]['size'] = w;
                  RegionMatrix[g]['nextSibling'] = RegionMatrix[r]['nextSibling'];
                  RegionMatrix[g]['firstChild'] = -1;
                  RegionMatrix[g]['mass'] = 0;
                  RegionMatrix[g]['massCenterX'] = 0;
                  RegionMatrix[g]['massCenterY'] = 0;

                  l += 4;

                  // Now the goal is to find two different sub-regions
                  // for the two nodes: the one previously recorded (r[0])
                  // and the one we want to add (n)

                  // Find the quadrant of the old node
                  if (NodeMatrix[RegionMatrix[r]['node']]['pos']['x'] < RegionMatrix[r]['centerX']) {
                    if (NodeMatrix[RegionMatrix[r]['node']]['pos']['y'] < RegionMatrix[r]['centerY']) {

                      // Top Left quarter
                      q = RegionMatrix[r]['firstChild'];
                    }
                    else {

                      // Bottom Left quarter
                      q = RegionMatrix[r + 1]['firstChild'] + W.ppr;
                    }
                  }
                  else {
                    if (NodeMatrix[RegionMatrix[r]['node']]['y'] < RegionMatrix[r]['centerY']) {

                      // Top Right quarter
                      q = RegionMatrix[r + 2]['firstChild'];
                    }
                    else {

                      // Bottom Right quarter
                      q = RegionMatrix[r + 3]['firstChild'];
                    }
                  }

                  // We remove r[0] from the region r, add its mass to r and record it in q
                  RegionMatrix[r]['mass'] = NodeMatrix[RegionMatrix[r]['node']]['mass'];
                  RegionMatrix[r]['massCenterX'] = NodeMatrix[RegionMatrix[r]['node']]['pos']['x'];
                  RegionMatrix[r]['massCenterY'] = NodeMatrix[RegionMatrix[r]['node']]['pos']['y'];

                  RegionMatrix[q]['node'] = RegionMatrix[r]['node'];
                  RegionMatrix[r]['node'] = -1;

                  // Find the quadrant of n
                  if (NodeMatrix[n]['pos']['x'] < RegionMatrix[r]['centerX']) {
                    if (NodeMatrix[n]['pos']['y'] < RegionMatrix[r]['centerY']) {

                      // Top Left quarter
                      q2 = RegionMatrix[r]['firstChild'];
                    }
                    else {
                      // Bottom Left quarter
                      q2 = RegionMatrix[r + 1]['firstChild'];
                    }
                  }
                  else {
                    if(NodeMatrix[n]['y'] < RegionMatrix[r]['centerY']) {

                      // Top Right quarter
                      q2 = RegionMatrix[r + 2]['firstChild'];
                    }
                    else {

                      // Bottom Right quarter
                      q2 = RegionMatrix[r + 3]['firstChild'];
                    }
                  }

                  if (q === q2) {

                    // If both nodes are in the same quadrant,
                    // we have to try it again on this quadrant
                    r = q;
                    continue;
                  }

                  // If both quadrants are different, we record n
                  // in its quadrant
                  RegionMatrix[q2]['node'] = n;
                  break;
                }
              }
            }
          //}
        }
      }


      // 2) Repulsion
      //--------------
      // NOTES: adjustSize = antiCollision & scalingRatio = coefficient

      if (settings.barnesHutOptimize) {
        coefficient = settings.scalingRatio;

        // Applying repulsion through regions
        for (n in NodeMatrix) {

          // Computing leaf quad nodes iteration

          r = 0; // Starting with root region
          while (true) {

            if (RegionMatrix[r]['firstChild'] >= 0) {

              // The region has sub-regions

              // We run the Barnes Hut test to see if we are at the right distance
              distance = Math.sqrt(
                (Math.pow(NodeMatrix[n]['pos']['x'] - RegionMatrix[r]['massCenterX'], 2)) +
                (Math.pow(NodeMatrix[n]['pos']['y'] - RegionMatrix[r]['massCenterY'], 2))
              );

              if (2 * RegionMatrix[r]['size'] / distance < settings.barnesHutTheta) {

                // We treat the region as a single body, and we repulse

                xDist = NodeMatrix[n]['pos']['x'] - RegionMatrix[r]['massCenterX'];
                yDist = NodeMatrix[n]['pos']['y'] - RegionMatrix[r]['massCenterY'];

                if (settings.adjustSize) {

                  //-- Linear Anti-collision Repulsion
                  if (distance > 0) {
                    factor = coefficient * NodeMatrix[n]['mass'] *
                      RegionMatrix[r]['mass'] / distance / distance;

                    NodeMatrix[n]['dx'] += xDist * factor;
                    NodeMatrix[n]['dy'] += yDist * factor;
                  }
                  else if (distance < 0) {
                    factor = -coefficient * NodeMatrix[n]['mass'] *
                      RegionMatrix[r]['mass'] / distance;

                    NodeMatrix[n]['dx'] += xDist * factor;
                    NodeMatrix[n]['dy'] += yDist * factor;
                  }
                }
                else {

                  //-- Linear Repulsion
                  if (distance > 0) {
                    factor = coefficient * NodeMatrix[n]['mass'] *
                      RegionMatrix[r]['mass'] / distance / distance;

                    NodeMatrix[n]['dx'] += xDist * factor;
                    NodeMatrix[n]['dy'] += yDist * factor;
                  }
                }

                // When this is done, we iterate. We have to look at the next sibling.
                if (RegionMatrix[r]['nextSibling'] < 0)
                  break;  // No next sibling: we have finished the tree
                r = RegionMatrix[r]['nextSibling'];
                continue
              }
              else {

                // The region is too close and we have to look at sub-regions
                r = RegionMatrix[r]['firstChild'];
                continue;
              }

            }
            else {

              // The region has no sub-region
              // If there is a node r[0] and it is not n, then repulse

              if (RegionMatrix[r]['node'] >= 0 && RegionMatrix[r]['node'] !== n) {
                xDist = NodeMatrix[n]['pos']['x'] - NodeMatrix[RegionMatrix[r]['node']]['pos']['x'];
                yDist = NodeMatrix[n]['pos']['y'] - NodeMatrix[RegionMatrix[r]['node']]['pos']['y'];

                distance = Math.sqrt(xDist * xDist + yDist * yDist);

                if (settings.adjustSize) {

                  //-- Linear Anti-collision Repulsion
                  if (distance > 0) {
                    factor = coefficient * NodeMatrix[n]['mass'] *
                      NodeMatrix[RegionMatrix[r]['node']]['mass'] / distance / distance;

                    NodeMatrix[n]['dx'] += xDist * factor;
                    NodeMatrix[n]['dy'] += yDist * factor;
                  }
                  else if (distance < 0) {
                    factor = -coefficient * NodeMatrix[n]['mass'] *
                      NodeMatrix[RegionMatrix[r]['node']]['mass'] / distance;

                    NodeMatrix[n]['dx'] += xDist * factor;
                    NodeMatrix[n]['dy'] += yDist * factor;
                  }
                }
                else {

                  //-- Linear Repulsion
                  if (distance > 0) {
                    factor = coefficient * NodeMatrix[n]['mass'] *
                      NodeMatrix[RegionMatrix[r]['node']]['mass'] / distance / distance;

                    NodeMatrix[n]['dx'] += xDist * factor;
                    NodeMatrix[n]['dy'] += yDist * factor;
                  }
                }

              }

              // When this is done, we iterate. We have to look at the next sibling.
              if (RegionMatrix[r]['nextSibling'] < 0)
                break;  // No next sibling: we have finished the tree
              r = RegionMatrix[r]['nextSibling'];
              continue;
            }
          }
        }
      }
      else {
        coefficient = settings.scalingRatio;

        // Square iteration
        for (n1 = 0; n1 < NodesCount; n1 += 1) {
          for (n2 = 0; n2 < n1; n2 += 1) {

            // Common to both methods
            xDist = NodeMatrix[NodeList[n1]]['pos']['x'] - NodeMatrix[NodeList[n2]]['pos']['x'];
            yDist = NodeMatrix[NodeList[n1]]['pos']['y'] - NodeMatrix[NodeList[n2]]['pos']['y'];

            if (settings.adjustSize) {

              //-- Anticollision Linear Repulsion
              distance = Math.sqrt(xDist * xDist + yDist * yDist) -
                NodeMatrix[NodeList[n1]]['size'] -
                NodeMatrix[NodeList[n2]]['size'];

              if (distance > 0) {
                factor = coefficient *
                  NodeMatrix[NodeList[n1]]['mass'] *
                  NodeMatrix[NodeList[n2]]['mass'] /
                  distance / distance;

                // Updating nodes' dx and dy
                NodeMatrix[NodeList[n1]]['dx'] += xDist * factor;
                NodeMatrix[NodeList[n1]]['dy'] += yDist * factor;

                NodeMatrix[NodeList[n2]]['dx'] += xDist * factor;
                NodeMatrix[NodeList[n2]]['dy'] += yDist * factor;
              }
              else if (distance < 0) {
                factor = 100 * coefficient *
                  NodeMatrix[NodeList[n1]]['mass'] *
                  NodeMatrix[NodeList[n2]]['mass'];

                // Updating nodes' dx and dy
                NodeMatrix[NodeList[n1]]['dx'] += xDist * factor;
                NodeMatrix[NodeList[n1]]['dy'] += yDist * factor;

                NodeMatrix[NodeList[n2]]['dx'] -= xDist * factor;
                NodeMatrix[NodeList[n2]]['dy'] -= yDist * factor;
              }
            }
            else {

              //-- Linear Repulsion
              distance = Math.sqrt(xDist * xDist + yDist * yDist);

              if (distance > 0) {
                factor = coefficient *
                  NodeMatrix[NodeList[n1]]['mass'] *
                  NodeMatrix[NodeList[n2]]['mass'] /
                  distance / distance;

                // Updating nodes' dx and dy
                NodeMatrix[NodeList[n1]]['dx'] += xDist * factor;
                NodeMatrix[NodeList[n1]]['dy'] += yDist * factor;

                NodeMatrix[NodeList[n2]]['dx'] -= xDist * factor;
                NodeMatrix[NodeList[n2]]['dy'] -= yDist * factor;
              }
            }
          }
        }
      }


      // 3) Gravity
      //------------
      g = settings.gravity / settings.scalingRatio;
      coefficient = settings.scalingRatio;
      for (n in NodeMatrix) {
        //if (NodeMatrix.hasOwnPropery(n)) {
          factor = 0;

          // Common to both methods
          xDist = NodeMatrix[n]['pos']['x'];
          yDist = NodeMatrix[n]['pos']['y'];
          distance = Math.sqrt(
            Math.pow(xDist, 2) + Math.pow(yDist, 2)
          );

          if (settings.strongGravityMode) {

            //-- Strong gravity
            if (distance > 0)
              factor = coefficient * NodeMatrix[n]['mass'] * g;
          }
          else {

            //-- Linear Anti-collision Repulsion n
            if (distance > 0)
              factor = coefficient * NodeMatrix[n]['mass'] * g / distance;
          }

          // Updating node's dx and dy
          NodeMatrix[n]['dx'] -= xDist * factor;
          NodeMatrix[n]['dy'] -= yDist * factor;
        //}
      }


      // 4) Attraction
      //---------------
      coefficient = 1 *
        (settings.outboundAttractionDistribution ?
          outboundAttCompensation :
          1);

      // TODO: simplify distance
      // TODO: coefficient is always used as -c --> optimize?
      for (e in EdgeMatrix) {
        //if (EdgeMatrix.hasOwnProperty(e)) {

            n1 = EdgeMatrix[e]['source'];
            n2 = EdgeMatrix[e]['target'];
            w = EdgeMatrix[e]['weight'];

            // Edge weight influence
            ewc = Math.pow(w, settings.edgeWeightInfluence);

            // Common measures
            xDist = NodeMatrix[n1]['pos']['x'] - NodeMatrix[n2]['pos']['x'];
            yDist = NodeMatrix[n1]['pos']['y'] - NodeMatrix[n2]['pos']['y'];

            // Applying attraction to nodes
            if (settings.adjustSizes) {

              distance = Math.sqrt(
                (Math.pow(xDist, 2) + Math.pow(yDist, 2)) -
                NodeMatrix[n1]['size'] -
                NodeMatrix[n2]['size']
              );

              if (settings.linLogMode) {
                if (settings.outboundAttractionDistribution) {

                  //-- LinLog Degree Distributed Anti-collision Attraction
                  if (distance > 0) {
                    factor = -coefficient * ewc * Math.log(1 + distance) /
                    distance /
                    NodeMatrix[n1]['mass'];
                  }
                }
                else {

                  //-- LinLog Anti-collision Attraction
                  if (distance > 0) {
                    factor = -coefficient * ewc * Math.log(1 + distance) / distance;
                  }
                }
              }
              else {
                if (settings.outboundAttractionDistribution) {

                  //-- Linear Degree Distributed Anti-collision Attraction
                  if (distance > 0) {
                    factor = -coefficient * ewc / NodeMatrix[n1]['mass'];
                  }
                }
                else {

                  //-- Linear Anti-collision Attraction
                  if (distance > 0) {
                    factor = -coefficient * ewc;
                  }
                }
              }
            }
            else {

              distance = Math.sqrt(
                Math.pow(xDist, 2) + Math.pow(yDist, 2)
              );

              if (settings.linLogMode) {
                if (settings.outboundAttractionDistribution) {

                  //-- LinLog Degree Distributed Attraction
                  if (distance > 0) {
                    factor = -coefficient * ewc * Math.log(1 + distance) /
                      distance /
                      NodeMatrix[n1]['mass'];
                  }
                }
                else {

                  //-- LinLog Attraction
                  if (distance > 0)
                    factor = -coefficient * ewc * Math.log(1 + distance) / distance;
                }
              }
              else {
                if (settings.outboundAttractionDistribution) {

                  //-- Linear Attraction Mass Distributed
                  // NOTE: Distance is set to 1 to override next condition
                  distance = 1;
                  factor = -coefficient * ewc / NodeMatrix[n1]['mass'];
                }
                else {

                  //-- Linear Attraction
                  // NOTE: Distance is set to 1 to override next condition
                  distance = 1;
                  factor = -coefficient * ewc;
                }
              }
            }

            // Updating nodes' dx and dy
            // TODO: if condition or factor = 1?
            if (distance > 0) {

              // Updating nodes' dx and dy
              NodeMatrix[n1]['dx'] += xDist * factor;
              NodeMatrix[n1]['dy'] += yDist * factor;

              NodeMatrix[n2]['dx'] -= xDist * factor;
              NodeMatrix[n2]['dy'] -= yDist * factor;
            }
        //}
      }


      // 5) Apply Forces
      //-----------------
      var force,
          swinging,
          traction,
          nodespeed;

      // MATH: sqrt and square distances
      if (settings.adjustSizes) {
        for (n in NodeMatrix) {
          //if (NodeMatrix.hasOwnPropery(n)) {
              if (!NodeMatrix[n]['fixed']) {
                force = Math.sqrt(
                  Math.pow(NodeMatrix[n]['dx'], 2) +
                  Math.pow(NodeMatrix[n]['dy'], 2)
                );

                if (force > W.maxForce) {
                  NodeMatrix[n]['dx'] =
                    NodeMatrix[n]['dx'] * W.maxForce / force;
                  NodeMatrix[n]['dy'] =
                    NodeMatrix[n]['dy'] * W.maxForce / force;
                }

                swinging = NodeMatrix[n]['mass'] *
                  Math.sqrt(
                    (NodeMatrix[n]['old_dx'] - NodeMatrix[n]['dx']) *
                    (NodeMatrix[n]['old_dx'] - NodeMatrix[n]['dx']) +
                    (NodeMatrix[n]['old_dy'] - NodeMatrix[n]['dy']) *
                    (NodeMatrix[n]['old_dy'] - NodeMatrix[n]['dy'])
                  );

                traction = Math.sqrt(
                  (NodeMatrix[n]['old_dx'] + NodeMatrix[n]['dx']) *
                  (NodeMatrix[n]['old_dx'] + NodeMatrix[n]['dx']) +
                  (NodeMatrix[n]['old_dy'] + NodeMatrix[n]['dy']) *
                  (NodeMatrix[n]['old_dy'] + NodeMatrix[n]['dy'])
                ) / 2;

                nodespeed =
                  0.1 * Math.log(1 + traction) / (1 + Math.sqrt(swinging));

                // Updating node's positon
                NodeMatrix[n]['pos']['x'] =
                  NodeMatrix[n]['pos']['x'] + NodeMatrix[n]['dx'] *
                  (nodespeed / settings.slowDown);
                NodeMatrix[n]['pos']['y'] =
                  NodeMatrix[n]['pos']['y'] + NodeMatrix[n]['dy'] *
                  (nodespeed / settings.slowDown);
              }
          //}
        }
      }
      else {
        for (n in NodeMatrix) {
          //if (NodeMatrix.hasOwnPropery(n)) {
            if (!NodeMatrix[n]['fixed']) {
              swinging = NodeMatrix[n]['mass'] *
                Math.sqrt(
                  (NodeMatrix[n]['old_dx'] - NodeMatrix[n]['dx']) *
                  (NodeMatrix[n]['old_dx'] - NodeMatrix[n]['dx']) +
                  (NodeMatrix[n]['old_dy'] - NodeMatrix[n]['dy']) *
                  (NodeMatrix[n]['old_dy'] - NodeMatrix[n]['dy'])
                );

              traction = Math.sqrt(
                (NodeMatrix[n]['old_dx'] + NodeMatrix[n]['dx']) *
                (NodeMatrix[n]['old_dx'] + NodeMatrix[n]['dx']) +
                (NodeMatrix[n]['old_dy'] + NodeMatrix[n]['dy']) *
                (NodeMatrix[n]['old_dy'] + NodeMatrix[n]['dy'])
              ) / 2;

              nodespeed = NodeMatrix[n]['convergence'] *
                Math.log(1 + traction) / (1 + Math.sqrt(swinging));

              // Updating node convergence
              NodeMatrix[n]['convergence'] =
                Math.min(1, Math.sqrt(
                  nodespeed *
                  (Math.pow(NodeMatrix[n]['dx'], 2) +
                   Math.pow(NodeMatrix[n]['dy'], 2)) /
                  (1 + Math.sqrt(swinging))
                ));

              // Updating node's positon
              NodeMatrix[n]['pos']['x'] =
                NodeMatrix[n]['pos']['x'] + NodeMatrix[n]['dx'] *
                (nodespeed / settings.slowDown);
              NodeMatrix[n]['pos']['y'] =
                NodeMatrix[n]['pos']['y'] + NodeMatrix[n]['dy'] *
                (nodespeed / settings.slowDown);
            }
          //}
        }
      }
      // Counting one more iteration
      W.iterations++;

      var tx = 0, ty = 0, td;
      for (n in NodeMatrix) {
        tx += Math.abs(NodeMatrix[n]['dx']);
        ty += Math.abs(NodeMatrix[n]['dy']);
      }
      td = Math.sqrt(tx * tx + ty * ty)/NodesCount;
      //console.log(td);

      return td < settings.stableThreshold;
  }

  // based on the worker.js method
  function extend() {
    var res = {};
    var i, k;

    for (i = arguments.length - 1; i >= 0; i -= 1) {
      for (k in arguments[i]) {
        res[k] = arguments[i][k];
      }
    }

    return res;
  }
}
