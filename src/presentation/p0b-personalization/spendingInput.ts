/** Currency controls declare two minor units. No floating-point money conversion. */
export function parseSpendingAmount(text: string): number | null {
  if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(text.trim()))return null;
  const [whole,fraction='']=text.trim().split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
