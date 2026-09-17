// geometry-math.js - Pure Mathematical and Geometric Functions

/**
 * Converts Latitude and Longitude to Local Cartesian Coordinates (X, Y)
 */
function latLonToCartesian(lat, lon, originLat, originLon) {
  const R = 6378137; // Earth's radius in meters
  const dLat = (lat - originLat) * (Math.PI / 180);
  const dLon = (lon - originLon) * (Math.PI / 180);
  return {
    x: dLon * R * Math.cos(originLat * (Math.PI / 180)),
    y: dLat * R 
  };
}

/**
 * Converts Cartesian distance (dx, dy) to Polar Bearing (Surveying Format)
 */
function cartesianToPolarBearing(dx, dy) {
  const dist = Math.hypot(dx, dy);
  let azRad = Math.atan2(dx, dy); 
  if (azRad < 0) azRad += 2 * Math.PI;
  let azDeg = azRad * (180 / Math.PI);

  let ns = 'N', ew = 'E', bearingDeg = azDeg;
  if (azDeg >= 0 && azDeg < 90) {
    ns = 'N'; ew = 'E'; bearingDeg = azDeg;
  } else if (azDeg >= 90 && azDeg < 180) {
    ns = 'S'; ew = 'E'; bearingDeg = 180 - azDeg;
  } else if (azDeg >= 180 && azDeg < 270) {
    ns = 'S'; ew = 'W'; bearingDeg = azDeg - 180;
  } else {
    ns = 'N'; ew = 'W'; bearingDeg = 360 - azDeg;
  }

  let totalSec = Math.round(bearingDeg * 3600);
  let deg = Math.floor(totalSec / 3600);
  totalSec %= 3600;
  let min = Math.floor(totalSec / 60);
  let sec = totalSec % 60;

  return { 
    ns, 
    deg: String(deg), 
    min: String(min).padStart(2, '0'), 
    sec: String(sec).padStart(2, '0'), 
    dist: dist.toFixed(3) 
  };
}

/**
 * Calculates the total area of a polygon given its points
 */
function calculatePolygonArea(points) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    area += (points[i].x * points[i+1].y) - (points[i+1].x * points[i].y);
  }
  area += (points[points.length-1].x * points[0].y) - (points[0].x * points[points.length-1].y);
  return Math.abs(area) / 2;
}

/**
 * Calculates the interior angle between three given points
 */
function calculateInteriorAngle(pPrev, pCurr, pNext) {
    let a1 = Math.atan2(pPrev.y - pCurr.y, pPrev.x - pCurr.x);
    let a2 = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
    let angleRad = a1 - a2;
    
    // Normalize to 0 - 360 degrees
    let angleDeg = angleRad * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;
    
    // For polygons drawn clockwise vs counter-clockwise, ensure we get the inside angle
    if (angleDeg > 180) angleDeg = 360 - angleDeg; 
    
    let deg = Math.floor(angleDeg);
    let min = Math.floor((angleDeg - deg) * 60);
    let sec = Math.round((((angleDeg - deg) * 60) - min) * 60);
    
    if (sec === 60) { sec = 0; min += 1; }
    if (min === 60) { min = 0; deg += 1; }
    
    return `${deg}°${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}"`;
}

/**
 * Snaps the mouse coordinates to the nearest global point based on a set radius
 */
function getSnappedCoordinates(mouseX, mouseY, globalPoints) {
  let snappedPt = { x: mouseX, y: mouseY, isSnapped: false };
  let minDistance = WorkspaceState.snapRadius; // Relies on global WorkspaceState

  globalPoints.forEach(pt => {
    const screenX = WorkspaceState.transform.x + (pt.x * WorkspaceState.baseScale * WorkspaceState.transform.k);
    const screenY = WorkspaceState.transform.y - (pt.y * WorkspaceState.baseScale * WorkspaceState.transform.k);
    const dist = Math.hypot(mouseX - screenX, mouseY - screenY);

    if (dist < minDistance) {
      minDistance = dist;
      snappedPt = { x: screenX, y: screenY, isSnapped: true, ref: pt };
    }
  });
  return snappedPt;
}

/**
 * Converts a Hex color string to an RGBA string with a given alpha transparency
 */
function hexToRgba(hex, alpha) {
  let c;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
      c = hex.substring(1).split('');
      if(c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      c = '0x'+c.join('');
      return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
  }
  return `rgba(37, 99, 235, ${alpha})`; 
}