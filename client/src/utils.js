export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtDate = (ts) =>
  ts ? new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export const statusText = (s) =>
  s.mine ? 'Your spot' : s.status === 'Available' ? 'Free' : s.status === 'Booked' ? 'Taken' : 'Closed for maintenance';

// "A-07" -> "A-08", "Library 9" -> "Library 10", anything else gets " 2"
export const nextName = (name = '') => {
  const m = name.match(/^(.*?)(\d+)$/);
  if (!m) return name ? `${name} 2` : '';
  return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, '0');
};

export const initialsOf = (name = '') =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
