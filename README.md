### viva.layout.forceatlas2

ForceAtlas2 implementation for VivaGraph based on the sigma.js plugin written
by Guillaume Plique.

* `fa_as_sigma_hack.html` is based on the sigma.js plugin code. Only the sigma
references are removed to make it work inside vivagraph. Basically updates the
positions of nodes after each worker update.

* `fa2_as_layout.html`: Contains the vivagraph layout implementation. ForceAtlas2
worker is modified to be integrated into the Vivagraph library
