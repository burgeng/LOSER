let map;
let points = [];
let markers = [];
let AdvancedMarkerElement;
let ElevationService;
let infoWindow;

// Entrance point (callabck) function - supplied to API URL
async function initMap() {
    // Below is shorthand for:
    /*
    const mapsLib = await google.maps.importLibrary("maps");
    const Map = mapsLib.Map;
    const InfoWindow = mapsLib.InfoWindow;
    */
    const { Map, InfoWindow } = await google.maps.importLibrary("maps");
    ({ AdvancedMarkerElement } = await google.maps.importLibrary("marker")); // must be enclosed in () to prevent js
    ({ ElevationService } = await google.maps.importLibrary("elevation"));
    
    const start = randomStart();

    map = new Map(document.getElementById("map"), {
        center: start,
        zoom: 6,
        mapId: "DEMO_MAP_ID", 
    });

    attachMapClickHandler();
    attachClearButtonClickHandler();

    setText("statusText", "Select point 1");
}

// generate random starting coords for map render
function randomStart() {
    return {
        lat: Math.random() * 140 - 70,
        lng: Math.random() * 360 - 180,
    };
}

// declare a InfoWindow and open it on the map
function createInfoWindow(position, InfoWindow) {
    infoWindow = new InfoWindow({
        content: "Click the map to select points",
        position,
    });

    infoWindow.open(map);
    return infoWindow;
}

// attach click handler to the map 
function attachMapClickHandler() {
    map.addListener("click", handleMapClick);
}

// the actual handler function for click event on map
async function handleMapClick(mapsMouseEvent) {
    if (points.length >= 2) return;

    const point = mapsMouseEvent.latLng.toJSON(); // get the lat and lon of the clicked point
    point.elevation = await getLocationElevation(point);
    addPoint(point); // put point in internal list
    addMarker(point); // add visual marker to map
    updateUIAfterPointSelection();
}

function attachClearButtonClickHandler() {
    document.getElementById("clearPointsButton").addEventListener("click", clearSelectedPoints);
}

function clearSelectedPoints() {
    points = [];
    setText("statusText", "Select point 1");
    setText("point1", "Selected point 1: ");
    setText("point2", "Selected point 2: ");
}

// make new AdvancedMarkerElement at a specific {lat, lon}
function addMarker(point) {
    new AdvancedMarkerElement({
        map: map,
        position: point,
        title: `Point ${points.length}`,
    });
}

function addPoint(point) {
    points.push(point);
    console.log(`Point ${points.length}:`, point);
}

function updateUIAfterPointSelection() {
    if (points.length === 1) {
        setText("statusText", "Select point 2");
        setText("point1", `Selected Point 1: ${points[0].lat}, ${points[0].lng}`);
    } else if (points.length === 2) {
        setText("statusText", "Both points selected");
        setText("point2", `Selected Point 2: ${points[1].lat}, ${points[1].lng}`);
    }
}

function setText(elementId, text) {
    document.getElementById(elementId).textContent = text;
}

async function getLocationElevation(location) {
    const elevator = new ElevationService();

    try {
        const { results } = await elevator.getElevationForLocations({
            locations: [location],
        });

        if (results[0]) {
            let elev = results[0].elevation
            if (elev < 0){
                return 0;
            }
            return results[0].elevation;
        } else {
            return 0;
        }
    } catch (e) {
        infoWindow.setContent("Elevation service failed due to: " + e);
        return 0;
    }
}

window.initMap = initMap;