export const rupeesToPaise = (r: number) => Math.round(r * 100);
export const paiseToRupees = (p: number) => p / 100;
export const formatINR = (paise: number) =>
  `INR ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
