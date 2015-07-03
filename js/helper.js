var GraphCommons = GraphCommons || {};
(function() {
  GraphCommons.Helper = {};

  GraphCommons.Helper.initSettings = function (sigma) {
    var fnUpdateConfig = function() {
      var config = {
        linLogMode: linLogMode.checked,
        outboundAttractionDistribution: outboundAttractionDistribution.checked,
        adjustSizes: adjustSizes.checked,
        edgeWeightInfluence: parseFloat(edgeWeightInfluence.value),
        scalingRatio: parseFloat(scalingRatio.value),
        strongGravityMode: strongGravityMode.checked,
        gravity: parseFloat(gravity.value),
        slowDown: parseFloat(slowDown.value),
        barnesHutOptimize: barnesHutOptimize.checked,
        barnesHutTheta: parseFloat(barnesHutTheta.value),
        startingIterations: parseInt(startingIterations.value),
        iterationsPerRender: parseInt(iterationsPerRender.value)
      };


      divSettings.classList.add('not-shown');
      cbToggleSettings.checked = false;

      if (sigma) {
        sigma.configForceAtlas2(config);
      }
    };

    var divSettings = document.getElementById('settings');
    var cbToggleSettings = document.getElementById('cbToggleSettings');
    cbToggleSettings.addEventListener('change', function() {
      if (this.checked) {
        divSettings.classList.remove('not-shown');
      }
      else {
        divSettings.classList.add('not-shown');
      }
    });

    var btnUpdate = document.getElementById('btnUpdateConfig');

    var linLogMode = document.getElementById('linLogMode');
    var outboundAttractionDistribution = document.getElementById('outboundAttractionDistribution');
    var adjustSizes = document.getElementById('adjustSizes');
    var edgeWeightInfluence = document.getElementById('edgeWeightInfluence');
    var scalingRatio = document.getElementById('scalingRatio');
    var strongGravityMode = document.getElementById('strongGravityMode');
    var gravity = document.getElementById('gravity');
    var slowDown = document.getElementById('slowDown');
    var barnesHutOptimize = document.getElementById('barnesHutOptimize');
    var barnesHutTheta = document.getElementById('barnesHutTheta');
    var startingIterations = document.getElementById('startingIterations');
    var iterationsPerRender = document.getElementById('iterationsPerRender');

    var allInputs = [linLogMode,
     outboundAttractionDistribution,
     adjustSizes,
     edgeWeightInfluence,
     scalingRatio,
     strongGravityMode,
     gravity,
     slowDown,
     barnesHutOptimize,
     barnesHutTheta,
     startingIterations,
     iterationsPerRender];

     allInputs.forEach(function (item) {
      item.addEventListener('keydown', function (e) {
        if (e.keyCode === 13) {
          fnUpdateConfig();
        }
      })
    });

    btnUpdate.addEventListener('click', fnUpdateConfig);
  };

  GraphCommons.Helper.updateLayoutSettings = function (layout, renderer) {
    var fnUpdateConfig = function() {
      var config = {
        linLogMode: linLogMode.checked,
        outboundAttractionDistribution: outboundAttractionDistribution.checked,
        adjustSizes: adjustSizes.checked,
        edgeWeightInfluence: parseFloat(edgeWeightInfluence.value),
        scalingRatio: parseFloat(scalingRatio.value),
        strongGravityMode: strongGravityMode.checked,
        gravity: parseFloat(gravity.value),
        slowDown: parseFloat(slowDown.value),
        barnesHutOptimize: barnesHutOptimize.checked,
        barnesHutTheta: parseFloat(barnesHutTheta.value),
        startingIterations: parseInt(startingIterations.value),
        iterationsPerRender: parseInt(iterationsPerRender.value),
        stableThreshold: parseFloat(stableThreshold.value)
      };

      divSettings.classList.add('not-shown');
      cbToggleSettings.checked = false;

      layout.updateSettings(config);
      renderer.resume();
    };

    var divSettings = document.getElementById('settings');
    var cbToggleSettings = document.getElementById('cbToggleSettings');

    cbToggleSettings.addEventListener('change', function() {
      if (this.checked) {
        divSettings.classList.remove('not-shown');
      }
      else {
        divSettings.classList.add('not-shown');
      }
    });

    var btnUpdate = document.getElementById('btnUpdateConfig');

    var linLogMode = document.getElementById('linLogMode');
    var outboundAttractionDistribution = document.getElementById('outboundAttractionDistribution');
    var adjustSizes = document.getElementById('adjustSizes');
    var edgeWeightInfluence = document.getElementById('edgeWeightInfluence');
    var scalingRatio = document.getElementById('scalingRatio');
    var strongGravityMode = document.getElementById('strongGravityMode');
    var gravity = document.getElementById('gravity');
    var slowDown = document.getElementById('slowDown');
    var barnesHutOptimize = document.getElementById('barnesHutOptimize');
    var barnesHutTheta = document.getElementById('barnesHutTheta');
    var startingIterations = document.getElementById('startingIterations');
    var iterationsPerRender = document.getElementById('iterationsPerRender');
    var stableThreshold = document.getElementById('stableThreshold');


    var allInputs = [linLogMode,
     outboundAttractionDistribution,
     adjustSizes,
     edgeWeightInfluence,
     scalingRatio,
     strongGravityMode,
     gravity,
     slowDown,
     barnesHutOptimize,
     barnesHutTheta,
     startingIterations,
     iterationsPerRender,
     stableThreshold];

     allInputs.forEach(function (item) {
      item.addEventListener('keydown', function (e) {
        if (e.keyCode === 13) {
          fnUpdateConfig();
        }
      })
    });

    btnUpdate.addEventListener('click', fnUpdateConfig);

  };

}(GraphCommons));
