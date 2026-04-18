export const inr = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "₹0";
  const num = Number(n);
  const abs = Math.abs(num);
  if (abs >= 1e7) return `₹${(num / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(num / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `₹${(num / 1e3).toFixed(1)}K`;
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export const inrFull = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "₹0";
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};
