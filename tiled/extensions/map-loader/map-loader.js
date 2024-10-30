class MapLoader {
    constructor() {
        this.title = "Map Loader";
        this.version = "0.0.1";

        this.biome_tile_mapping = {}
        this.geohash = {}

        this.initTiles()
        const mapNavigator = tiled.registerAction('MapLoader_Navigator',
            action => this.beginNavigate());
        mapNavigator.text = "Navigate to GeoHash";
    }

    initTiles() {
        const customTilesets = new Tileset("customTileset");
        const waterImage = new Image("/Users/mxhiu/Developer/tiled-extension/tiles/dungeon/Angle/stone_W.png")
        tiled.log(`Initiated water image ${waterImage} with size ${waterImage.size}`)

        const waterTile = customTilesets.addTile();
        waterTile.setImage(waterImage)

        const landImage = new Image("/Users/mxhiu/Developer/tiled-extension/tiles/dungeon/Angle/planks_E.png")
        tiled.log(`Initiated land image ${landImage} with size ${landImage.size}`)

        const landTile = customTilesets.addTile();
        landTile.setImage(landImage)

        this.biome_tile_mapping = {
            'aquatic': waterTile,
            'land': landTile
        }
    }

    initGeoHash() {
        let geohash_file = tiled.promptOpenFile("./", "Json files (*.json)", null)
        if (geohash_file) {
            tiled.log(`GeoHash file from: ${geohash_file}`)
        } else {
            tiled.alert("Please select a valid GeoHash file");    
        }
    }

    getTile(biome) {
        if (biome === "aquatic") {
            return this.biome_tile_mapping.aquatic
        }
        return this.biome_tile_mapping.land
    }

    beginNavigate() {
        // this.initGeoHash()

        this.dialog = new Dialog(this.title);
        this.dialog.minimumWidth = 400;
        this.dialog.finished.connect((code) => {
            this.dialog = undefined;
        });
        this.promptInputs(() => {
            if (!this.config) {
                if (this.dialog) {
                    this.dialog.reject();
                }
                tiled.alert("Aborting operation.", this.title);
                return;
            }
            this.execute(() => this.navigate(), "Navigate", this.config);
        });
    }

    navigate() {
        const tileset = tiled.activeAsset;

        let baseLayer = tileset.asset.asset.layers.filter(layer => layer.name === "baseLayer");
        if (baseLayer.length != 0) {
            tileset.asset.asset.removeLayer(baseLayer[0]);
        }
        baseLayer = new TileLayer("baseLayer");
        tileset.asset.asset.addLayer(baseLayer);

        tiled.log(`Found ${baseLayer} with size ${baseLayer.width}x${baseLayer.height}`);

        let baseLayerEdit = baseLayer.edit();
        for (let column = 0; column < baseLayer.width; column++) {
            for (let row = 0; row < baseLayer.height; row++) {
                if (column % 2 == 0) {
                    baseLayerEdit.setTile(column, row, this.getTile("aquatic"));
                } else {
                    baseLayerEdit.setTile(column, row, this.getTile("land"));
                }
            }
        }
        baseLayerEdit.apply();

        tiled.log(`Navigating to GeoHash: ${this.config.geohash}`);
        if (this.dialog) {
            this.dialog.accept();
        }
    }

    promptInputs(configCallback) {
        this.config = {};

        this.addGeoHashInput();
        var okButton = this.dialog.addButton('OK');
        okButton.clicked.connect(() => {
            if (!this.validateConfig()) {
                return;
            }
            configCallback();
        });
        var cancelButton = this.dialog.addButton('Cancel');
        cancelButton.clicked.connect(() => {
            this.dialog.reject();
        })
        this.dialog.show();
    }

    execute(action, name) {
        try {
            action();
        } catch (e) {
            tiled.alert("An error occurred performing the operation. The error was logged to the Console (View → Views "
                + "and Toolbars → Console).\n\nPlease try again, and if the error persists, please submit an issue for "
                + "this extension with the error output from the console and (if possible) the tileset you are using.",
                this.title);
            const errorOutput = this.formatError(e, name);
            tiled.error(errorOutput);
        }
    }

    formatError(e, name, config) {
        let result = 'Error output from Map Loader extension:\n'
            + '----------------------------------------\n'
            + e.toString() + "\n\n"
            + "Action: " + name + "\n\n"
            + "Stack Trace:\n"
            + e.stack + '\n\n'
            + "Extension Version: " + this.version + "\n\n";

        if (config) {
            result += "Config:\n" + JSON.stringify(config) + "\n\n";
        }

        return result;
    }

    validateConfig() {
        let isValidGeohash = /^(\w{8})$/.test(this.config.geohash);

        if (!isValidGeohash) {
            tiled.alert(`${this.config.geohash} is not a valid geohash.`);
        }
        return isValidGeohash;
    }

    addGeoHashInput() {
        this.config.geohash = "w21zveje";
        this.geohashInput = this.dialog.addTextInput('GeoHash', this.config.geohash);
        this.geohashInput.textChanged.connect(function (newText) {
            this.config.geohash = newText
        }.bind(this));
    }
}

const mapLoader = new MapLoader();

tiled.extendMenu("Map", [
    { action: 'MapLoader_Navigator', before: 'Select Next Tileset' },
    { separator: true }
]);
