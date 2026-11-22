// One small painted bay per spot, coloured by status. Used for at-a-glance availability.
export default function BayStrip({ slots, size = 'md' }) {
  return (
    <div className={`baystrip baystrip--${size}`} role="img"
      aria-label={`${slots.filter((s) => s.status === 'Available').length} of ${slots.length} spots free`}>
      {slots.map((s) => (
        <i key={s.id} className={`bs bs--${s.mine ? 'mine' : s.status.toLowerCase()}`} title={`${s.name}: ${s.mine ? 'yours' : s.status.toLowerCase()}`} />
      ))}
    </div>
  );
}
