let map;
let points = [];
let markers = [];
let lines = [];
let AdvancedMarkerElement;
let ElevationService;
let infoWindow;
let spherical;

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
    ({ spherical } = await google.maps.importLibrary("geometry"));
    
    const start = randomStart();

    map = new Map(document.getElementById("map"), {
        center: start,
        zoom: 6,
        mapId: "DEMO_MAP_ID", 
    });

    setVisability("interpolateButton", false);
    attachMapClickHandler();
    attachClearButtonClickHandler();
    attachInterpolateButtonHandler();
    attachInputListener();

    setText("statusText", "Select point 1");
}

function attachInterpolateButtonHandler(){
    document.getElementById("interpolateButton").addEventListener("click", hasLineOfSight);
}

function drawLine(){
    const line = new google.maps.Polyline({
        path: [points[0], points[1]],
        geodesic: true,
        strokeColor: "#2563eb",
        strokeOpacity: 1.0,
        strokeWeight: 3,
    });

    lines.push(line);

    line.setMap(map);
}

async function hasLineOfSight() {
    setVisability("interpolateButton", false);

    try {
        removeLines();
        drawLine();

        const from = points[0];
        const to = points[1];
        const numSamples = Number(getValue("slider"));

        const elevator = new ElevationService();
        const totalDistance = spherical.computeDistanceBetween(from, to);
        const earthRadius = 6378137; // meters

        // heights above ground entered by user
        const fromHeight = Number(getValue("elevation1Input")) || 0;
        const toHeight = Number(getValue("elevation2Input")) || 0;

        const { results } = await elevator.getElevationAlongPath({
            path: [from, to],
            samples: numSamples + 2, // includes endpoints
        });

        if (!results || results.length < 2) {
            console.log("Could not retrieve elevation profile.");
            return false;
        }

        const fromGround = results[0].elevation;
        const toGround = results[results.length - 1].elevation;

        const fromEye = fromGround + fromHeight;
        const toEye = toGround + toHeight;

        console.log("LOS check starting...", {
            from,
            to,
            numSamples,
            totalDistance,
            fromGround,
            toGround,
            fromHeight,
            toHeight,
            fromEye,
            toEye
        });

        for (let i = 1; i < results.length - 1; i++) {
            const fraction = i / (results.length - 1);
            const distance = totalDistance * fraction;
            const terrainElevation = results[i].elevation;

            // straight line height between endpoints
            const lineHeight = fromEye + (toEye - fromEye) * fraction;

            // Earth curvature drop at this point
            const curvatureDrop = (distance * (totalDistance - distance)) / (2 * earthRadius);

            // max terrain height allowed for visibility
            const visibleLimit = lineHeight - curvatureDrop;

            console.log(`Sample ${i}/${results.length - 2}`, {
                lat: results[i].location.lat(),
                lng: results[i].location.lng(),
                distance,
                terrainElevation,
                lineHeight,
                curvatureDrop,
                visibleLimit
            });

            if (terrainElevation > visibleLimit) {
                console.log("LOS blocked.", {
                    blockedAtSample: i,
                    blockedDistance: distance,
                    terrainElevation,
                    visibleLimit
                });
                return false;
            }
        }

        console.log("LOS clear.");
        return true;
    } finally {
        setVisability("interpolateButton", true);
    }
}

function removeLines(){
    for(let i = 0; i < lines.length; i++){
        lines[i].setMap(null);
    }
}

function setVisability(element, vis){
    document.getElementById(element).disabled = !vis;
}

function getValue(element){
    return document.getElementById(element).value;
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
    console.log("Clearing points, internal points list now: ", points)
    deleteMarkers(); // remove placed map markers
    setText("statusText", "Select point 1");
    setText("point1", "Selected point 1: ");
    setText("point2", "Selected point 2: ");
    hide("elevation1Input");
    hide("elevation2Input");
    setText("elevation1Note", "");
    setText("elevation2Note", "");
    setVisability("interpolateButton", false);
    setVisability("slider", false);
    removeLines();
}

function attachInputListener() {
    const input1 = document.getElementById("elevation1Input");

    input1.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            const value = input1.value;
            handleSubmit(value, 0);
        }
    });

    const input2 = document.getElementById("elevation2Input");

    input2.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            const value = input2.value;
            handleSubmit(value, 1);
        }
    });
}

function handleSubmit(value, pointNum) {
    console.log(`Entered value ${value} for point: `, points[pointNum]);
    points[pointNum].elevation = value; // reassign elevation
    console.log(`Changed elevation to ${points[pointNum].elevation} for point`, pointNum+1);
}

// make new AdvancedMarkerElement at a specific {lat, lon}
function addMarker(point) {
    const marker = new AdvancedMarkerElement({
        map: map,
        position: point,
        title: `Point ${points.length}: `,
    });
    markers.push(marker);
}

function addPoint(point) {
    points.push(point);
    console.log(`Point ${points.length}:`, point);
}

function updateUIAfterPointSelection() {
    if (points.length === 1) {
        setText("statusText", "Select point 2");
        setText("point1", `Selected Point 1: ${points[0].lat}, ${points[0].lng}`);
        setText("elevation1Note", 'Elevation of Point 1:');
        setValue("elevation1Input", points[0].elevation);
        unhide("elevation1Input");
    } else if (points.length === 2) {
        setText("statusText", "Both points selected");
        setText("point2", `Selected Point 2: ${points[1].lat}, ${points[1].lng}`);
        setText("elevation2Note", 'Elevation of Point 2:');
        setValue("elevation2Input", points[1].elevation);
        unhide("elevation2Input");
        setVisability("interpolateButton", true);
        setVisability("slider", true);
    }
}

// Sets the map on all markers in the array.
function setMapOnAll(map) {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(map);
  }
}

// Removes the markers from the map, but keeps them in the array.
function hideMarkers() {
  setMapOnAll(null);
}

// Deletes all markers in the array by removing references to them.
function deleteMarkers() {
  hideMarkers();
  markers = [];
}

function setValue(elementId, text) {
    document.getElementById(elementId).value = text;
}

function setText(elementId, text) {
    document.getElementById(elementId).textContent = text;
}

function unhide(elementId) {
    document.getElementById(elementId).style.display = "inline-block";
}

function hide(elementId) {
    document.getElementById(elementId).style.display = null;
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

// TODO:
//  Remove markers on clear points
//  Sample points along straight line between points