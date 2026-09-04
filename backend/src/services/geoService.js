/**
 * IP Geolocation lookup service
 */
export async function getGeoLocation(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return 'Local Network (Dev)';
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        return `${data.city || 'Unknown City'}, ${data.country || 'Unknown Country'}`;
      }
    }
  } catch (err) {
    console.error('[GEO] Lookup failed for IP:', ip, err.message);
  }
  return 'Unknown Location';
}

export default {
  getGeoLocation
};
