// Match PostgreSQL round(numeric, 0), including exact half-rupee amounts.
export function roundRupees(amount: number) {
  const magnitude = Math.abs(amount);
  const rounded = Math.round(magnitude + Number.EPSILON * Math.max(1, magnitude));
  return rounded === 0 ? 0 : Math.sign(amount) * rounded;
}

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
export const money = (amount: number) => rupees.format(roundRupees(amount));
