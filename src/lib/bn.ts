const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
/** Convert ASCII digits to Bangla digits (keeps commas, dots, % etc.). */
export const toBn = (n: number | string) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);
