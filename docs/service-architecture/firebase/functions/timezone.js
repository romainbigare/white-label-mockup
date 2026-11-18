// A farm's time zone (an IANA name such as Asia/Riyadh), from where it is. Daily advice, reports
// and quiet hours follow the farm's own clock. Worked out offline (geo-tz), never by an outside call.
const { find } = require('geo-tz');

// The farm's place: its `location` (a geopoint), else the first point of its outline.
function placeOf(farm) {
  const l = farm && farm.location;
  if (l && Number.isFinite(l.latitude) && Number.isFinite(l.longitude)) return [l.latitude, l.longitude];
  const p = farm && farm.boundary && farm.boundary.points && farm.boundary.points[0];
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) return [p.lat, p.lon];
  return null;
}

function timeZoneOf(farm) {
  const place = placeOf(farm);
  if (!place) return null;
  try {
    return find(place[0], place[1])[0] || null;
  } catch (err) {
    return null;
  }
}

module.exports = { timeZoneOf };
